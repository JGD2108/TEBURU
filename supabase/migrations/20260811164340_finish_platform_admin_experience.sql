ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Bogota';

ALTER TABLE restaurants
  ADD CONSTRAINT restaurants_currency_format CHECK (currency ~ '^[A-Z]{3}$');

CREATE UNIQUE INDEX IF NOT EXISTS bill_splits_one_open_request_per_session
  ON bill_splits (session_id)
  WHERE status IN ('requested', 'acknowledged');

-- Bootstrap the existing restaurant owner as the first Teburu platform operator.
-- Future platform operators are managed explicitly in platform_admins.
INSERT INTO platform_admins (user_id)
SELECT user_id FROM staff WHERE role = 'admin' ORDER BY created_at LIMIT 1
ON CONFLICT (user_id) DO NOTHING;

DROP POLICY IF EXISTS staff_read_self ON staff;
CREATE POLICY staff_read_self ON staff FOR SELECT
USING (user_id = (SELECT auth.uid()));
