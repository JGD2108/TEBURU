import { Client } from 'pg';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('supabase.co') ? { rejectUnauthorized: false } : false,
});

try {
  await client.connect();
  const rls = await client.query(`
    SELECT relname FROM pg_class
    WHERE relnamespace = 'public'::regnamespace AND relrowsecurity
    ORDER BY relname
  `);
  const policies = await client.query(`
    SELECT tablename, policyname, cmd FROM pg_policies
    WHERE schemaname = 'public' ORDER BY tablename, policyname
  `);
  const required = [
    'staff', 'tables', 'sessions', 'session_users', 'menu_categories', 'menu_items',
    'orders', 'order_items', 'restaurant_settings', 'guest_access_tokens',
    'kitchen_stations', 'menu_item_stations', 'order_item_stations', 'order_events', 'table_join_attempts',
  ];
  const enabled = new Set(rls.rows.map(({ relname }) => relname));
  const missing = required.filter((table) => !enabled.has(table));
  if (missing.length) throw new Error(`RLS missing on: ${missing.join(', ')}`);
  console.log(`Verified RLS on ${required.length} tables and ${policies.rowCount} explicit read policies.`);
} finally {
  await client.end();
}
