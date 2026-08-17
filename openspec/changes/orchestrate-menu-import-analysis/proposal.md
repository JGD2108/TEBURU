## Why

PDF uploads now finalize successfully, but the resulting `menu_import_jobs` rows remain in `pending` indefinitely. The admin panel keeps polling because the analysis worker is implemented but has no production trigger, so users never receive draft categories or items. This change connects the durable job record to a bounded, observable worker execution path.

## What Changes

- Add an authenticated internal worker trigger, scheduled in production, that claims and processes a bounded number of pending menu imports.
- Connect the worker to private Supabase Storage readers and asset writers without exposing service credentials to clients.
- Make job claiming, leases, retries, timeouts, and terminal failure states durable across worker errors and function restarts.
- Preserve the existing `pending → processing → needs_review|failed` contract and persist extracted draft data atomically.
- Define OCR/provider configuration failures and unsupported image formats as diagnosable terminal or retryable outcomes.
- Update admin polling to use bounded backoff and stop on terminal states, including `needs_review`, `failed`, and `published`.
- Add worker, trigger-authentication, concurrency, retry/lease, timeout, and production-like end-to-end coverage.

## Capabilities

### New Capabilities

- `menu-import-analysis-orchestration`: Durable scheduling, worker execution, retry/lease behavior, private Storage access, and observable completion of finalized PDF menu imports.

### Modified Capabilities

- None.

## Impact

- Affected code: `src/lib/menu-import/worker.ts`, new internal worker route, menu-import Storage helpers, admin polling in `MenuImportPanel.tsx`, and related tests.
- Affected infrastructure: `vercel.json` cron configuration and server-only environment variables for the cron secret, Supabase service-role Storage access, and OCR provider when required.
- Affected database: lease, attempt, scheduling, and error metadata needed to recover interrupted jobs safely; existing restaurant isolation and draft publication boundaries remain unchanged.
- No change to the signed upload/finalize contract or to live menu publication behavior.
