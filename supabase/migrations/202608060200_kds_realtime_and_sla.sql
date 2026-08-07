-- Phase 3: realtime KDS notifications, configurable SLA and pickup tracking.

ALTER TABLE kitchen_stations
  ADD COLUMN warning_minutes INTEGER NOT NULL DEFAULT 10 CHECK (warning_minutes > 0),
  ADD COLUMN critical_minutes INTEGER NOT NULL DEFAULT 20 CHECK (critical_minutes > warning_minutes);

ALTER TABLE order_item_stations
  ADD COLUMN warning_minutes INTEGER NOT NULL DEFAULT 10 CHECK (warning_minutes > 0),
  ADD COLUMN critical_minutes INTEGER NOT NULL DEFAULT 20 CHECK (critical_minutes > warning_minutes);

ALTER TABLE order_items
  ADD COLUMN delivered_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION snapshot_order_item_stations()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO order_item_stations
    (order_item_id, station_id, station_name, station_color, warning_minutes, critical_minutes)
  SELECT NEW.id, ks.id, ks.name, ks.color, ks.warning_minutes, ks.critical_minutes
  FROM menu_item_stations mis
  JOIN kitchen_stations ks ON ks.id = mis.station_id AND ks.is_active
  WHERE mis.menu_item_id = NEW.menu_item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Supabase Realtime replaces the per-screen PostgreSQL LISTEN connection.
-- Plain PostgreSQL integration databases do not have this publication, so the
-- block is intentionally conditional.
DO $$
DECLARE
  target_table TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH target_table IN ARRAY ARRAY['order_items', 'kitchen_stations', 'menu_item_stations']
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = target_table
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', target_table);
      END IF;
    END LOOP;
  END IF;
END $$;
