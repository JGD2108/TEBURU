## Context

`finalize` already verifies the uploaded object and inserts one
`menu_import_jobs` row. The existing draft tables require `import_job_id`, but
the worker is not invoked and there is no durable record distinguishing one
analysis attempt from another. The previous orchestration plan proposed a
Vercel Cron consumer; this design replaces that host-specific trigger with a
Supabase-managed event path. Supabase Database Webhooks fire after a row change
and dispatch asynchronously, so the database transaction is not held open by
the analysis request.

## Goals / Non-Goals

**Goals:**

- Start one analysis execution automatically after a finalized job insert,
  independent of where the Next.js application is hosted.
- Make duplicate webhook delivery, retries, and stale workers safe and
  observable.
- Make the job UUID and attempt UUID a verifiable lineage key for every draft
  element and asset.
- Avoid re-running provider/OCR work for the same restaurant, source hash, and
  analyzer version when prior output can be reused safely.
- Keep source PDFs private and all privileged Supabase credentials outside the
  browser.

**Non-Goals:**

- Running PDF/OCR work inside a Postgres trigger; triggers only enqueue/notify.
- Changing signed upload authorization or publication approval semantics.
- Making the browser responsible for invoking or retrying the worker.
- Keeping the Vercel Cron entry as a fallback; recovery is event/replay based
  and the worker contract is portable to another Deno-compatible host.

## Decisions

### 1. Supabase Database Webhook is the start signal

Configure an `AFTER INSERT` webhook on `menu_import_jobs` that invokes a
Supabase Edge Function with a payload containing the job UUID. The function
accepts only the automation secret, validates the event shape, reloads the job
from the database, and verifies the exact private Storage object before doing
any analysis. Updates to status or draft tables do not fire this webhook, so
normal progress cannot recursively start another run.

This is preferred over a Postgres trigger that calls an AI/provider directly:
the trigger remains short and reliable, while the asynchronous webhook can
perform network and Storage work. A Vercel API route or cron was rejected
because it couples processing availability to the current frontend host.

### 2. Separate import identity from attempt identity

Keep `menu_import_jobs.id` as the immutable import execution root: one
finalized PDF submission, one restaurant, one source path. Add a
`menu_import_analysis_runs` record for every claim with a generated
`analysis_execution_id`, attempt number, source SHA-256, analyzer/provider
version, lease, timestamps, status, and bounded failure metadata.

The worker claims with one conditional update (`pending` or explicitly retried
only → `processing`) and records the run before downloading/analyzing. A
duplicate event sees no claim and returns success without side effects. A
stale worker can update nothing unless its job id and execution id still own
the current lease.

### 3. Use source fingerprinting for safe re-analysis detection

After the worker reloads and validates the object, it streams/downloads the PDF
and computes SHA-256. A successful prior run for the same restaurant, source
hash, and analyzer version is a reusable result. The new job receives a new
run marked `reused`, and draft rows are copied or regenerated under the new
`import_job_id` in one transaction so lineage never points at the old job.

If no reusable run exists, the worker runs native text/OCR/provider analysis.
Changing the analyzer/provider version intentionally invalidates reuse. A
failed or partial run is never treated as reusable.

### 4. Enforce lineage in the database, not only in application code

All draft tables continue to carry `import_job_id` and `restaurant_id`. Add
composite uniqueness/foreign-key constraints where needed so those two values
must reference the same parent job; similarly ensure an item’s category and an
evidence row’s item belong to that same job. Add uniqueness keys or content
hashes for evidence and image suggestions to make a retry idempotent. Assets
use a temporary path containing job and attempt IDs until the final draft
transaction commits.

The completion transaction inserts/reuses all categories, items, evidence, and
image suggestions, records the run outcome, and changes the job to
`needs_review` together. It never exposes partial rows as a completed draft.

### 5. Keep the worker portable and bounded

The first runtime is a Supabase Edge Function because it is directly callable
from the Database Webhook and remains independent of Vercel. The function
must acknowledge webhook delivery quickly and apply an abortable timeout to
Storage, OCR, and provider work. Before production rollout, test the real
20-MB PDF path against the configured Supabase plan limits.

If the measured PDF/OCR workload exceeds Edge Function limits, keep the same
webhook, claim schema, run IDs, and state machine but move only the analysis
handler to a Deno-compatible worker service. This is a deployment substitution
rather than an API or data-model change; no Vercel Cron is reintroduced.

### 6. Recovery is explicit and observable

Webhook delivery is treated as at-least-once. The function records structured
events (`received`, `claimed`, `duplicate`, `reused`, `completed`, `failed`,
`lease_recovered`) with job ID and execution ID. Supabase webhook retries cover
transient delivery failures; an authenticated admin/operator replay action
re-emits a pending job without allowing arbitrary client invocation. Lease
expiry and retry limits prevent a permanently stuck `processing` row.

## Risks / Trade-offs

- **[Webhook delivery loss or delay]** Event-driven processing depends on the
  Supabase webhook configuration and delivery service. → Verify webhook
  delivery in deployment checks, retain an authenticated replay action, and
  surface jobs with no run for operations.
- **[At-least-once delivery]** Duplicate events are normal. → Conditional claim,
  execution IDs, unique lineage keys, and lease ownership make duplicates
  no-ops.
- **[Edge Function resource limits]** PDF parsing/OCR may exceed free-plan
  duration or memory. → Benchmark with representative PDFs; enforce timeout;
  move only the portable handler if limits are exceeded.
- **[Fingerprint reuse complexity]** Copying a prior result can preserve stale
  provider output if versioning is incomplete. → Include analyzer/provider
  version in the reuse key and never reuse failed or partial runs.
- **[Cross-job corruption]** A bad insert could attach an item to another
  restaurant/job. → Composite foreign keys, transaction-scoped writes, and an
  acceptance query asserting zero cross-lineage rows.
- **[Temporary assets]** A crash can leave unreferenced files. → Namespace
  temporary assets by job/attempt and add a safe cleanup operation based on
  terminal run metadata.

## Migration Plan

1. Add the additive run table, source hash/version fields, leases, indexes,
   composite constraints, and idempotency keys. Backfill no historical output;
   existing jobs remain inspectable.
2. Deploy the Edge Function in a disabled/test mode and configure its
   server-only automation secret and Supabase service-role access.
3. Create the `menu_import_jobs` INSERT webhook and test one controlled PDF,
   including duplicate delivery and replay behavior.
4. Deploy the worker/lineage changes, enable the webhook, and remove the
   menu-import Vercel Cron entry.
5. Validate upload → finalize → webhook → analysis run → review with a real
   PDF, checking that every draft row contains the exact job UUID and
   restaurant ID.
6. If rollback is required, disable the webhook and deploy the prior app;
   additive run metadata remains inert and no Vercel schedule is required to
   preserve existing upload/review functionality.

