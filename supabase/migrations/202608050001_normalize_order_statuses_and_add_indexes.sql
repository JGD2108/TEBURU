-- Phase 0: make the order lifecycle consistent across the application.
-- This migration is safe for databases that still contain the legacy
-- `cooking` and `served` values, as well as for a fresh database.

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

UPDATE orders
SET status = CASE status
  WHEN 'cooking' THEN 'preparing'
  WHEN 'served' THEN 'ready'
  ELSE status
END
WHERE status IN ('cooking', 'served');

ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'preparing', 'ready', 'delivered', 'cancelled'));

-- The KDS reads active orders by status and age on every refresh.
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at
  ON orders (status, created_at);

-- These indexes support order lookup by table session and item retrieval.
CREATE INDEX IF NOT EXISTS idx_orders_session_id ON orders (session_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);

-- A table's active session is queried by the floor and checkout workflows.
CREATE INDEX IF NOT EXISTS idx_sessions_table_status ON sessions (table_id, status);
