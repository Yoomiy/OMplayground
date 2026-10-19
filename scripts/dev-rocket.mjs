import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { access, readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { createServer } from 'node:net';

const repo = new URL('../', import.meta.url);
const rocket = new URL('experiments/rocket-arena-lab/', repo);
async function readEnv(path) {
  try { return parseEnv(await readFile(new URL(path, repo), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
}

// Reuse only Supabase credentials from the main server, never its port/CORS.
// Rocket-specific overrides stay in a gitignored, server-only file.
const serverEnv = await readEnv('apps/game-server/.env');
const localEnv = await readEnv('experiments/rocket-arena-lab/.env.app.local');
const settings = { ...localEnv, ...process.env };
// Saved matches must remain verifiable across local dev restarts too.
async function localTicketSecret() {
  const directory = new URL('.run/', rocket);
  const path = new URL('app-ticket-secret', directory);
  await mkdir(directory, { recursive: true });
  try { await writeFile(path, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  return (await readFile(path, 'utf8')).trim();
}
const port = Number(settings.ROCKET_PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('ROCKET_PORT must be a valid port');
const env = {
  ...process.env,
  SUPABASE_URL: settings.SUPABASE_URL ?? serverEnv.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: settings.SUPABASE_SERVICE_ROLE_KEY ?? serverEnv.SUPABASE_SERVICE_ROLE_KEY,
  LIVEKIT_URL: settings.LIVEKIT_URL ?? serverEnv.LIVEKIT_URL,
  LIVEKIT_API_KEY: settings.LIVEKIT_API_KEY ?? serverEnv.LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET: settings.LIVEKIT_API_SECRET ?? serverEnv.LIVEKIT_API_SECRET,
  ROCKET_TICKET_SECRET: settings.ROCKET_TICKET_SECRET ?? await localTicketSecret(),
  APP_ORIGINS: settings.APP_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173',
  ROCKET_MAX_ROOMS: settings.ROCKET_MAX_ROOMS ?? '2',
  ROCKET_MODE: 'app',
  NODE_ENV: 'production',
  ROCKET_ARENA_DEV_CONTROLS: 'false',
  HOST: '127.0.0.1',
  PORT: String(port),
};
// Don't inherit deployment/client overrides that could serve a mismatched build.
delete env.ROCKET_CLIENT_DIR;
delete env.VITE_SERVER_URL;
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Set Supabase credentials in apps/game-server/.env or experiments/rocket-arena-lab/.env.app.local');
}

// Background jobs survive restarting the foreground web command. Never hide
// an old Rocket process behind a second build that cannot bind its port.
await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once('error', error => reject(error.code === 'EADDRINUSE'
    ? new Error(`Rocket port ${port} is already in use. Stop the existing background npm run dev:rocket job, then start it again.`) : error));
  probe.listen(port, '127.0.0.1', () => probe.close(resolve));
});

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
  killTimer = setTimeout(() => signalChild('SIGKILL'), 15_000);
  killTimer.unref();
});

async function run(command, args, overrides = {}) {
  if (stopping) process.exit(130);
  child = spawn(command, args, {
    cwd: fileURLToPath(rocket), env: { ...env, ...overrides }, stdio: 'inherit', detached: process.platform !== 'win32',
  });
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve(code ?? (signal === 'SIGINT' ? 130 : 143)));
  });
  child = undefined;
  clearTimeout(killTimer);
  if (stopping || code !== 0) process.exit(code);
}

try { await access(new URL('node_modules/.package-lock.json', rocket)); }
catch {
  console.log('[rocket] Installing isolated game dependencies…');
  await run('npm', ['ci', '--include=dev', '--no-audit', '--no-fund']);
}
console.log('[rocket] Building matching app client and server…');
await run('npm', ['run', 'build:app']);
console.log(`[rocket] Local app service: http://localhost:${port} (forward port ${port})`);
console.log(`[rocket] Allowed app origins: ${env.APP_ORIGINS}`);
// Keep the app artifact optimized, but use the same readable dev logger as the other services.
await run(process.execPath, ['server/dist/index.js'], { NODE_ENV: 'development', LOG_LEVEL: settings.LOG_LEVEL ?? 'info' });
