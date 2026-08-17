## Context

`finalize` currently creates a `pending` row and returns immediately. The
analysis worker exists as a library function but has no production caller, so
the admin panel can poll the same empty draft forever. The existing
`menu_import_jobs` table is already the tenant-scoped source of truth, while
the PDF bucket is private and requires server-side access. See `proposal.md`
and the delta specification for the externally observable contract.

## Goals / Non-Goals

**Goals:**

- Add a durable, authenticated trigger that invokes bounded analysis work in
  production and can be invoked deterministically in tests.
- Recover interrupted work with leases, persisted attempts, retry backoff, and
  terminal failure states.
- Keep database transactions short around external Storage, OCR, and provider
  calls, then atomically persist the resulting draft.
- Keep service credentials and source documents server-only, preserve tenant
  isolation, and expose useful structured diagnostics.
- Make admin polling efficient and terminal-state aware.

**Non-Goals:**

- Replacing the existing signed upload/finalize protocol.
- Introducing a second queue product, changing publication semantics, or
  making analysis synchronous in the finalize request.
- Guaranteeing perfect OCR or menu interpretation; provider quality remains a
  separate concern from orchestration reliability.

## Decisions

### 1. Use a protected internal route invoked by Vercel Cron

Add a server-only internal worker endpoint and schedule it from `vercel.json`.
The route accepts only the configured cron secret (with a constant-time
comparison where practical), processes a small bounded batch, and returns
counts plus per-job safe outcomes. A manual invocation remains possible in
staging with the same secret for deterministic tests.

Using Vercel Cron fits the existing deployment and avoids adding a queue
service. Supabase Queues or a long-running process were considered, but would
add infrastructure and operational cost before the current database-backed
queue is proven. The route must honor the function time budget and leave
remaining jobs for the next tick.

### 2. Extend the existing job row with lease and retry metadata

Add nullable/with-default fields for attempt count, next eligible time,
processing start, lease expiry, and a bounded diagnostic code/message. Index
the eligible-claim predicate. Claims use row-level locking with
`SKIP LOCKED`, update the attempt and lease in a short committed transaction,
and return the claimed job. External work occurs after that commit. Completion
or failure updates use a job id plus lease/attempt guard so a stale worker
cannot overwrite a later recovery.

The retry policy is three attempts by default with exponential backoff and a
finite lease. Expired processing leases are reclaimed as retryable work; after
the final attempt the row is terminally `failed`. This explicitly avoids the
current failure mode where an attempt increment is rolled back together with
the processing transaction.

### 3. Separate source reading, analysis, and persistence

The worker obtains the PDF through a server-only Storage helper using the
private bucket and the authorized object path. It passes the bytes to the
existing text/OCR/provider pipeline with an abortable, deterministic timeout.
Asset writes use tenant/job-scoped paths. Draft rows, evidence, image
suggestions, and the final `needs_review` state are written in one short
database transaction after analysis completes.

The worker treats missing objects, provider/OCR configuration, malformed
provider output, and timeouts as typed outcomes. Retries are reserved for
transient failures; configuration and permanently unsupported input become
bounded terminal reasons after the policy is applied. Extracted PPM images
cannot be placed in the current allowed MIME set, so the implementation must
convert them to an allowed image type or omit them with a warning rather than
weakening bucket policy.

### 4. Keep the API envelope and admin polling contract stable

The internal route uses the existing structured JSON error envelope and does
not expose document contents or secrets. Existing admin detail responses keep
the `pending`, `processing`, `needs_review`, `failed`, and `published` states.
The panel changes only its refresh strategy: use bounded backoff while active,
stop on every terminal state, and display the safe failure code/reason for a
failed import.

### 5. Test the worker as a state machine

Unit and integration tests cover no-work, authentication, exclusive claims,
stale lease recovery, attempts 1/2 retry and attempt 3 terminal failure,
timeouts, missing source, OCR/provider failures, successful draft persistence,
and tenant boundaries. A production-like E2E path invokes the protected
trigger after finalize and verifies `pending → processing → needs_review` (or
`failed`) plus the review UI. Tests use fake timers for polling and avoid
depending on an always-running local scheduler.

## Risks / Trade-offs

- **[Cron delay]** Vercel Cron is periodic rather than immediate. → Use a
  short schedule, expose processing timestamps, and keep a protected manual
  trigger for staging and operations.
- **[Serverless time limits]** A large PDF or OCR request can exceed a function
  budget. → Bound the batch, enforce abortable timeouts, and persist leases so
  the next invocation can recover safely.
- **[Duplicate side effects]** A worker may finish after its lease expires. →
  Guard completion by job id and lease/attempt, and use idempotent draft/asset
  writes.
- **[Provider configuration drift]** OCR may be unset or return invalid data. →
  Classify configuration/parse failures, log request/job identifiers, and show
  a safe actionable reason instead of exposing provider details.
- **[Storage format mismatch]** Existing image extraction emits PPM while the
  bucket allow-list excludes it. → Convert to PNG/JPEG or skip only the
  unsupported suggestion; never make the private bucket broadly writable.
- **[Schema rollout]** Older rows lack lease fields. → Deploy additive
  migration/defaults first, deploy the worker second, and make rollback leave
  existing finalize and review routes functional.

## Migration Plan

1. Apply the additive database migration and indexes to the production
   Supabase project.
2. Configure the cron secret and required server-only Supabase/OCR variables
   in Vercel; verify the private bucket and Storage policies.
3. Deploy the worker route, scheduler entry, storage adapter, and polling
   changes behind the existing API contract.
4. Invoke the protected route once in staging, then verify a production import
   reaches `needs_review` or a bounded `failed` state.
5. If rollback is required, disable the cron entry and redeploy the previous
   application; additive lease columns can remain unused until the worker is
   restored.

