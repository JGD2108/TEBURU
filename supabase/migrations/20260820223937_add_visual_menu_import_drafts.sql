-- Additive visual-extraction storage. Existing flat draft columns stay canonical
-- for backwards-compatible review and append-publication until each draft is edited.
ALTER TABLE public.menu_import_draft_categories
  ADD COLUMN IF NOT EXISTS parent_draft_category_id UUID,
  ADD COLUMN IF NOT EXISTS extraction_key TEXT,
  ADD COLUMN IF NOT EXISTS raw_name TEXT,
  ADD COLUMN IF NOT EXISTS source_bbox JSONB,
  ADD COLUMN IF NOT EXISTS extraction_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS confidence_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS review_reasons JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.menu_import_draft_categories
  ADD CONSTRAINT menu_import_draft_categories_lineage_unique UNIQUE (id, import_job_id, restaurant_id);
ALTER TABLE public.menu_import_draft_items
  ADD CONSTRAINT menu_import_draft_items_lineage_unique UNIQUE (id, import_job_id, restaurant_id);
ALTER TABLE public.menu_import_draft_categories
  ADD CONSTRAINT menu_import_draft_categories_parent_same_import_fkey
    FOREIGN KEY (parent_draft_category_id, import_job_id, restaurant_id)
    REFERENCES public.menu_import_draft_categories (id, import_job_id, restaurant_id)
    ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS menu_import_draft_categories_extraction_key_idx
  ON public.menu_import_draft_categories (import_job_id, extraction_key) WHERE extraction_key IS NOT NULL;

ALTER TABLE public.menu_import_draft_items
  ADD COLUMN IF NOT EXISTS raw_name TEXT,
  ADD COLUMN IF NOT EXISTS raw_description TEXT,
  ADD COLUMN IF NOT EXISTS raw_price TEXT,
  ADD COLUMN IF NOT EXISTS normalized_currency TEXT,
  ADD COLUMN IF NOT EXISTS shared_price_provenance TEXT,
  ADD COLUMN IF NOT EXISTS source_page INTEGER,
  ADD COLUMN IF NOT EXISTS source_bbox JSONB,
  ADD COLUMN IF NOT EXISTS extraction_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS modifiers JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS options JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS validation_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS review_reasons JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.menu_import_draft_price_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id UUID NOT NULL,
  restaurant_id UUID NOT NULL,
  draft_item_id UUID NOT NULL,
  label TEXT,
  raw_price TEXT NOT NULL,
  normalized_amount NUMERIC(12,2),
  normalized_currency TEXT,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  source_page INTEGER,
  source_bbox JSONB,
  confidence NUMERIC(4,3),
  review_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT menu_import_draft_price_variants_item_lineage_fkey
    FOREIGN KEY (draft_item_id, import_job_id, restaurant_id)
    REFERENCES public.menu_import_draft_items (id, import_job_id, restaurant_id) ON DELETE CASCADE,
  CONSTRAINT menu_import_draft_price_variants_idempotency_unique UNIQUE (import_job_id, idempotency_key),
  CONSTRAINT menu_import_draft_price_variants_amount_check CHECK (normalized_amount IS NULL OR normalized_amount >= 0)
);
CREATE INDEX IF NOT EXISTS menu_import_draft_price_variants_item_idx ON public.menu_import_draft_price_variants (draft_item_id, sort_order);

CREATE TABLE IF NOT EXISTS public.menu_import_document_metadata (
  import_job_id UUID PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  document_title TEXT,
  document_language TEXT,
  document_currency TEXT,
  page_count INTEGER,
  price_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT menu_import_document_metadata_job_restaurant_fkey
    FOREIGN KEY (import_job_id, restaurant_id) REFERENCES public.menu_import_jobs (id, restaurant_id) ON DELETE CASCADE,
  CONSTRAINT menu_import_document_metadata_page_count_check CHECK (page_count IS NULL OR page_count > 0)
);

ALTER TABLE public.menu_import_source_evidence
  ADD COLUMN IF NOT EXISTS source_bbox JSONB,
  ADD COLUMN IF NOT EXISTS evidence_type TEXT NOT NULL DEFAULT 'item',
  ADD COLUMN IF NOT EXISTS region_label TEXT;

ALTER TABLE public.menu_import_analysis_runs
  ADD COLUMN IF NOT EXISTS prompt_version TEXT,
  ADD COLUMN IF NOT EXISTS page_count INTEGER,
  ADD COLUMN IF NOT EXISTS provider_call_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS input_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS output_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS suspicious_pages JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS extracted_item_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_item_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fallback_reasons JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.menu_import_draft_price_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_import_document_metadata ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.menu_import_draft_price_variants, public.menu_import_document_metadata FROM anon, authenticated;

-- Source PDFs and extracted private assets are server-owned. Admin HTTP routes
-- perform the tenant check; authenticated staff must not receive direct bucket
-- access merely because they belong to the restaurant.
DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL AND to_regprocedure('auth.uid()') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS menu_imports_staff_isolation ON storage.objects';
    EXECUTE $policy$
      CREATE POLICY menu_imports_admin_isolation ON storage.objects FOR ALL TO authenticated
      USING (bucket_id = 'menu-imports' AND EXISTS (
        SELECT 1 FROM public.staff s
        WHERE s.user_id = auth.uid() AND s.role = 'admin'
          AND name LIKE ('restaurants/' || s.restaurant_id::text || '/%')
      ))
      WITH CHECK (bucket_id = 'menu-imports' AND EXISTS (
        SELECT 1 FROM public.staff s
        WHERE s.user_id = auth.uid() AND s.role = 'admin'
          AND name LIKE ('restaurants/' || s.restaurant_id::text || '/%')
      ))
    $policy$;
  END IF;
END $$;
