import * as colyseus from '@colyseus/core';
import wsTransport from '@colyseus/ws-transport';
import http from 'http';
import { ArenaRoom } from './rooms/arena-room.js';
import { CustomRoom } from './rooms/custom-room.js';
import { createPlatformService } from './platform/service.js';
import { PlatformGateway } from './platform/gateway.js';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { configurePlatformLogger, platformLog } from './platform/logging.js';

const { Server } = colyseus;
const { WebSocketTransport } = wsTransport;

const PORT = Number(process.env.PORT) || 2567;

/**
 * Loopback by default so a deployment cannot accidentally publish the raw,
 * un-TLS'd game port. Set HOST=0.0.0.0 to bind every interface on purpose.
 */
const HOST = process.env.HOST ?? '127.0.0.1';
let release: string | undefined;

async function main() {
  const server = http.createServer();

  const gameServer = new Server({
    gracefullyShutdown: process.env.ROCKET_MODE !== 'app',
    transport: new WebSocketTransport({ server, ...(process.env.ROCKET_MODE === 'app' ? { maxPayload: 16 * 1024 } : {}) }),
  });

  if (process.env.ROCKET_MODE === 'app') {
    const sharedLoggerModule = './platform/shared-logger.cjs';
    const { createLogger } = await import(sharedLoggerModule);
    const sharedVoiceModule = './platform/shared-voice.cjs';
    const { createGameVoiceToken } = await import(sharedVoiceModule);
    configurePlatformLogger(createLogger('rocket-server'));
    const manifest = JSON.parse(await readFile(new URL('./platform/build.json', import.meta.url), 'utf8')) as { release: string };
    release = manifest.release;
    const app = createPlatformService({
      gateway: new PlatformGateway(process.env.SUPABASE_URL ?? '', process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''),
      ticketSecret: process.env.ROCKET_TICKET_SECRET ?? '',
      origins: (process.env.APP_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean),
      clientDir: process.env.ROCKET_CLIENT_DIR ?? fileURLToPath(new URL('../../client/dist/', import.meta.url)),
      maxRooms: Number(process.env.ROCKET_MAX_ROOMS ?? 2),
      createVoiceToken: createGameVoiceToken,
      release,
    });
    gameServer.define('playground', app.roomClass);
    // Colyseus owns HTTP matchmaking by default. In app mode only the verified
    // launch endpoint may reserve seats; the transport still owns WS upgrades.
    server.removeAllListeners('request');
    server.on('request', app.handle);
    for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => {
      void app.drain().finally(() => gameServer.gracefullyShutdown(true));
    });
  } else {
    gameServer.define('arena', ArenaRoom);
    gameServer.define('custom', CustomRoom);
  }

  await gameServer.listen(PORT, HOST);
  if (process.env.ROCKET_MODE === 'app') platformLog('info', 'ROCKET_SERVICE_READY', { host: HOST, port: PORT, release });
  else {
    console.log(`[Rocket Arena] Server listening on ws://${HOST}:${PORT}`);
    console.log(`[Rocket Arena] Rooms: arena (quick match), custom (custom room)`);
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : 'Startup failed'); process.exitCode = 1; });
