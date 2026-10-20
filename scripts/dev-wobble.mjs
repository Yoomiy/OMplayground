import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const repo = new URL('../', import.meta.url);
const game = new URL('experiments/wobble-rush-lab/', repo);
async function envFile(path) {
  try { return parseEnv(await readFile(new URL(path, repo), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
}
const main = await envFile('apps/game-server/.env');
const local = await envFile('experiments/wobble-rush-lab/.env.app.local');
const settings = { ...local, ...process.env };
const port = Number(settings.WOBBLE_PORT ?? local.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('WOBBLE_PORT must be a valid port');
await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once('error', error => reject(new Error(error.code === 'EADDRINUSE' ? `Wobble port ${port} is occupied. Stop the existing Wobble job before rebuilding/restarting.` : error.message)));
  probe.listen(port, '127.0.0.1', () => probe.close(resolve));
});
const directory = new URL('.run/', game);
const secretPath = new URL('app-secret', directory);
await mkdir(directory, { recursive: true });
try { await writeFile(secretPath, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 }); }
catch (error) { if (error.code !== 'EEXIST') throw error; }
const env = { ...process.env, NODE_ENV: 'development', HOST: '127.0.0.1', PORT: String(port),
  WOBBLE_TICKET_SECRET: settings.WOBBLE_TICKET_SECRET || (await readFile(secretPath, 'utf8')).trim(),
  WOBBLE_MAX_ROOMS: settings.WOBBLE_MAX_ROOMS ?? '2',
  LOG_LEVEL: settings.LOG_LEVEL ?? 'info',
  APP_ORIGINS: settings.APP_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173',
};
for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET']) env[name] = settings[name] ?? main[name];
delete env.WOBBLE_CLIENT_DIR;
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Configure Supabase in apps/game-server/.env or experiments/wobble-rush-lab/.env.app.local');
let bun = settings.WOBBLE_BUN ?? 'bun';
if (!settings.WOBBLE_BUN) {
  const local = new URL('ops/labs/tools/bun-1.4.3/package/bin/bun', repo);
  try { await access(local); bun = fileURLToPath(local); } catch { /* Use Bun on PATH. */ }
}
let child;
let stopping = false;
let killTimer;
function signalChild(signal) {
  if (!child?.pid) return;
  try {
    if (process.platform === 'win32') child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch (error) { if (error.code !== 'ESRCH') throw error; }
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  if (stopping) return;
  stopping = true;
  signalChild(signal);
  // Let the native service finish its 30-second save/drain before forcing exit.
  killTimer = setTimeout(() => signalChild('SIGKILL'), 35_000);
  killTimer.unref();
});
async function run(command, args) {
  if (stopping) process.exit(130);
  child = spawn(command, args, { cwd: fileURLToPath(game), env, stdio: 'inherit', detached: process.platform !== 'win32' });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', (code, signal) => resolve(code ?? (signal ? 130 : 1))); });
  child = undefined;
  clearTimeout(killTimer);
  if (stopping || code !== 0) process.exit(code);
}
await run(bun, ['install', '--frozen-lockfile']);
await run(bun, ['run', 'scripts/build-app.ts']);
console.log(`[wobble] App service: http://localhost:${port}; forward port ${port}. Restart this command after backend/frame changes.`);
console.log(`[wobble] Allowed app origins: ${env.APP_ORIGINS}`);
console.log('[wobble] Catalog setup: after the initial migration, apply 20261019144000_activate_wobble_rush_catalog.sql in your test database.');
await run(process.execPath, ['app-dist/server.mjs']);
