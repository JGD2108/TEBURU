## Purpose

Make finalized PDF imports self-starting, idempotent analysis executions whose
draft elements can be traced unambiguously to the exact PDF, restaurant, and
analysis attempt that produced them.

## ADDED Requirements

### Requirement: Finalized PDF insertion starts one analysis execution

The system MUST react after a finalized `menu_import_jobs` row is committed,
using only its job UUID as the event correlation key. The event consumer MUST
reload the row from the database, verify that the source path belongs to the
same restaurant and is a bounded PDF object in private Storage, and MUST NOT
trust an unverified path or restaurant value from the event payload.

#### Scenario: Valid finalized PDF row
- **WHEN** a finalized job is inserted with `status = pending` and a valid
  private PDF source
- **THEN** exactly one analysis execution is eligible to claim that job without
  requiring a browser session or Vercel Cron invocation

#### Scenario: Invalid event or source
- **WHEN** an event has the wrong table/event shape, an unknown job UUID, a
  cross-restaurant path, or a non-PDF/missing Storage object
- **THEN** the consumer rejects or records a bounded failure and does not
  create draft elements

### Requirement: Analysis executions are identifiable and idempotent

The system MUST use the finalized job UUID as the import execution identity
and MUST assign a unique `analysis_execution_id` to each claimed attempt. It
MUST persist the source SHA-256 fingerprint, analyzer/provider version,
attempt number, start/end timestamps, and outcome. Duplicate event deliveries
or repeated worker calls for a job that is already active or terminal MUST be
no-ops and MUST NOT create duplicate draft elements.

#### Scenario: Duplicate webhook delivery
- **WHEN** the same job event is delivered more than once
- **THEN** only one execution claims the `pending` job and later deliveries
  acknowledge the existing state without inserting another category, item,
  evidence row, or image suggestion

#### Scenario: Same PDF uploaded as a new import
- **WHEN** the identical PDF is finalized as a new job for the same restaurant
- **THEN** it receives a distinct import execution identity and its output is
  isolated to that new job, while metadata reveals the matching source hash

### Requirement: Every detected menu element has execution lineage

Every generated category, item, source-evidence record, and image suggestion
MUST reference the claimed `import_job_id` and the same restaurant identity.
Database foreign keys or equivalent constraints MUST prevent an element from
being attached to a different execution or restaurant. A completed analysis
MUST be queryable as one lineage rooted at the job UUID.

#### Scenario: Successful extraction lineage
- **WHEN** an execution produces categories, items, evidence, and image
  suggestions
- **THEN** every resulting row joins to the same job UUID and restaurant, and
  no generated row is orphaned or attached to another import

#### Scenario: Cross-execution write attempt
- **WHEN** a worker attempts to insert or update a draft element using a job or
  restaurant different from its claimed execution
- **THEN** the database rejects the write and the active execution remains the
  only owner of its draft

### Requirement: Execution ownership and retries are durable

The system MUST atomically claim a `pending` or explicitly retried job with a
lease, attempt count, and execution ID before reading or analyzing the PDF.
Only the execution holding the current lease MAY transition the job to
`needs_review` or `failed` or persist final draft data. Expired leases MUST be
recoverable, transient failures MUST use bounded backoff, and exhausted
attempts MUST become terminal failures that are not reprocessed by duplicate
events.

#### Scenario: Concurrent event consumers
- **WHEN** two consumers receive events for the same pending job
- **THEN** one claim succeeds and the other performs no analysis or draft
  writes

#### Scenario: Stale execution completion
- **WHEN** an old execution finishes after its lease expired and a newer
  execution claimed the job
- **THEN** the old execution cannot overwrite the newer status, metadata, or
  draft rows

#### Scenario: Explicit retry
- **WHEN** an administrator explicitly retries a failed import within the
  configured attempt limit
- **THEN** a new analysis execution ID is recorded and the retry remains linked
  to the same import job and source fingerprint

### Requirement: Analysis completion is atomic and reviewable

The system MUST persist all draft categories, items, source evidence, image
suggestions, execution metadata, and the terminal `needs_review` transition in
one consistency boundary after successful analysis. On failure it MUST retain
the job identity and a safe diagnostic code/reason without exposing PDF content
or secrets.

#### Scenario: Successful menu generation
- **WHEN** text/OCR/provider analysis returns valid menu elements
- **THEN** the job becomes `needs_review` and the existing admin review API
  returns only elements belonging to that execution

#### Scenario: Provider or timeout failure
- **WHEN** reading, OCR, parsing, or provider work fails or exceeds its
  deterministic timeout
- **THEN** the execution follows the retry policy and eventually becomes
  `failed` with a bounded diagnostic while never leaving partial draft rows
  presented as complete

### Requirement: Processing is independent of Vercel hosting

The system MUST start analysis through a Supabase-managed event consumer and
MUST NOT require a Vercel Cron schedule. The consumer MUST authenticate
automation requests with a server-only secret, keep service-role credentials
server-side, and expose no client-callable worker endpoint.

#### Scenario: Application hosted outside Vercel
- **WHEN** the Next.js application is deployed to another host while Supabase
  remains configured
- **THEN** finalized imports still trigger analysis and preserve the same job
  and element lineage contract

#### Scenario: Unauthenticated worker call
- **WHEN** a client calls the event consumer without the automation secret
- **THEN** the call is rejected and no import state or draft data changes
