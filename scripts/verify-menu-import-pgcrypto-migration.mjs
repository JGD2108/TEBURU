import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const connectionString = process.env.MENU_IMPORT_MIGRATION_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('MENU_IMPORT_MIGRATION_TEST_DATABASE_URL (or DATABASE_URL) is required for migration verification.');
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = path.join(root, 'supabase', 'migrations');
const targetMigration = '20260816200000_event_driven_menu_import_analysis.sql';
const restaurantId = '00000000-0000-0000-0000-000000000001';
const client = new Client({ connectionString });

const sha256 = (input) => createHash('sha256').update(input).digest('hex');

async function runMigrationsBeforeTarget() {
  const migrations = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
  const targetIndex = migrations.indexOf(targetMigration);
  if (targetIndex === -1) throw new Error(`Could not find ${targetMigration}.`);

  for (const migration of migrations.slice(0, targetIndex)) {
    await client.query(await readFile(path.join(migrationsDir, migration), 'utf8'));
  }
  return await readFile(path.join(migrationsDir, targetMigration), 'utf8');
}

async function assertEmptyDatabase() {
  const { rows: [{ existing }] } = await client.query(
    "SELECT to_regclass('public.restaurants') IS NOT NULL AS existing"
  );
  if (existing) {
    throw new Error('Migration verification requires an empty disposable database; refusing to modify an initialized database.');
  }
}

async function installSupabaseTestStubs() {
  await client.query('CREATE SCHEMA IF NOT EXISTS extensions');
  await client.query('CREATE SCHEMA IF NOT EXISTS vault');
  await client.query('CREATE TABLE IF NOT EXISTS vault.decrypted_secrets (name TEXT PRIMARY KEY, decrypted_secret TEXT)');
  await client.query('CREATE SCHEMA IF NOT EXISTS net');
  await client.query(`
    CREATE OR REPLACE FUNCTION net.http_post(url TEXT, headers JSONB, body JSONB)
    RETURNS BIGINT LANGUAGE sql AS 'SELECT 1::BIGINT'
  `);
}

async function placePgcryptoIn(schema) {
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
  await client.query(`ALTER EXTENSION pgcrypto SET SCHEMA ${schema}`);
}

async function seedLegacyDrafts() {
  const { rows: [job] } = await client.query(`
    INSERT INTO menu_import_jobs (restaurant_id, created_by, source_storage_path, source_filename, source_size_bytes)
    VALUES ($1, '00000000-0000-0000-0000-000000000099', 'restaurants/$1/imports/legacy.pdf', 'legacy.pdf', 1234)
    RETURNING id
  `, [restaurantId]);
  const { rows: [category] } = await client.query(`
    INSERT INTO menu_import_draft_categories (import_job_id, restaurant_id, name)
    VALUES ($1, $2, 'Legacy starters')
    RETURNING id
  `, [job.id, restaurantId]);
  const { rows: [item] } = await client.query(`
    INSERT INTO menu_import_draft_items (import_job_id, restaurant_id, draft_category_id, name, description, price)
    VALUES ($1, $2, $3, 'Legacy soup', 'Tomato and basil', 12.50)
    RETURNING id
  `, [job.id, restaurantId, category.id]);
  const { rows: [evidence] } = await client.query(`
    INSERT INTO menu_import_source_evidence (import_job_id, draft_item_id, page_number, excerpt)
    VALUES ($1, $2, 2, 'Tomato and basil')
    RETURNING id
  `, [job.id, item.id]);
  const { rows: [image] } = await client.query(`
    INSERT INTO menu_import_image_suggestions (import_job_id, restaurant_id, draft_item_id, storage_path, mime_type)
    VALUES ($1, $2, $3, 'restaurants/$2/imports/soup.jpg', 'image/jpeg')
    RETURNING id
  `, [job.id, restaurantId, item.id]);
  return { job, category, item, evidence, image };
}

async function assertFailureRollsBack(migration) {
  // This is intentionally an absent-extension fixture, rather than an
  // arbitrary schema placement: the migration must support any installed
  // pgcrypto schema it resolves from the catalog.
  await placePgcryptoIn('unavailable_extensions');
  await client.query('DROP EXTENSION pgcrypto CASCADE');
  let failure;
  try {
    await client.query('BEGIN');
    await client.query(migration);
    await client.query('COMMIT');
  } catch (error) {
    failure = error;
    await client.query('ROLLBACK');
  }
  if (!failure) throw new Error('Migration unexpectedly succeeded without pgcrypto digest(text, text).');
  if (failure.code !== 'P0001' || !/^menu-import lineage migration requires pgcrypto digest\(text, text\)/i.test(failure.message)) {
    throw new Error(`Expected a clear pgcrypto dependency diagnostic, received: ${failure.message}`);
  }
  const { rows: [state] } = await client.query(`
    SELECT
      to_regclass('public.menu_import_analysis_runs') IS NULL AS analysis_runs_absent,
      NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'menu_import_draft_items' AND column_name = 'idempotency_key'
      ) AS item_key_absent,
      NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'menu_import_source_evidence' AND column_name = 'idempotency_key'
      ) AS evidence_key_absent,
      NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'menu_import_image_suggestions' AND column_name = 'idempotency_key'
      ) AS image_key_absent
  `);
  if (!state.analysis_runs_absent || !state.item_key_absent || !state.evidence_key_absent || !state.image_key_absent) {
    throw new Error('Failed migration partially committed menu-import lineage schema changes.');
  }
}

async function applyAndAssertBackfill(migration, legacy, extensionSchema) {
  await client.query('SET search_path TO public');
  await client.query('BEGIN');
  try {
    await client.query(migration);
    const { rows: [keys] } = await client.query(`
      SELECT
        (SELECT idempotency_key FROM menu_import_draft_items WHERE id = $1) AS item_key,
        (SELECT idempotency_key FROM menu_import_source_evidence WHERE id = $2) AS evidence_key,
        (SELECT idempotency_key FROM menu_import_image_suggestions WHERE id = $3) AS image_key
    `, [legacy.item.id, legacy.evidence.id, legacy.image.id]);
    const expected = {
      item_key: sha256([legacy.job.id, legacy.category.id, 'Legacy soup', 'Tomato and basil', '12.50'].join('|')),
      evidence_key: sha256([legacy.job.id, legacy.item.id, '2', 'Tomato and basil'].join('|')),
      image_key: sha256([legacy.job.id, `restaurants/${restaurantId}/imports/soup.jpg`].join('|')),
    };
    for (const [column, value] of Object.entries(expected)) {
      if (!keys[column] || keys[column] !== value) {
        throw new Error(`Expected deterministic non-null ${column} with pgcrypto in ${extensionSchema}; received ${keys[column] ?? 'NULL'}.`);
      }
    }
    // Retain the pre-target fixture so the same disposable database can verify
    // both supported extension schemas without committing target DDL.
    await client.query('ROLLBACK');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

try {
  await client.connect();
  await assertEmptyDatabase();
  const migration = await runMigrationsBeforeTarget();
  await installSupabaseTestStubs();
  const legacy = await seedLegacyDrafts();
  await applyAndAssertBackfill(migration, legacy, 'public');
  await placePgcryptoIn('extensions');
  await applyAndAssertBackfill(migration, legacy, 'extensions');
  await assertFailureRollsBack(migration);
  console.log('Verified public and extensions pgcrypto backfills, deterministic legacy keys, and rollback on unavailable capability.');
} finally {
  await client.end();
}
