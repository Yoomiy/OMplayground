import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';
import { developmentProxies } from '../apps/web/tools/dev-proxy.ts';

test('one dev port preserves service paths, auth/origin headers and binary WebSockets', { timeout: 15000 }, async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'playground-dev-proxy-'));
  const backends = [], sockets = [];
  let vite;
  async function upstream(name) {
    const upgrades = [], ws = new WebSocketServer({ noServer: true });
    const http = createServer((req, res) => {
      void (async () => {
        let body = ''; for await (const chunk of req) body += chunk;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ name, path: req.url, method: req.method, authorization: req.headers.authorization, origin: req.headers.origin, body }));
      })();
    });
    http.on('upgrade', (req, socket, head) => {
      upgrades.push({ path: req.url, origin: req.headers.origin });
      ws.handleUpgrade(req, socket, head, client => {
        client.on('error', () => {});
        client.on('message', (data, binary) => client.send(data, { binary }));
      });
    });
    const backend = { name, http, ws, upgrades }; backends.push(backend);
    await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
    const address = http.address(); assert(address && typeof address === 'object');
    backend.origin = 'http://127.0.0.1:' + address.port;
    return backend;
  }
  try {
    const game = await upstream('game'), voxel = await upstream('voxel'), classroom = await upstream('classroom');
    vite = await createViteServer({ configFile: false, envFile: false, root, logLevel: 'error', optimizeDeps: { noDiscovery: true }, server: { host: '127.0.0.1', port: 0, hmr: false, proxy: developmentProxies({ game: game.origin, voxel: voxel.origin, classroom: classroom.origin }) } });
    await vite.listen();
    const address = vite.httpServer.address(); assert(address && typeof address === 'object');
    const origin = 'http://127.0.0.1:' + address.port;
    const cases = [
      ['/api/voxel/admin-stats', 'voxel', '/api/voxel/admin-stats'],
      ['/voxel-media/rtc/v1/validate?ticket=fixture', 'voxel', '/voxel-media/rtc/v1/validate?ticket=fixture'],
      ['/__classroom/rtc/classroom-token', 'classroom', '/rtc/classroom-token'],
      ['/__classroom/api/admin/stats', 'classroom', '/api/admin/stats'],
      ['/__classroom/api/telemetry', 'classroom', '/api/telemetry'],
      ['/api/telemetry', 'game', '/api/telemetry'],
      ['/api/admin/stats', 'game', '/api/admin/stats']
    ];
    for (const [route, name, forwarded] of cases) {
      const response = await fetch(origin + route, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer local-fixture', Origin: origin }, body: '{"fixture":true}' });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { name, path: forwarded, method: 'POST', authorization: 'Bearer local-fixture', origin, body: '{"fixture":true}' });
    }
    for (const [route, backend] of [['/voxel', voxel], ['/voxel-media/rtc?ticket=fixture', voxel], ['/socket.io/?EIO=4&transport=websocket', game]]) {
      const socket = new WebSocket(origin.replace('http:', 'ws:') + route, { origin }); sockets.push(socket);
      socket.on('error', () => {});
      await once(socket, 'open', { signal: AbortSignal.timeout(5000) });
      const message = once(socket, 'message', { signal: AbortSignal.timeout(5000) });
      const payload = Buffer.from([0, 1, 255, 2, 3]); socket.send(payload);
      const [data, binary] = await message; assert.equal(binary, true); assert.deepEqual(data, payload);
      assert.deepEqual(backend.upgrades.at(-1), { path: route, origin });
      const closed = once(socket, 'close'); socket.terminate(); await closed;
    }
  } finally {
    for (const socket of sockets) socket.terminate();
    await vite?.close();
    for (const backend of backends) {
      for (const client of backend.ws.clients) client.terminate();
      await new Promise(resolve => backend.ws.close(resolve));
      backend.http.closeAllConnections();
      await new Promise(resolve => backend.http.close(resolve));
    }
    rmSync(root, { recursive: true });
  }
});
