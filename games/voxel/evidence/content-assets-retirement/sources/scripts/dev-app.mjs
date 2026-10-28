import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { repo, services, serviceArguments } from './dev-service-plan.mjs';

export async function supervise(entries, { graceMs = 65000, signals = true } = {}) {
  const children = new Set();
  let stopping = false, exitCode = 0, deadline;
  function signal(child, value) {
    try {
      if (process.platform === 'win32') child.kill(value);
      else process.kill(-child.pid, value);
    } catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
  function stop(code = 0) {
    if (stopping) return;
    stopping = true; exitCode = code;
    for (const child of children) if (child.pid) signal(child, 'SIGTERM');
    deadline = setTimeout(() => { for (const child of children) if (child.pid) signal(child, 'SIGKILL'); }, graceMs);
    deadline.unref();
  }
  const interrupted = () => stop();
  if (signals) { process.once('SIGINT', interrupted); process.once('SIGTERM', interrupted); }
  try {
    await Promise.all(entries.map(entry => new Promise(resolve => {
      const child = spawn(entry.command, entry.args, { cwd: entry.cwd ?? repo, env: entry.env ?? process.env, stdio: 'inherit', detached: process.platform !== 'win32' });
      children.add(child);
      child.once('error', error => { console.error('Could not start a development process:', error.code); stop(1); });
      child.once('close', code => { children.delete(child); if (!stopping) stop(code || 1); resolve(); });
    })));
    return exitCode;
  } finally {
    clearTimeout(deadline);
    if (signals) { process.removeListener('SIGINT', interrupted); process.removeListener('SIGTERM', interrupted); }
  }
}
async function run(args) {
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: repo, stdio: 'inherit' });
    child.once('error', reject); child.once('exit', code => resolve(code));
  });
  if (code !== 0) throw new Error('Development preflight failed; fix the reported configuration or build problem and retry.');
}
async function main() {
  if (process.versions.node !== '24.21.0') throw new Error('Use Node 24.21.0 for app development');
  for (const kind of Object.keys(services)) await run(serviceArguments(kind, { check: true }));
  await run([fileURLToPath(new URL('../games/voxel/tools/verify-release.mjs', import.meta.url))]);
  for (const port of [5173, ...Object.values(services).map(service => service.port)]) {
    await new Promise((resolve, reject) => {
      const probe = createServer();
      probe.once('error', () => reject(new Error(`Port ${port} is already in use. Stop the existing dev server before starting dev:app.`)));
      probe.listen(port, '127.0.0.1', () => probe.close(resolve));
    });
  }
  if (process.argv.includes('--check')) return;
  const entries = Object.keys(services).map(kind => ({ command: process.execPath, args: serviceArguments(kind) }));
  entries.push({
    command: process.execPath,
    args: [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)), '--host', '127.0.0.1', '--port', '5173', '--strictPort'],
    cwd: fileURLToPath(new URL('../apps/web/', import.meta.url)),
    env: { ...process.env, NODE_ENV: 'development', VITE_GAME_SERVER_URL: 'http://127.0.0.1:8080', VITE_VOXEL_RUNTIME_SERVER_URL: 'http://127.0.0.1:3001', VITE_CLASSROOM_SERVER_URL: 'http://127.0.0.1:8083' },
  });
  console.log('Starting Playground: http://localhost:5173 — Ctrl+C stops this stack.');
  process.exitCode = await supervise(entries);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
