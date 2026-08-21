import { spawnSync } from 'node:child_process';
import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;

// Node does not load Next.js env files automatically. Use the same loader as
// the application, while keeping credentials server-only and out of output.
loadEnvConfig(process.cwd());

const expected = process.env.MENU_IMPORT_GEMINI_API_KEY
  ? 'MENU_IMPORT_GEMINI_API_KEY'
  : process.env.GEMINI_KEY
    ? 'GEMINI_KEY'
    : 'GEMINI_API_KEY';
const loaded = Boolean(process.env.MENU_IMPORT_GEMINI_API_KEY || process.env.GEMINI_KEY || process.env.GEMINI_API_KEY);
console.log(`GEMINI ENV EXPECTED: ${expected}`);
console.log(`GEMINI ENV LOADED: ${loaded ? 'yes' : 'no'}`);
if (!loaded) process.exit(0);

const args = process.argv.slice(2);
const valueAfter = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : undefined; };
const pages = valueAfter('--pages');
if (pages) process.env.MENU_IMPORT_LIVE_PAGES = pages;
if (args.includes('--resume')) process.env.MENU_IMPORT_LIVE_RESUME = 'true';
if (valueAfter('--concurrency')) process.env.MENU_IMPORT_GEMINI_CONCURRENCY = valueAfter('--concurrency');
if (valueAfter('--min-interval-ms')) process.env.MENU_IMPORT_GEMINI_MIN_INTERVAL_MS = valueAfter('--min-interval-ms');

const childEnv = {
  ...process.env,
  MENU_IMPORT_ANALYZER_VERSION: 'menu-import-v4-visual',
  MENU_IMPORT_VISUAL_ARCHITECTURE_STAGE: '2',
  MENU_IMPORT_STAGE1_LINEAGE_VERIFIED: 'true',
};
Object.assign(childEnv, {
  ...(process.env.MENU_IMPORT_LIVE_PAGES ? { MENU_IMPORT_LIVE_PAGES: process.env.MENU_IMPORT_LIVE_PAGES } : {}),
  ...(process.env.MENU_IMPORT_LIVE_RESUME ? { MENU_IMPORT_LIVE_RESUME: process.env.MENU_IMPORT_LIVE_RESUME } : {}),
  ...(process.env.MENU_IMPORT_GEMINI_CONCURRENCY ? { MENU_IMPORT_GEMINI_CONCURRENCY: process.env.MENU_IMPORT_GEMINI_CONCURRENCY } : {}),
  ...(process.env.MENU_IMPORT_GEMINI_MIN_INTERVAL_MS ? { MENU_IMPORT_GEMINI_MIN_INTERVAL_MS: process.env.MENU_IMPORT_GEMINI_MIN_INTERVAL_MS } : {}),
});
const vitest = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const run = (name) => spawnSync(vitest, ['vitest', 'run', 'src/lib/menu-import/live-gemini-evaluation.test.ts', '--reporter=verbose', '-t', name], { stdio: 'inherit', env: childEnv, shell: process.platform === 'win32' });
if (!pages) {
  const smoke = run('smoke test');
  if ((smoke.status ?? 1) !== 0) {
    console.error('V4 smoke failed; fixture evaluation was not started.');
    process.exit(smoke.status ?? 1);
  }
  console.log('V4 smoke passed; fixture evaluation requires explicit --pages.');
  process.exit(0);
}
const fixture = run('Menu Subarashii.pdf');
process.exit(fixture.status ?? 1);
