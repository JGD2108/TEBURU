-- Phase 5: browser clients cannot mutate operational data. Business mutations use authenticated API routes.
CREATE TABLE table_join_attempts (
  fingerprint TEXT NOT NULL,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  blocked_until TIMESTAMPTZ,
  PRIMARY KEY (fingerprint, table_id)
);

CREATE INDEX idx_table_join_attempts_cleanup ON table_join_attempts (window_started_at);

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'staff', 'tables', 'sessions', 'session_users', 'menu_categories', 'menu_items',
    'orders', 'order_items', 'restaurant_settings', 'guest_access_tokens',
    'kitchen_stations', 'menu_item_stations', 'order_item_stations', 'order_events', 'table_join_attempts'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
END $$;

-- Supabase Auth is absent in the plain PostgreSQL migration test, so Auth policies are installed conditionally.
DO $$
BEGIN
  IF to_regprocedure('auth.uid()') IS NOT NULL THEN
    EXECUTE $policy$
      CREATE OR REPLACE FUNCTION public.current_staff_role()
      RETURNS text
      LANGUAGE sql STABLE SECURITY DEFINER
      SET search_path = public, pg_temp
      AS 'SELECT role FROM public.staff WHERE user_id = auth.uid() LIMIT 1'
    $policy$;

    EXECUTE 'REVOKE ALL ON FUNCTION public.current_staff_role() FROM PUBLIC';
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE 'GRANT EXECUTE ON FUNCTION public.current_staff_role() TO authenticated';
    END IF;

    EXECUTE 'CREATE POLICY staff_read_self ON public.staff FOR SELECT USING (user_id = auth.uid())';
    EXECUTE $policy$
      CREATE POLICY kitchen_realtime_items ON public.order_items FOR SELECT
      USING (public.current_staff_role() IN ('admin', 'kitchen'))
    $policy$;
    EXECUTE $policy$
      CREATE POLICY kitchen_realtime_stations ON public.kitchen_stations FOR SELECT
      USING (public.current_staff_role() IN ('admin', 'kitchen'))
    $policy$;
    EXECUTE $policy$
      CREATE POLICY kitchen_realtime_assignments ON public.menu_item_stations FOR SELECT
      USING (public.current_staff_role() IN ('admin', 'kitchen'))
    $policy$;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION cleanup_expired_guest_access_tokens()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE removed bigint;
BEGIN
  DELETE FROM guest_access_tokens
  WHERE expires_at < now() - interval '24 hours'
     OR revoked_at < now() - interval '24 hours';
  GET DIAGNOSTICS removed = ROW_COUNT;
  DELETE FROM table_join_attempts WHERE window_started_at < now() - interval '24 hours';
  RETURN removed;
END;
$$;

REVOKE ALL ON FUNCTION cleanup_expired_guest_access_tokens() FROM PUBLIC;
