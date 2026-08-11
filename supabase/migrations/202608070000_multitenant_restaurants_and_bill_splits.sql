-- Phase 7: multi-restaurant isolation, self-service onboarding and bill splits.
CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  logo_url TEXT,
  primary_color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE platform_admins (
  user_id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A stable default preserves every existing row during the rollout.
INSERT INTO restaurants (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Restaurante inicial', 'restaurante-inicial')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE staff ADD COLUMN restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;
ALTER TABLE tables ADD COLUMN restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;
ALTER TABLE sessions ADD COLUMN restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;
ALTER TABLE session_users ADD COLUMN restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;
ALTER TABLE menu_categories ADD COLUMN restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;
ALTER TABLE menu_items ADD COLUMN restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;
ALTER TABLE orders ADD COLUMN restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;
ALTER TABLE order_items ADD COLUMN restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;
ALTER TABLE restaurant_settings ADD COLUMN restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;
ALTER TABLE kitchen_stations ADD COLUMN restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;

UPDATE staff SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;
UPDATE tables SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;
UPDATE sessions SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;
UPDATE session_users su SET restaurant_id = s.restaurant_id FROM sessions s WHERE su.session_id = s.id AND su.restaurant_id IS NULL;
UPDATE menu_categories SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;
UPDATE menu_items mi SET restaurant_id = mc.restaurant_id FROM menu_categories mc WHERE mi.category_id = mc.id AND mi.restaurant_id IS NULL;
UPDATE orders o SET restaurant_id = s.restaurant_id FROM sessions s WHERE o.session_id = s.id AND o.restaurant_id IS NULL;
UPDATE order_items oi SET restaurant_id = o.restaurant_id FROM orders o WHERE oi.order_id = o.id AND oi.restaurant_id IS NULL;
UPDATE restaurant_settings SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;
UPDATE kitchen_stations SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;

ALTER TABLE staff ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE tables ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE sessions ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE session_users ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE menu_categories ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE menu_items ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE orders ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE order_items ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE restaurant_settings ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE kitchen_stations ALTER COLUMN restaurant_id SET NOT NULL;

ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_user_id_key;
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_email_key;
ALTER TABLE tables DROP CONSTRAINT IF EXISTS tables_table_number_key;
ALTER TABLE menu_categories DROP CONSTRAINT IF EXISTS menu_categories_name_key;
CREATE UNIQUE INDEX staff_restaurant_user_unique ON staff (restaurant_id, user_id);
CREATE UNIQUE INDEX staff_restaurant_email_unique ON staff (restaurant_id, email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX tables_restaurant_number_unique ON tables (restaurant_id, table_number);
CREATE UNIQUE INDEX categories_restaurant_name_unique ON menu_categories (restaurant_id, lower(name));
CREATE UNIQUE INDEX settings_restaurant_unique ON restaurant_settings (restaurant_id);
CREATE UNIQUE INDEX kitchen_stations_restaurant_name_unique ON kitchen_stations (restaurant_id, lower(name));
DROP INDEX IF EXISTS kitchen_stations_name_unique;

CREATE TABLE bill_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES session_users(id),
  mode TEXT NOT NULL CHECK (mode IN ('own_items', 'equal', 'custom')),
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'acknowledged', 'completed', 'cancelled')),
  total NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bill_split_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_split_id UUID NOT NULL REFERENCES bill_splits(id) ON DELETE CASCADE,
  session_user_id UUID NOT NULL REFERENCES session_users(id) ON DELETE RESTRICT,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  UNIQUE (bill_split_id, session_user_id)
);
CREATE INDEX bill_splits_restaurant_status ON bill_splits (restaurant_id, status, created_at DESC);
CREATE INDEX bill_splits_session ON bill_splits (session_id, created_at DESC);

-- Public tables stay protected; browser clients use the authenticated route handlers.
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_split_participants ENABLE ROW LEVEL SECURITY;
