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

## Optional Gemini text structuring

Gemini is disabled unless a server-only key is configured. Set
`MENU_IMPORT_GEMINI_API_KEY` in Vercel/Node environments; `GEMINI_KEY` is a
local compatibility alias. Never use a `NEXT_PUBLIC_` prefix or commit either
key. `MENU_IMPORT_GEMINI_MODEL` defaults to `gemini-2.5-flash`, and
`MENU_IMPORT_GEMINI_TIMEOUT_MS` defaults to `8000` milliseconds.

Only page-numbered text extracted from the PDF is sent to Gemini. Source PDF
bytes, rendered pages, extracted image assets, credentials, and raw provider
errors are never sent or exposed. Each analysis run records its structure
provider, Gemini model when applicable, and a bounded sanitized fallback
reason so the review endpoint can distinguish Gemini output from local parsing.

The worker uses `menu_import_jobs.id` as the import execution root and records a
unique `analysis_execution_id` for each attempt. Categories, items, evidence,
and image suggestions must retain that job UUID and restaurant ID. Duplicate
webhook deliveries are acknowledged without a second claim. Failed jobs can be
replayed through the authenticated admin retry action.

No menu-import Vercel Cron is required. The Edge Function forwards to whatever
Node host currently runs the application, so changing hosts only requires
updating `MENU_IMPORT_WORKER_TARGET_URL` and the Vault webhook URL.
