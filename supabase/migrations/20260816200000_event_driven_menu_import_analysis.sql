-- Event-driven, execution-scoped lineage for private menu-import analysis.
-- Requires two Vault secrets configured outside migrations:
--   menu_import_worker_url  (the deployed Edge Function URL)
--   menu_import_automation_key (the Edge Function webhook secret)
-- The Edge Function forwards to MENU_IMPORT_WORKER_TARGET_URL with the
-- private Node MENU_IMPORT_AUTOMATION_SECRET; none of these values are client-side.

ALTER TABLE menu_import_jobs
  ADD COLUMN IF NOT EXISTS source_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS analyzer_version TEXT,
  ADD COLUMN IF NOT EXISTS analysis_execution_id UUID,
  ADD COLUMN IF NOT EXISTS analysis_lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS analysis_attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS analysis_available_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE menu_import_draft_items
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

ALTER TABLE menu_import_source_evidence
  ADD COLUMN IF NOT EXISTS restaurant_id UUID,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

ALTER TABLE menu_import_image_suggestions
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- pgcrypto may be installed in public locally or extensions on Supabase. Resolve
-- its actual schema from the catalog rather than relying on the session search_path.
-- The preflight and every backfill execute before non-null, unique, or lineage
-- constraints are added, so a failure rolls the entire migration back cleanly.
DO $$
DECLARE
  pgcrypto_schema TEXT;
  digest_function TEXT;
BEGIN
  SELECT namespace.nspname
  INTO pgcrypto_schema
  FROM pg_extension extension
  JOIN pg_namespace namespace ON namespace.oid = extension.extnamespace
  WHERE extension.extname = 'pgcrypto';

  IF pgcrypto_schema IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'menu-import lineage migration requires pgcrypto digest(text, text): pgcrypto extension is not installed';
  END IF;

  IF to_regprocedure(format('%I.digest(text,text)', pgcrypto_schema)) IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = format('menu-import lineage migration requires pgcrypto digest(text, text): capability is unavailable in schema %I', pgcrypto_schema);
  END IF;

  digest_function := format('%I.digest', pgcrypto_schema);

  EXECUTE format($backfill$
    UPDATE menu_import_draft_items
    SET idempotency_key = COALESCE(
      idempotency_key,
      encode(%1$s(concat_ws('|', import_job_id, COALESCE(draft_category_id::text, ''), COALESCE(name, ''), COALESCE(description, ''), COALESCE(price::text, '')), 'sha256'), 'hex')
    )
  $backfill$, digest_function);

  EXECUTE format($backfill$
    UPDATE menu_import_source_evidence AS evidence
    SET restaurant_id = COALESCE(evidence.restaurant_id, job.restaurant_id),
        idempotency_key = COALESCE(
          evidence.idempotency_key,
          encode(%1$s(concat_ws('|', evidence.import_job_id, evidence.draft_item_id, evidence.page_number, COALESCE(evidence.excerpt, '')), 'sha256'), 'hex')
        )
    FROM menu_import_jobs AS job
    WHERE job.id = evidence.import_job_id
      AND (evidence.restaurant_id IS NULL OR evidence.idempotency_key IS NULL)
  $backfill$, digest_function);

  EXECUTE format($backfill$
    UPDATE menu_import_image_suggestions
    SET idempotency_key = COALESCE(
      idempotency_key,
      encode(%1$s(concat_ws('|', import_job_id, storage_path), 'sha256'), 'hex')
    )
  $backfill$, digest_function);
END;
$$;

ALTER TABLE menu_import_jobs
  ADD CONSTRAINT menu_import_jobs_id_restaurant_unique UNIQUE (id, restaurant_id);

ALTER TABLE menu_import_draft_categories
  ADD CONSTRAINT menu_import_draft_categories_job_restaurant_fkey
  FOREIGN KEY (import_job_id, restaurant_id)
  REFERENCES menu_import_jobs (id, restaurant_id) ON DELETE CASCADE,
  ADD CONSTRAINT menu_import_draft_categories_id_job_restaurant_unique UNIQUE (id, import_job_id, restaurant_id);

ALTER TABLE menu_import_draft_items
  ALTER COLUMN idempotency_key SET NOT NULL,
  ADD CONSTRAINT menu_import_draft_items_job_restaurant_fkey
  FOREIGN KEY (import_job_id, restaurant_id)
  REFERENCES menu_import_jobs (id, restaurant_id) ON DELETE CASCADE,
  ADD CONSTRAINT menu_import_draft_items_category_lineage_fkey
  FOREIGN KEY (draft_category_id, import_job_id, restaurant_id)
  REFERENCES menu_import_draft_categories (id, import_job_id, restaurant_id),
  ADD CONSTRAINT menu_import_draft_items_id_job_restaurant_unique UNIQUE (id, import_job_id, restaurant_id),
  ADD CONSTRAINT menu_import_draft_items_idempotency_unique UNIQUE (import_job_id, idempotency_key);

ALTER TABLE menu_import_source_evidence
  ALTER COLUMN restaurant_id SET NOT NULL,
  ALTER COLUMN idempotency_key SET NOT NULL,
  ADD CONSTRAINT menu_import_source_evidence_job_restaurant_fkey
  FOREIGN KEY (import_job_id, restaurant_id)
  REFERENCES menu_import_jobs (id, restaurant_id) ON DELETE CASCADE,
  ADD CONSTRAINT menu_import_source_evidence_item_lineage_fkey
  FOREIGN KEY (draft_item_id, import_job_id, restaurant_id)
  REFERENCES menu_import_draft_items (id, import_job_id, restaurant_id),
  ADD CONSTRAINT menu_import_source_evidence_idempotency_unique UNIQUE (import_job_id, idempotency_key);

ALTER TABLE menu_import_image_suggestions
  ALTER COLUMN idempotency_key SET NOT NULL,
  ADD CONSTRAINT menu_import_image_suggestions_job_restaurant_fkey
  FOREIGN KEY (import_job_id, restaurant_id)
  REFERENCES menu_import_jobs (id, restaurant_id) ON DELETE CASCADE,
  ADD CONSTRAINT menu_import_image_suggestions_item_lineage_fkey
  FOREIGN KEY (draft_item_id, import_job_id, restaurant_id)
  REFERENCES menu_import_draft_items (id, import_job_id, restaurant_id),
  ADD CONSTRAINT menu_import_image_suggestions_idempotency_unique UNIQUE (import_job_id, idempotency_key);

CREATE TABLE menu_import_analysis_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id UUID NOT NULL,
  restaurant_id UUID NOT NULL,
  analysis_execution_id UUID NOT NULL UNIQUE,
  attempt INTEGER NOT NULL CHECK (attempt > 0),
  status TEXT NOT NULL CHECK (status IN ('claimed', 'processing', 'completed', 'failed', 'reused')),
  source_sha256 TEXT CHECK (source_sha256 IS NULL OR source_sha256 ~ '^[0-9a-f]{64}$'),
  analyzer_version TEXT NOT NULL,
  lease_expires_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_code TEXT CHECK (error_code IS NULL OR char_length(error_code) <= 100),
  error_reason TEXT CHECK (error_reason IS NULL OR char_length(error_reason) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT menu_import_analysis_runs_job_restaurant_fkey
    FOREIGN KEY (import_job_id, restaurant_id)
    REFERENCES menu_import_jobs (id, restaurant_id) ON DELETE CASCADE,
  CONSTRAINT menu_import_analysis_runs_job_attempt_unique UNIQUE (import_job_id, attempt)
);

CREATE UNIQUE INDEX menu_import_analysis_runs_one_active_per_job_idx
  ON menu_import_analysis_runs (import_job_id)
  WHERE status IN ('claimed', 'processing');
CREATE INDEX menu_import_analysis_runs_reuse_idx
  ON menu_import_analysis_runs (restaurant_id, source_sha256, analyzer_version)
  WHERE status IN ('completed', 'reused');

ALTER TABLE menu_import_analysis_runs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.dispatch_menu_import_analysis()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  worker_url TEXT;
  automation_key TEXT;
BEGIN
  -- A job is queued only after the inserting transaction commits; pg_net keeps
  -- this HTTP dispatch asynchronous and the consumer re-loads the job by UUID.
  IF NEW.status <> 'pending' THEN RETURN NEW; END IF;
  SELECT decrypted_secret INTO worker_url FROM vault.decrypted_secrets WHERE name = 'menu_import_worker_url';
  SELECT decrypted_secret INTO automation_key FROM vault.decrypted_secrets WHERE name = 'menu_import_automation_key';
  IF worker_url IS NULL OR automation_key IS NULL THEN
    RAISE WARNING 'menu import webhook is not configured; job % remains pending', NEW.id;
    RETURN NEW;
  END IF;
  PERFORM net.http_post(
    url := worker_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', automation_key),
    body := jsonb_build_object('type', 'INSERT', 'schema', 'public', 'table', 'menu_import_jobs', 'record', jsonb_build_object('id', NEW.id))
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.dispatch_menu_import_analysis() FROM PUBLIC;
CREATE TRIGGER menu_import_jobs_dispatch_analysis
  AFTER INSERT ON menu_import_jobs
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_menu_import_analysis();
