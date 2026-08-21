import { spawnSync } from 'node:child_process';
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());

if (!process.argv.includes('--live')) {
  console.log('TEXT-ONLY LIVE EVALUATION: not started (pass --live to authorize exactly one request).');
  process.exit(0);
}

console.log('GEMINI ENV EXPECTED: GEMINI_API_KEY');
console.log(`GEMINI ENV LOADED: ${process.env.GEMINI_API_KEY ? 'yes' : 'no'}`);
if (!process.env.GEMINI_API_KEY) process.exit(0);

const vitest = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(vitest, ['vitest', 'run', 'src/lib/menu-import/text-only-gemini-experiment.test.ts', '--reporter=verbose'], {
  stdio: 'inherit',
  env: { ...process.env, MENU_IMPORT_TEXT_ONLY_EXPERIMENT: 'true' },
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);
