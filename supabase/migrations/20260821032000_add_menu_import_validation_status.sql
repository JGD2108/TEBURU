-- Additive semantic status used by v4 projections. Existing review_status remains
-- the human workflow state; extraction_status is the machine quality gate.
ALTER TABLE public.menu_import_draft_items
  ADD COLUMN IF NOT EXISTS extraction_status TEXT NOT NULL DEFAULT 'valid',
  ADD COLUMN IF NOT EXISTS retry_exhausted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.menu_import_draft_items
  ADD CONSTRAINT menu_import_draft_items_extraction_status_check
    CHECK (extraction_status IN ('valid', 'review', 'invalid'));

CREATE INDEX IF NOT EXISTS menu_import_draft_items_extraction_status_idx
  ON public.menu_import_draft_items (import_job_id, extraction_status);
