import { developmentAdmission } from './development-admission.ts';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createServer } from 'vite';
import { createGateway } from '../src/server/gateway.ts';
if (process.env.NODE_ENV === 'production')
  throw new Error('loopback development admission cannot run in production');
const port = Number(process.env.VOXEL_DEV_PORT ?? 5194),
  gatewayPort = Number(process.env.VOXEL_DEV_GATEWAY_PORT ?? 8894);
const mode = process.env.VOXEL_MODE ?? 'creative';
if (mode !== 'creative' && mode !== 'survival') throw new Error('invalid VOXEL_MODE');
const gateway = await createGateway({
  build: JSON.parse(readFileSync(new URL('../artifacts/build.json', import.meta.url), 'utf8')),
  content: JSON.parse(readFileSync(new URL('../artifacts/content.json', import.meta.url), 'utf8')),
  port: gatewayPort,
  host: '127.0.0.1',
  worldDefaults: { mode },
  allowedOrigins: [`http://127.0.0.1:${port}`],
  resolveOwner: async (_room, id) =>
    developmentAdmission({
      id,
      role: 'participant',
      capabilities: { build: true, fly: true, observe: false, combat: true, explosives: true },
    }).actor,
  async admit(req, _body, res) {
    const cookie = req.headers.cookie
      ?.split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith('voxel-development='))
      ?.split('=')[1];
    const id = cookie && /^[a-f0-9-]{36}$/.test(cookie) ? cookie : randomUUID();
    res.setHeader('Set-Cookie', `voxel-development=${id}; HttpOnly; SameSite=Strict; Path=/`);
    return developmentAdmission({
      id,
      role: 'participant',
      capabilities: { build: true, fly: true, observe: false, combat: true, explosives: true },
    });
  },
  onEvent(event, context) {
    if (event !== 'VOXEL_ROOM_METRICS')
      console.log(JSON.stringify({ service: 'voxel-development', event, ...context }));
  },
});
const vite = await createServer({
  configFile: new URL('../vite.config.ts', import.meta.url).pathname,
  server: {
    host: '127.0.0.1',
    port,
    strictPort: true,
    proxy: {
      '/api/voxel': `http://127.0.0.1:${gatewayPort}`,
      '/voxel': { target: `ws://127.0.0.1:${gatewayPort}`, ws: true },
    },
  },
});
await vite.listen();
console.log(`Voxel development: http://127.0.0.1:${port}`);
let closing = false;
const shutdown = async () => {
  if (closing) return;
  closing = true;
  await vite.close();
  await gateway.close();
};
process.on('SIGINT', () => {
  void shutdown();
});
process.on('SIGTERM', () => {
  void shutdown();
});
