-- Short-lived server-authorized direct uploads. Service-role APIs own this table;
-- RLS remains enabled as defense in depth because it is in the public schema.
CREATE TABLE menu_import_upload_authorizations (
  id UUID PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  source_filename TEXT NOT NULL,
  expected_size_bytes BIGINT NOT NULL CHECK (expected_size_bytes > 0 AND expected_size_bytes <= 20971520),
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  import_job_id UUID REFERENCES menu_import_jobs(id) ON DELETE SET NULL,
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX menu_import_upload_authorizations_expiry_idx ON menu_import_upload_authorizations (expires_at) WHERE import_job_id IS NULL;
CREATE INDEX menu_import_upload_authorizations_restaurant_idx ON menu_import_upload_authorizations (restaurant_id, created_at DESC);
ALTER TABLE menu_import_upload_authorizations ENABLE ROW LEVEL SECURITY;
