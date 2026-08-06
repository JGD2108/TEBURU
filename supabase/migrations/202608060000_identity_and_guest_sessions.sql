-- Phase 1: revocable, opaque guest sessions. The raw token is never persisted.
CREATE TABLE guest_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  session_user_id UUID NOT NULL REFERENCES session_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);

CREATE INDEX idx_guest_access_tokens_active_session
  ON guest_access_tokens (session_id, expires_at) WHERE revoked_at IS NULL;

-- RLS is introduced with the API migration for the remaining admin panels.
-- Enabling it here would break their still-legacy read paths before replacements exist.
