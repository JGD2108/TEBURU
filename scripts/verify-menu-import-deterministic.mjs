import { spawnSync } from 'node:child_process';

const files = [
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
