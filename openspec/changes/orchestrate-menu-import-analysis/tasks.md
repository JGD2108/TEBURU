## 1. Queue schema and storage boundaries

- [ ] 1.1 Add an additive Supabase migration for attempt count, next eligible time, processing timestamps, lease expiry, and bounded failure metadata on `menu_import_jobs`.
- [ ] 1.2 Add an index and constraints for eligible claims, terminal states, and lease recovery without weakening restaurant or private-bucket isolation.
- [ ] 1.3 Implement server-only menu-import Storage reader and asset-writer helpers that validate the authorized object path and allowed output MIME types.

## 2. Durable worker state machine

- [ ] 2.1 Refactor `src/lib/menu-import/worker.ts` so claims commit before external work and use exclusive row locking plus lease/attempt guards on completion.
- [ ] 2.2 Add bounded batch processing, stale-lease recovery, exponential retry backoff, and a terminal failure transition after the configured maximum attempts.
- [ ] 2.3 Add deterministic abortable timeouts and typed handling for missing PDFs, OCR/provider configuration errors, malformed output, and unsupported image formats.
- [ ] 2.4 Persist categories, items, evidence, image suggestions, and `needs_review` atomically after successful analysis while preserving tenant boundaries and idempotent recovery.

## 3. Internal trigger and deployment configuration

- [ ] 3.1 Add an authenticated internal menu-import worker route with structured JSON responses, bounded per-invocation work, and safe per-job diagnostics.
- [ ] 3.2 Add the production Vercel Cron schedule and server-only environment-variable checks for the cron secret, Supabase service role, and OCR provider.
- [ ] 3.3 Add a deterministic staging/manual invocation path using the same authorization contract without exposing it to normal admin clients.

## 4. Admin status experience

- [ ] 4.1 Update `MenuImportPanel.tsx` polling to use bounded backoff and stop on `needs_review`, `failed`, `published`, unmount, or import replacement.
- [ ] 4.2 Render safe failure codes/reasons and actionable retry or re-upload guidance for terminal failures.

## 5. Automated verification

- [ ] 5.1 Add worker integration tests for pending-to-processing-to-needs_review with persisted draft categories, items, evidence, and image suggestions.
- [ ] 5.2 Add failure tests for missing source, OCR/provider/parse errors, unsupported assets, timeout cancellation, retry attempts 1/2, and terminal attempt 3.
- [ ] 5.3 Add concurrency and lease tests proving `SKIP LOCKED` exclusive claims, stale recovery, no-work responses, and stale-worker completion guards.
- [ ] 5.4 Add trigger route tests for authorization, batch limits, structured counts, and safe error envelopes; add polling component tests with fake timers.
- [ ] 5.5 Add a production-like E2E test covering upload, finalize, protected worker trigger, pending/processing status, and review UI or bounded failure.

## 6. Migration and operational validation

- [ ] 6.1 Verify the migration against a Supabase database and confirm private Storage policies, required buckets, and tenant-scoped paths.
- [ ] 6.2 Run unit, integration, build, lint, OpenSpec validation, and the worker E2E test with deployment-like environment variables.
- [ ] 6.3 Document cron cadence, timeout/lease/retry settings, structured log fields, manual trigger procedure, and rollback steps for operators.
