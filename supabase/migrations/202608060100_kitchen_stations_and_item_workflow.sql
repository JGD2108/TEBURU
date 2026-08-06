-- Phase 2: configurable kitchen stations and item-level KDS workflow.

CREATE TABLE kitchen_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#ff6b35'
    CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX kitchen_stations_name_unique
  ON kitchen_stations (lower(name));
CREATE INDEX kitchen_stations_active_order
  ON kitchen_stations (is_active, sort_order, name);

CREATE TABLE menu_item_stations (
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  station_id UUID NOT NULL REFERENCES kitchen_stations(id) ON DELETE CASCADE,
  PRIMARY KEY (menu_item_id, station_id)
);

-- Snapshot routing on each ordered item so later menu configuration changes do
-- not move live or historical tickets between stations.
CREATE TABLE order_item_stations (
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  station_id UUID NOT NULL,
  station_name TEXT NOT NULL,
  station_color VARCHAR(7) NOT NULL,
  PRIMARY KEY (order_item_id, station_id)
);

ALTER TABLE order_items
  ADD COLUMN kitchen_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (kitchen_status IN ('pending', 'preparing', 'ready', 'cancelled')),
  ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal', 'high', 'urgent')),
  ADD COLUMN started_at TIMESTAMPTZ,
  ADD COLUMN ready_at TIMESTAMPTZ,
  ADD COLUMN version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0);

UPDATE order_items oi
SET kitchen_status = CASE o.status
  WHEN 'preparing' THEN 'preparing'
  WHEN 'ready' THEN 'ready'
  WHEN 'delivered' THEN 'ready'
  WHEN 'cancelled' THEN 'cancelled'
  ELSE 'pending'
END,
started_at = CASE WHEN o.status IN ('preparing', 'ready', 'delivered') THEN o.created_at END,
ready_at = CASE WHEN o.status IN ('ready', 'delivered') THEN o.created_at END
FROM orders o
WHERE o.id = oi.order_id;

CREATE INDEX order_items_kds_status ON order_items (kitchen_status, priority);
CREATE INDEX menu_item_stations_station ON menu_item_stations (station_id, menu_item_id);
CREATE INDEX order_item_stations_station ON order_item_stations (station_id, order_item_id);

INSERT INTO order_item_stations (order_item_id, station_id, station_name, station_color)
SELECT oi.id, ks.id, ks.name, ks.color
FROM order_items oi
JOIN menu_item_stations mis ON mis.menu_item_id = oi.menu_item_id
JOIN kitchen_stations ks ON ks.id = mis.station_id;

CREATE OR REPLACE FUNCTION snapshot_order_item_stations()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO order_item_stations (order_item_id, station_id, station_name, station_color)
  SELECT NEW.id, ks.id, ks.name, ks.color
  FROM menu_item_stations mis
  JOIN kitchen_stations ks ON ks.id = mis.station_id AND ks.is_active
  WHERE mis.menu_item_id = NEW.menu_item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_items_snapshot_stations
AFTER INSERT ON order_items
FOR EACH ROW EXECUTE FUNCTION snapshot_order_item_stations();

CREATE TABLE order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
  actor_staff_id UUID REFERENCES staff(user_id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX order_events_order_created ON order_events (order_id, created_at DESC);
CREATE INDEX order_events_item_created ON order_events (order_item_id, created_at DESC);

CREATE OR REPLACE FUNCTION sync_order_status_from_items()
RETURNS TRIGGER AS $$
DECLARE
  target_order_id UUID := COALESCE(NEW.order_id, OLD.order_id);
  target_status TEXT;
BEGIN
  SELECT CASE
    WHEN bool_and(kitchen_status = 'cancelled') THEN 'cancelled'
    WHEN bool_and(kitchen_status IN ('ready', 'cancelled')) THEN 'ready'
    WHEN bool_or(kitchen_status = 'preparing') OR bool_or(kitchen_status = 'ready') THEN 'preparing'
    ELSE 'pending'
  END
  INTO target_status
  FROM order_items
  WHERE order_id = target_order_id;

  UPDATE orders
  SET status = target_status
  WHERE id = target_order_id
    AND status NOT IN ('delivered', 'cancelled')
    AND target_status IS NOT NULL;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_items_sync_order_status
AFTER INSERT OR UPDATE OF kitchen_status OR DELETE ON order_items
FOR EACH ROW EXECUTE FUNCTION sync_order_status_from_items();
