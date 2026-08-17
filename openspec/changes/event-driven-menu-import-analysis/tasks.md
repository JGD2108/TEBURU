## 1. Execution identity and lineage schema

- [x] 1.1 Create an additive Supabase migration for `menu_import_analysis_runs` with job UUID, analysis execution UUID, attempt, source hash, analyzer/provider version, lease, timestamps, status, and bounded error fields.
- [x] 1.2 Add indexes and uniqueness rules that make one attempt/execution claimable per job while allowing explicitly authorized retries.
- [x] 1.3 Add same-job/same-restaurant composite foreign keys and idempotency keys for categories, items, evidence, image suggestions, and their parent relationships.
- [x] 1.4 Add source fingerprint and lineage fields to the job/detail response without exposing private PDF contents or secrets.

## 2. Supabase event trigger and secure consumer

- [x] 2.1 Add the `AFTER INSERT` Database Webhook for finalized `menu_import_jobs` rows and configure it to send only the job UUID plus the automation secret.
- [x] 2.2 Implement the Supabase Edge Function or portable Deno-compatible consumer with event/table/schema validation, server-side job reload, private Storage PDF validation, and structured request/job logging.
- [x] 2.3 Implement an atomic `pending → processing` claim that records `analysis_execution_id`, attempt, lease, and analyzer version before external analysis; duplicate deliveries must no-op.
- [x] 2.4 Enforce server-only automation/service-role secrets and reject direct browser calls or malformed webhook payloads.

## 3. Analysis, reuse, and durable state machine

- [x] 3.1 Compute and persist the source SHA-256 after downloading the exact authorized object, including the analyzer/provider version in the reuse key.
- [x] 3.2 Detect a prior successful matching run and copy/reuse its output under the new job UUID with a `reused` run outcome; never reuse failed or partial output.
- [x] 3.3 Connect the existing PDF/text/OCR/provider pipeline to the claimed execution with deterministic timeout, bounded retries, lease recovery, and stale-execution write guards.
- [x] 3.4 Persist all generated draft elements and the final `needs_review` transition atomically; failed attempts must leave no partial draft presented as complete.
- [x] 3.5 Namespace temporary extracted assets by job and attempt, convert or omit unsupported MIME formats, and clean up unreferenced temporary objects safely.

## 4. Retry and operator controls

- [x] 4.1 Add an authenticated admin/operator replay action for pending or eligible failed jobs that creates a new attempt without accepting arbitrary client-triggered worker calls.
- [x] 4.2 Add lease-expiry recovery, retry backoff, terminal failure classification, and structured events for received, claimed, duplicate, reused, completed, failed, and recovered states.
- [x] 4.3 Remove the menu-import Vercel Cron entry and document Supabase webhook, Edge Function, Storage, OCR, and automation-secret configuration.

## 5. Verification and lineage proof

- [x] 5.1 Add webhook tests for wrong schema/table/event, invalid UUID, cross-tenant path, missing/non-PDF object, valid insert, and authentication failures.
- [x] 5.2 Add concurrency/idempotency tests proving duplicate deliveries yield one claim, one execution owner, and no duplicate categories, items, evidence, or suggestions.
- [x] 5.3 Add retry/lease/timeout tests proving stale execution writes are rejected, attempt limits terminate, and explicit retries preserve job and source lineage.
- [x] 5.4 Add source-hash reuse tests for same PDF/same analyzer version, changed analyzer version, different restaurant, and failed/partial prior runs.
- [x] 5.5 Add an acceptance query/test asserting every generated element joins to the exact import job UUID and restaurant, with zero cross-execution or orphan rows.
- [ ] 5.6 Add deployment-like E2E coverage for upload → finalize → Supabase webhook → analysis run → `needs_review`/`failed` → review UI, and benchmark the real PDF against the selected Edge/worker runtime limits.
  <!-- Pending deployment credentials/runtime: DATABASE_URL, Supabase webhook secrets, and a deployed target URL. -->
