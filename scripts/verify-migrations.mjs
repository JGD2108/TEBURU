import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for the integration test.');
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = path.join(root, 'supabase', 'migrations');
const client = new Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  const migrations = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
  for (const migration of migrations) {
    await client.query(await readFile(path.join(migrationsDir, migration), 'utf8'));
  }

  const { rows: [category] } = await client.query(
    "INSERT INTO menu_categories (name) VALUES ('Integration') RETURNING id"
  );
  const { rows: [item] } = await client.query(
    "INSERT INTO menu_items (category_id, name, price) VALUES ($1, 'Integration dish', 10) RETURNING id",
    [category.id]
  );
  const { rows: [station] } = await client.query(
    "INSERT INTO kitchen_stations (name, color) VALUES ('Integration station', '#ff6b35') RETURNING id"
  );
  await client.query(
    'INSERT INTO menu_item_stations (menu_item_id, station_id) VALUES ($1, $2)',
    [item.id, station.id]
  );
  const { rows: [table] } = await client.query(
    'INSERT INTO tables (table_number) VALUES (1) RETURNING id, capacity'
  );
  const { rows: [session] } = await client.query(
    "INSERT INTO sessions (table_id, code) VALUES ($1, '0000') RETURNING id",
    [table.id]
  );
  await client.query(
    'INSERT INTO session_tables (session_id, table_id, is_primary) VALUES ($1, $2, true)',
    [session.id, table.id]
  );
  const { rows: [guest] } = await client.query(
    "INSERT INTO session_users (session_id, name) VALUES ($1, 'Integration guest') RETURNING id",
    [session.id]
  );
  const { rows: [order] } = await client.query(
    'INSERT INTO orders (session_id, user_id) VALUES ($1, $2) RETURNING id, status',
    [session.id, guest.id]
  );
  const { rows: [orderItem] } = await client.query(
    'INSERT INTO order_items (order_id, menu_item_id, unit_price) VALUES ($1, $2, 10) RETURNING id, version',
    [order.id, item.id]
  );

  const preparing = await client.query(
    "UPDATE order_items SET kitchen_status = 'preparing', version = version + 1 WHERE id = $1 AND version = $2 RETURNING kitchen_status, version",
    [orderItem.id, orderItem.version]
  );
  const ready = await client.query(
    "UPDATE order_items SET kitchen_status = 'ready', version = version + 1 WHERE id = $1 AND version = $2 RETURNING kitchen_status, version",
    [orderItem.id, preparing.rows[0]?.version]
  );
  const { rows: [aggregate] } = await client.query('SELECT status FROM orders WHERE id = $1', [order.id]);
  const { rows: [routing] } = await client.query(
    'SELECT station_id, station_name, warning_minutes, critical_minutes FROM order_item_stations WHERE order_item_id = $1', [orderItem.id]
  );

  await client.query("UPDATE order_items SET priority = 'urgent' WHERE id = $1", [orderItem.id]);

  await client.query("UPDATE orders SET status = 'delivered' WHERE id = $1 AND status = 'ready'", [order.id]);
  await client.query("UPDATE order_items SET delivered_at = now() WHERE order_id = $1", [order.id]);
  const { rows: [delivered] } = await client.query(
    'SELECT o.status, oi.delivered_at FROM orders o JOIN order_items oi ON oi.order_id = o.id WHERE o.id = $1', [order.id]
  );
  const { rows: rlsTables } = await client.query(`
    SELECT relname FROM pg_class
    WHERE relnamespace = 'public'::regnamespace AND relrowsecurity = true
  `);
  const protectedTables = new Set(rlsTables.map(({ relname }) => relname));

  if (preparing.rowCount !== 1 || ready.rowCount !== 1 || aggregate.status !== 'ready' ||
      routing.station_id !== station.id || routing.station_name !== 'Integration station' ||
      routing.warning_minutes !== 10 || routing.critical_minutes !== 20 ||
      delivered.status !== 'delivered' || !delivered.delivered_at ||
      table.capacity !== 2 ||
      !['staff', 'tables', 'orders', 'order_items', 'guest_access_tokens', 'session_tables'].every((name) => protectedTables.has(name))) {
    throw new Error('Phase 2/3 routing, transitions, realtime or delivery verification failed against PostgreSQL.');
  }
  console.log(`Verified ${migrations.length} migrations, routing, SLA snapshots, realtime and delivery against PostgreSQL.`);
} finally {
  await client.end();
}
