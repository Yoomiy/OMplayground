import * as colyseus from '@colyseus/core';
import wsTransport from '@colyseus/ws-transport';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createPlatformService } from './platform/service.js';
import { PlatformGateway } from './platform/gateway.js';
import { configurePlatformLogger, platformLog } from './platform/logging.js';

const { WebSocketTransport } = wsTransport;
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST ?? '127.0.0.1';

async function main(): Promise<void> {
  const sharedLoggerModule = './platform/shared-logger.cjs';
  const { createLogger } = await import(sharedLoggerModule);
  const sharedVoiceModule = './platform/shared-voice.cjs';
  const { createGameVoiceToken } = await import(sharedVoiceModule);
  const { release } = JSON.parse(await readFile(new URL('./platform/build.json', import.meta.url), 'utf8')) as { release: string };
  configurePlatformLogger(createLogger('rocket-server').child({ release }));
  const server = http.createServer();
  const gameServer = new colyseus.Server({ gracefullyShutdown: false,
    transport: new WebSocketTransport({ server, maxPayload: 16 * 1024 }) });
  const app = createPlatformService({
    gateway: new PlatformGateway(process.env.SUPABASE_URL ?? '', process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''),
    ticketSecret: process.env.ROCKET_TICKET_SECRET ?? '',
    origins: (process.env.APP_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean),
    clientDir: process.env.ROCKET_CLIENT_DIR ?? fileURLToPath(new URL('../../client/dist/', import.meta.url)),
    createVoiceToken: createGameVoiceToken, release,
  });
  gameServer.define('playground', app.roomClass);
  // All matchmaking goes through authenticated launch; there is no anonymous adapter.
  server.removeAllListeners('request');
  server.on('request', app.handle);
  for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => {
    void app.drain().finally(() => gameServer.gracefullyShutdown(true));
  });
  await gameServer.listen(port, host);
  app.startRecovery();
  platformLog('info', 'ROCKET_SERVICE_READY', { host, port, release });
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Startup failed'); process.exitCode = 1; });
