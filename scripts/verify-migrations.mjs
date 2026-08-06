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
  const { rows: [table] } = await client.query(
    'INSERT INTO tables (table_number) VALUES (1) RETURNING id'
  );
  const { rows: [session] } = await client.query(
    "INSERT INTO sessions (table_id, code) VALUES ($1, '0000') RETURNING id",
    [table.id]
  );
  const { rows: [guest] } = await client.query(
    "INSERT INTO session_users (session_id, name) VALUES ($1, 'Integration guest') RETURNING id",
    [session.id]
  );
  const { rows: [order] } = await client.query(
    'INSERT INTO orders (session_id, user_id) VALUES ($1, $2) RETURNING id, status',
    [session.id, guest.id]
  );
  await client.query(
    'INSERT INTO order_items (order_id, menu_item_id, unit_price) VALUES ($1, $2, 10)',
    [order.id, item.id]
  );

  const preparing = await client.query(
    "UPDATE orders SET status = 'preparing' WHERE id = $1 AND status = 'pending' RETURNING status",
    [order.id]
  );
  const ready = await client.query(
    "UPDATE orders SET status = 'ready' WHERE id = $1 AND status = 'preparing' RETURNING status",
    [order.id]
  );

  if (preparing.rowCount !== 1 || ready.rowCount !== 1) {
    throw new Error('KDS state transitions did not succeed against the migrated database.');
  }
  console.log(`Verified ${migrations.length} migrations and KDS transitions against PostgreSQL.`);
} finally {
  await client.end();
}
