import { spawnSync } from 'node:child_process';
import nextEnv from '@next/env';

// A direct Node/MJS invocation must load Next's server env explicitly.
nextEnv.loadEnvConfig(process.cwd());
if (!process.argv.includes('--live')) {
  console.log('FULL PDF LIVE EVALUATION: not started (pass --live to authorize exactly one request).');
  process.exit(0);
}
const expected = process.env.MENU_IMPORT_GEMINI_API_KEY ? 'MENU_IMPORT_GEMINI_API_KEY' : process.env.GEMINI_KEY ? 'GEMINI_KEY' : 'GEMINI_API_KEY';
const loaded = Boolean(process.env.MENU_IMPORT_GEMINI_API_KEY || process.env.GEMINI_KEY || process.env.GEMINI_API_KEY);
console.log(`GEMINI ENV EXPECTED: ${expected}`);
console.log(`GEMINI ENV LOADED: ${loaded ? 'yes' : 'no'}`);
if (!loaded) process.exit(0);

const vitest = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(vitest, ['vitest', 'run', 'src/lib/menu-import/full-pdf-gemini-experiment.test.ts', '--reporter=verbose'], {
  stdio: 'inherit',
  env: { ...process.env, MENU_IMPORT_FULL_PDF_EXPERIMENT: 'true' },
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);
