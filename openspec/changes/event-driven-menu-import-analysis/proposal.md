## Why

The current orchestration proposal depends on a Vercel Cron job, but Vercel
may not remain the application's hosting platform. More importantly, a PDF
should start one identifiable analysis execution as soon as its finalized job
row is committed, and every category, item, evidence record, and image
suggestion must be provably attributable to that execution instead of merely
to a restaurant or filename.

## What Changes

- Replace the planned Vercel Cron dependency with a Supabase Database Webhook
  fired after insertion of a finalized `menu_import_jobs` row.
- Add a Supabase Edge Function (or portable worker adapter behind the same
  contract) that receives only the job UUID, reloads and validates the job and
  private PDF, and claims it atomically before analysis.
- Treat each `menu_import_jobs.id` as the import execution identity and add a
  distinct `analysis_execution_id` for the claimed attempt, with persisted
  analyzer version, source fingerprint, timestamps, and outcome.
- Make webhook delivery idempotent and safe for duplicate or out-of-order
  deliveries; a completed, active, or already-claimed job must not produce
  duplicate drafts or a second analysis execution.
- Enforce that every detected category, item, source-evidence row, and image
  suggestion carries the claimed `import_job_id` and restaurant identity, with
  database constraints preventing cross-execution or cross-tenant linkage.
- Persist a deterministic source hash and analysis metadata so the system can
  answer whether the exact PDF was already analyzed, distinguish a requested
  retry from a duplicate delivery, and reproduce which run produced each
  element.
- Preserve the asynchronous `pending → processing → needs_review|failed`
  contract, including leases, bounded retries, timeout handling, and a safe
  explicit retry path without reintroducing Vercel-specific scheduling.
- Remove the menu-import cron entry from `vercel.json` and document Supabase
  webhook/Edge Function secrets, deployment, and recovery operations.

## Capabilities

### New Capabilities

- `event-driven-menu-import-analysis`: Event-driven execution, idempotent
  analysis runs, exact PDF/run identity, and per-element draft lineage for
  finalized menu imports.

### Modified Capabilities

<!-- No existing main capability spec is being modified; this change replaces
     the unimplemented Vercel-specific orchestration plan. -->

## Impact

- Affected database: additive execution/run metadata, source hash, lease and
  retry fields, indexes, and same-job/same-restaurant constraints for draft
  artifacts; a Supabase Database Webhook on `menu_import_jobs` INSERT.
- Affected runtime: new Supabase Edge Function or portable worker adapter,
  server-only Storage access, provider/OCR configuration, and structured logs.
- Affected application: `finalize` remains asynchronous, while worker status
  and lineage metadata become visible through existing admin detail responses.
- Affected deployment: remove the menu-import Vercel Cron configuration; keep
  the Next.js API usable from any host and make the event payload contain only
  a correlation UUID.
- Affected tests: webhook payload validation, duplicate delivery, atomic claim,
  exact source validation, retry/lease ownership, lineage constraints, and
  upload → finalize → webhook → review E2E coverage.
- No change to signed upload authorization, publication approval semantics, or
  public menu data until an admin explicitly publishes the reviewed draft.
