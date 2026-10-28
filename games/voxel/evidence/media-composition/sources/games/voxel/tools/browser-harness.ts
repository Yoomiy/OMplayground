import { developmentAdmission } from './development-admission.ts';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import { createGateway } from '../src/server/gateway.ts';
import type { AdmissionPolicy } from '../src/server/gateway.ts';
import type { OwnerResolver } from '../src/server/owner-authorization.ts';
import type { RoomPolicyReader } from '../src/server/room-policy.ts';

export async function createBuiltHarness(
  worldDefaults?: {
    seed?: number;
    initialTick?: number;
    mode?: 'creative' | 'survival';
  },
  admission?: AdmissionPolicy,
  ownerPolicy?: OwnerResolver,
  roomPolicy?: RoomPolicyReader,
) {
  const build = JSON.parse(
    readFileSync(new URL('../artifacts/build.json', import.meta.url), 'utf8'),
  );
  const content = JSON.parse(
    readFileSync(new URL('../artifacts/content.json', import.meta.url), 'utf8'),
  );
  const root = new URL('../dist-client/', import.meta.url),
    assets = new Map<string, URL>();
  function index(dir: URL, prefix: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = `${prefix}/${entry.name}`,
        url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
      if (entry.isDirectory()) index(url, path);
      else assets.set(path, url);
    }
  }
  index(root, '');
  const events: { event: string; context: Record<string, string | number | boolean> }[] = [];
  const gateway = await createGateway({
    build,
    content,
    worldDefaults,
    roomPolicy,
    resolveOwner:
      ownerPolicy ??
      (admission
        ? undefined
        : async (_room, id) =>
            developmentAdmission({
              id,
              role: 'participant',
              capabilities: {
                build: true,
                fly: true,
                observe: false,
                combat: true,
                explosives: true,
              },
            }).actor),
    onEvent(event, context) {
      events.push({ event, context });
      if (events.length > 128) events.shift();
    },
    handleClient(req, res) {
      const path = new URL(req.url ?? '/', 'http://localhost').pathname;
      const file = assets.get(path === '/' ? '/index.html' : path);
      if (!file) {
        res.writeHead(404);
        res.end();
        return;
      }
      const type = file.pathname.endsWith('.js')
        ? 'text/javascript'
        : file.pathname.endsWith('.css')
          ? 'text/css'
          : file.pathname.endsWith('.wasm')
            ? 'application/wasm'
            : 'text/html';
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      res.end(readFileSync(file));
    },
    admit:
      admission ??
      (async (req, _body, res) => {
        const cookie = req.headers.cookie
          ?.split(';')
          .map((v) => v.trim())
          .find((v) => v.startsWith('voxel-test='))
          ?.slice('voxel-test='.length);
        const id = cookie || randomUUID();
        res.setHeader('Set-Cookie', `voxel-test=${id}; HttpOnly; SameSite=Strict; Path=/`);
        return developmentAdmission({
          id,
          role: 'participant',
          capabilities: { build: true, fly: true, observe: false, combat: true, explosives: true },
        });
      }),
  });
  if (!gateway.address || typeof gateway.address === 'string')
    throw new Error('missing test address');
  return { gateway, build, content, events, origin: `http://127.0.0.1:${gateway.address.port}` };
}
export function launchSoftwareBrowser() {
  return chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--enable-unsafe-swiftshader',
      '--use-angle=swiftshader',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
    ],
  });
}
