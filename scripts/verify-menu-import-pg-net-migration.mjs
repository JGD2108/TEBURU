import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migration = await readFile(
  path.join(root, 'supabase', 'migrations', '20260817050142_enable_pg_net_menu_import_dispatch.sql'),
  'utf8',
);

const required = [
  'ALTER TABLE public.menu_import_jobs DISABLE TRIGGER menu_import_jobs_dispatch_analysis',
  'CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions',
  "to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)')",
  'ALTER TABLE public.menu_import_jobs ENABLE TRIGGER menu_import_jobs_dispatch_analysis',
];
for (const statement of required) {
  if (!migration.includes(statement)) throw new Error(`pg_net dispatch migration is missing: ${statement}`);
}

const disabledAt = migration.indexOf(required[0]);
const enabledAt = migration.lastIndexOf(required[3]);
if (disabledAt > enabledAt) throw new Error('Menu-import dispatch trigger is enabled before pg_net validation.');
console.log('Verified pg_net enablement, net.http_post diagnostic, and guarded menu-import dispatch trigger.');
