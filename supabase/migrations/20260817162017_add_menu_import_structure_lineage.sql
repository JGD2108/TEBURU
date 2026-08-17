-- Preserve the specific structure provider independently from the broader
-- analyzer version used for source-hash reuse. Existing runs were structured
-- locally, so the non-null default is backward compatible.
ALTER TABLE public.menu_import_analysis_runs
  ADD COLUMN IF NOT EXISTS structure_provider TEXT NOT NULL DEFAULT 'local-fallback',
  ADD COLUMN IF NOT EXISTS structure_model TEXT,
  ADD COLUMN IF NOT EXISTS structure_fallback_reason TEXT;

ALTER TABLE public.menu_import_analysis_runs
  ADD CONSTRAINT menu_import_analysis_runs_structure_provider_check
    CHECK (structure_provider IN ('gemini', 'local-fallback')),
  ADD CONSTRAINT menu_import_analysis_runs_structure_model_check
    CHECK (structure_model IS NULL OR char_length(structure_model) <= 100),
  ADD CONSTRAINT menu_import_analysis_runs_structure_fallback_reason_check
    CHECK (structure_fallback_reason IS NULL OR char_length(structure_fallback_reason) <= 200),
  ADD CONSTRAINT menu_import_analysis_runs_gemini_model_check
    CHECK (structure_provider <> 'gemini' OR structure_model IS NOT NULL);
