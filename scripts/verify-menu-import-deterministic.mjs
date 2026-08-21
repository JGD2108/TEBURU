import { spawnSync } from 'node:child_process';

const files = [
  'src/lib/menu-import/text-only-evaluation.test.ts',
  'src/lib/menu-import/v5-text.adapter.test.ts',
  'src/lib/menu-import/v5-worker.test.ts',
  'src/lib/menu-import/v5-v4-comparison.test.ts',
  'src/lib/menu-import/analyzer-version.test.ts',
  'src/lib/menu-import/full-document-evaluation.test.ts',
  'src/lib/menu-import/visual-architecture.test.ts',
  'src/lib/menu-import/provider.test.ts',
  'src/lib/menu-import/worker.test.ts',
  'src/app/api/admin/menu-import/routes.test.ts',
];
const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vitest', 'run', '--reporter=dot', ...files], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);
