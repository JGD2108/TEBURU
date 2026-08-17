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

The worker uses `menu_import_jobs.id` as the import execution root and records a
unique `analysis_execution_id` for each attempt. Categories, items, evidence,
and image suggestions must retain that job UUID and restaurant ID. Duplicate
webhook deliveries are acknowledged without a second claim. Failed jobs can be
replayed through the authenticated admin retry action.

No menu-import Vercel Cron is required. The Edge Function forwards to whatever
Node host currently runs the application, so changing hosts only requires
updating `MENU_IMPORT_WORKER_TARGET_URL` and the Vault webhook URL.
