import { spawnSync } from 'node:child_process';
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());
if (!process.argv.includes('--live')) {
  console.log('V5 TEXT LIVE EVALUATION: not started (pass --live to authorize one request).');
  process.exit(0);
}

console.log('GEMINI ENV EXPECTED: GEMINI_API_KEY');
console.log(`GEMINI ENV LOADED: ${process.env.GEMINI_API_KEY ? 'yes' : 'no'}`);
if (!process.env.GEMINI_API_KEY) process.exit(0);

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(command, ['vitest', 'run', 'src/lib/menu-import/v5-text-live.test.ts', '--reporter=verbose'], {
  stdio: 'inherit',
  env: { ...process.env, MENU_IMPORT_V5_TEXT_LIVE: 'true' },
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);
