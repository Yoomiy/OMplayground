import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const loggerSource = process.argv[2] ?? new URL('../../../packages/observability/src/logger.ts', import.meta.url);
const voiceSource = process.argv[3] ?? new URL('../../../apps/game-server/src/gameVoiceToken.ts', import.meta.url);
const hash = createHash('sha256');
async function include(path) {
  const location = new URL(path, root);
  const entries = await readdir(location, { withFileTypes: true }).catch(() => null);
  if (entries) {
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) await include(`${path}/${entry.name}`);
  } else { hash.update(path); hash.update(await readFile(location)); }
}
for (const path of ['package-lock.json', 'tsconfig.base.json', 'client/src', 'client/vite.config.ts',
  'shared/src', 'simulation/src', 'server/src', 'scripts/build-app.mjs', 'scripts/build-app-logger.mjs']) await include(path);
hash.update(await readFile(loggerSource));
hash.update(await readFile(voiceSource));
const testHooks = process.env.ROCKET_TEST_HOOKS === '1';
hash.update(String(testHooks));
const release = `app-${hash.digest('hex').slice(0, 16)}`;
const child = spawn('npm', ['run', 'build:engine'], { cwd: fileURLToPath(root), stdio: 'inherit',
  env: { ...process.env, VITE_ROCKET_RELEASE: release, VITE_ROCKET_TEST_HOOKS: testHooks ? '1' : '0' } });
const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
if (code !== 0) process.exit(typeof code === 'number' ? code : 1);
await import('./build-app-logger.mjs');
await writeFile(new URL('server/dist/platform/build.json', root), JSON.stringify({ release, protocol: 1, testHooks }));
console.log(`Rocket app build: ${release}`);
