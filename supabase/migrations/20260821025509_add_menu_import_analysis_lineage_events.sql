-- Stage 1 durable lineage is append-only and additive: existing draft/review
-- semantics remain unchanged while any candidate can be traced to an execution.
CREATE TABLE IF NOT EXISTS public.menu_import_analysis_lineage_events (
  id UUID NOT NULL,
  import_job_id UUID NOT NULL,
  restaurant_id UUID NOT NULL,
  analysis_execution_id UUID NOT NULL,
  event_stage TEXT NOT NULL CHECK (event_stage IN ('render', 'provider_request', 'provider_raw', 'decode', 'validation', 'retry', 'reconciliation', 'normalization', 'projection', 'persistence')),
  source_kind TEXT NOT NULL CHECK (source_kind IN ('gemini-visual', 'textual-fallback', 'provider-transient-retry', 'regional-retry', 'synthetic', 'unknown')),
  page_number INTEGER CHECK (page_number IS NULL OR page_number > 0),
  attempt_id UUID,
  parent_attempt_id UUID,
  candidate_id UUID,
  extracted_item_id UUID,
  section_id UUID,
  reconciled_section_id UUID,
  retry_reason TEXT,
  region_id TEXT,
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_payload TEXT,
  raw_payload_hash TEXT CHECK (raw_payload_hash IS NULL OR raw_payload_hash ~ '^[0-9a-f]{64}$'),
  raw_payload_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT menu_import_analysis_lineage_events_execution_fkey
    FOREIGN KEY (analysis_execution_id) REFERENCES public.menu_import_analysis_runs (analysis_execution_id) ON DELETE CASCADE,
  CONSTRAINT menu_import_analysis_lineage_events_job_restaurant_fkey
    FOREIGN KEY (import_job_id, restaurant_id) REFERENCES public.menu_import_jobs (id, restaurant_id) ON DELETE CASCADE,
  CONSTRAINT menu_import_analysis_lineage_events_execution_event_unique UNIQUE (analysis_execution_id, id),
  CONSTRAINT menu_import_analysis_lineage_events_raw_retention_check
    CHECK (raw_payload IS NULL OR raw_payload_expires_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS menu_import_analysis_lineage_events_job_idx
  ON public.menu_import_analysis_lineage_events (import_job_id, restaurant_id, created_at);
CREATE INDEX IF NOT EXISTS menu_import_analysis_lineage_events_candidate_idx
  ON public.menu_import_analysis_lineage_events (candidate_id) WHERE candidate_id IS NOT NULL;

ALTER TABLE public.menu_import_analysis_lineage_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.menu_import_analysis_lineage_events FROM anon, authenticated;
