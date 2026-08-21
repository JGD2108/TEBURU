# Event-driven menu analysis

Finalizing a PDF inserts one `menu_import_jobs` row. Supabase sends an
`AFTER INSERT` webhook containing only that job UUID to the
`menu-import-analysis` Edge Function. The function validates the event and
forwards it to the deployed Node route `/api/internal/menu-import-analysis`,
which claims and analyzes the job.

Configure these values as server-side secrets:

- Supabase Vault: `menu_import_worker_url` (the Edge Function URL) and
  `menu_import_automation_key` (the webhook secret sent by the database).
- Edge Function secrets: `MENU_IMPORT_WEBHOOK_SECRET`,
  `MENU_IMPORT_WORKER_TARGET_URL`, and `MENU_IMPORT_AUTOMATION_SECRET`.
- Next/Node environment: `MENU_IMPORT_AUTOMATION_SECRET`,
  `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, and
  `MENU_IMPORT_OCR_ENDPOINT` when OCR is required.

## Visual Gemini extraction and operational controls

Gemini is disabled unless a server-only key is configured. Set
`MENU_IMPORT_GEMINI_API_KEY` in Vercel/Node environments; `GEMINI_KEY` is a
local compatibility alias. Never use a `NEXT_PUBLIC_` prefix or commit either
key. `MENU_IMPORT_GEMINI_MODEL` defaults to `gemini-2.5-flash`, and
`MENU_IMPORT_GEMINI_TIMEOUT_MS` defaults to `8000` milliseconds.

The visual analyzer sends bounded rendered page images and page-scoped auxiliary
text only. It never sends unrelated tenant data, database credentials, or the
source PDF as an opaque upload. Configure limits with
`MENU_IMPORT_RENDER_MAX_PAGES`, `MENU_IMPORT_RENDER_MAX_WIDTH`,
`MENU_IMPORT_RENDER_MAX_HEIGHT`, `MENU_IMPORT_RENDER_MAX_BYTES`,
`MENU_IMPORT_MAX_PROVIDER_CALLS`, and `MENU_IMPORT_MAX_RETRIES_PER_PAGE`.
Defaults and deployment values must be selected for the host timeout and Gemini
quota; do not increase them merely for a single menu fixture.

Version analyzer behavior independently with `MENU_IMPORT_ANALYZER_VERSION`
(default `menu-import-v4-visual`; set `menu-import-v3-visual` for rollback) and prompt behavior with
`MENU_IMPORT_GEMINI_PROMPT_VERSION` (default `visual-v1`). Roll back by setting
the earlier analyzer version/fallback control; schema migrations are additive
and must remain in place. Each completed run records analyzer/prompt version,
model, source hash, page/call/retry counts, duration, token counts when the
provider reports them, suspicious pages, item/review counts, fallback reasons,
and safe error codes. Use these fields for cost and quality monitoring; do not
log provider request bodies or raw provider errors.

### Visual architecture rollout and provider boundary

The analysis provider has an explicit two-stage rollout. Stage 1 is the default:
it preserves the current request composition while recording a server-generated
analysis run, render metadata/hash, provider request/raw/decode/validation
events, candidate IDs, and reconciliation events. Verify this trace for each
candidate before changing behavior.

Stage 2 is intentionally disabled unless all three server-only controls are
set: `MENU_IMPORT_ANALYZER_VERSION=menu-import-v4-visual`,
`MENU_IMPORT_VISUAL_ARCHITECTURE_STAGE=2`, and
`MENU_IMPORT_STAGE1_LINEAGE_VERIFIED=true`. In Stage 2 the primary Gemini
request contains the rendered image, schema/instructions, page number, and
technical metadata only; native/OCR/selected text is retained as bounded
evidence and is eligible only for a targeted retry. It cannot establish visual
boundaries.

Textual fallback starts each page with an empty category state and returns
reviewable evidence (`provider_fallback`) instead of an indistinguishable
visual success. It is used when rendering or Gemini is unavailable; it does
not authorize a clean draft merely because text was extracted. Raw provider
payloads are hashed and may be retained in bounded diagnostics for
`MENU_IMPORT_LINEAGE_RAW_RETENTION_DAYS` (default 7); credentials and images
are never copied into those events.

The `menu-imports` bucket is private. PDFs and generated import assets must use
the `restaurants/<restaurant-id>/...` prefix. Browser access is only through an
authenticated restaurant-scoped admin endpoint that issues a short-lived signed
URL. The service-role key is server-only and may bypass Storage RLS, so it must
never be included in responses, client bundles, logs, or `NEXT_PUBLIC_*` values.
Storage object cleanup is best effort after the database record is deleted;
periodically inspect orphaned prefixes and apply the retention policy in the
storage provider without deleting active import records.

Before deployment, verify that the Node/Vercel environment has
`DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
`MENU_IMPORT_AUTOMATION_SECRET`, and the selected Gemini variables only as
server-side secrets. Verify that the bucket is non-public, allows only PDFs and
approved image MIME types, and that a staff member cannot obtain a signed URL
for a different restaurant's import. Do not print secret values during this
check.

The worker uses `menu_import_jobs.id` as the import execution root and records a
unique `analysis_execution_id` for each attempt. Categories, items, evidence,
and image suggestions must retain that job UUID and restaurant ID. Duplicate
webhook deliveries are acknowledged without a second claim. Failed jobs can be
replayed through the authenticated admin retry action.

No menu-import Vercel Cron is required. The Edge Function forwards to whatever
Node host currently runs the application, so changing hosts only requires
updating `MENU_IMPORT_WORKER_TARGET_URL` and the Vault webhook URL.
