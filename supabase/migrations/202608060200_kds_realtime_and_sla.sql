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

-- The payload deliberately contains no customer data. Clients refetch the
-- authorized KDS projection after receiving a change notification.
CREATE OR REPLACE FUNCTION notify_kds_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'teburu_kds',
    json_build_object('entity', TG_TABLE_NAME, 'operation', TG_OP)::text
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_items_notify_kds
AFTER INSERT OR UPDATE OR DELETE ON order_items
FOR EACH STATEMENT EXECUTE FUNCTION notify_kds_change();

CREATE TRIGGER kitchen_stations_notify_kds
AFTER INSERT OR UPDATE OR DELETE ON kitchen_stations
FOR EACH STATEMENT EXECUTE FUNCTION notify_kds_change();

CREATE TRIGGER menu_item_stations_notify_kds
AFTER INSERT OR UPDATE OR DELETE ON menu_item_stations
FOR EACH STATEMENT EXECUTE FUNCTION notify_kds_change();
