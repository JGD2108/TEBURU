-- The original event-driven migration installed a trigger that calls pg_net,
-- but pg_net is not enabled automatically on every Supabase project. Pause
-- dispatch while this migration establishes and verifies that dependency.
ALTER TABLE public.menu_import_jobs DISABLE TRIGGER menu_import_jobs_dispatch_analysis;

-- Supabase enables extensions through CREATE EXTENSION. pg_net is registered
-- in `extensions`, while its request API intentionally owns the `net` schema.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'menu-import dispatch requires the pg_net extension',
      HINT = 'Enable pg_net in the Supabase Database Extensions page and rerun this migration.';
  END IF;

  IF to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'menu-import dispatch requires net.http_post(text,jsonb,jsonb,jsonb,integer)',
      DETAIL = 'pg_net is installed but its asynchronous HTTP API is unavailable in the net schema.',
      HINT = 'Check the pg_net installation and contact Supabase support if the extension cannot create its net schema.';
  END IF;
END;
$$;

ALTER TABLE public.menu_import_jobs ENABLE TRIGGER menu_import_jobs_dispatch_analysis;
