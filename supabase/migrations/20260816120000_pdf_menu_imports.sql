-- Staged, restaurant-isolated PDF menu imports. Draft data never writes live menu tables.
CREATE TABLE menu_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'needs_review', 'failed', 'published')),
  source_storage_path TEXT NOT NULL,
  source_filename TEXT NOT NULL,
  source_size_bytes BIGINT NOT NULL CHECK (source_size_bytes > 0),
  failure_reason TEXT,
  provider_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ,
  published_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX menu_import_jobs_restaurant_created_idx ON menu_import_jobs (restaurant_id, created_at DESC);

CREATE TABLE menu_import_draft_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id UUID NOT NULL REFERENCES menu_import_jobs(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  confidence NUMERIC(4,3),
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'excluded', 'published')),
  source_page INTEGER CHECK (source_page > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX menu_import_draft_categories_name_idx ON menu_import_draft_categories (import_job_id, lower(name));

CREATE TABLE menu_import_draft_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id UUID NOT NULL REFERENCES menu_import_jobs(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  draft_category_id UUID REFERENCES menu_import_draft_categories(id) ON DELETE SET NULL,
  name TEXT, description TEXT, price NUMERIC(10,2) CHECK (price >= 0),
  field_confidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'excluded', 'published')),
  published_menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX menu_import_draft_items_job_idx ON menu_import_draft_items (import_job_id, review_status);

CREATE TABLE menu_import_source_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id UUID NOT NULL REFERENCES menu_import_jobs(id) ON DELETE CASCADE,
  draft_item_id UUID REFERENCES menu_import_draft_items(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL CHECK (page_number > 0),
  excerpt TEXT, bounding_box JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE menu_import_image_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id UUID NOT NULL REFERENCES menu_import_jobs(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  draft_item_id UUID REFERENCES menu_import_draft_items(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL, mime_type TEXT NOT NULL,
  association_confidence NUMERIC(4,3), approved BOOLEAN NOT NULL DEFAULT false,
  published_url TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX menu_import_image_suggestions_job_idx ON menu_import_image_suggestions (import_job_id);

ALTER TABLE menu_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_import_draft_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_import_draft_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_import_source_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_import_image_suggestions ENABLE ROW LEVEL SECURITY;

-- Storage is private. These policies apply on Supabase; the local PostgreSQL
-- migration verifier does not provide the storage schema.
DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL AND to_regprocedure('auth.uid()') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('menu-imports', 'menu-imports', false, 20971520, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
    ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
    EXECUTE 'DROP POLICY IF EXISTS menu_imports_staff_isolation ON storage.objects';
    EXECUTE $policy$
      CREATE POLICY menu_imports_staff_isolation ON storage.objects FOR ALL TO authenticated
      USING (bucket_id = 'menu-imports' AND EXISTS (
        SELECT 1 FROM public.staff s
        WHERE s.user_id = auth.uid() AND name LIKE ('restaurants/' || s.restaurant_id::text || '/%')
      ))
      WITH CHECK (bucket_id = 'menu-imports' AND EXISTS (
        SELECT 1 FROM public.staff s
        WHERE s.user_id = auth.uid() AND name LIKE ('restaurants/' || s.restaurant_id::text || '/%')
      ))
    $policy$;
  END IF;
END $$;
