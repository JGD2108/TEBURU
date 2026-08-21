ALTER TABLE public.menu_import_analysis_runs
  ADD COLUMN IF NOT EXISTS structural_metrics JSONB NOT NULL DEFAULT '{}'::jsonb;
