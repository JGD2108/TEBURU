-- Phase 6: permanent QR identifiers, temporary access codes, and shared table sessions.
ALTER TABLE tables
  ADD COLUMN IF NOT EXISTS capacity INTEGER NOT NULL DEFAULT 2 CHECK (capacity > 0 AND capacity <= 100);

CREATE TABLE session_tables (
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE RESTRICT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, table_id)
);

CREATE UNIQUE INDEX session_tables_one_primary_per_session
  ON session_tables (session_id) WHERE is_primary;

CREATE INDEX session_tables_table_id_idx ON session_tables (table_id, session_id);

-- Preserve a table-to-session audit trail for existing sessions.
INSERT INTO session_tables (session_id, table_id, is_primary)
SELECT id, table_id, true FROM sessions
ON CONFLICT (session_id, table_id) DO NOTHING;

ALTER TABLE session_tables ENABLE ROW LEVEL SECURITY;
