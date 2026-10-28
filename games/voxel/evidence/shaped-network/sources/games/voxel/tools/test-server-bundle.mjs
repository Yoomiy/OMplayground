import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
execFileSync(process.execPath, ['--test', 'tests/integration/*.test.ts'], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  env: { ...process.env, VOXEL_TEST_BUNDLE: '1' },
  stdio: 'inherit',
});
