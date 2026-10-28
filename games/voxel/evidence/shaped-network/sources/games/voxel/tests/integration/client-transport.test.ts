import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { PassThrough } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
const { createGateway }: typeof import('../../src/server/gateway.ts') = process.env
  .VOXEL_TEST_BUNDLE
  ? await import(new URL('../../dist-server/gateway.js', import.meta.url).href)
  : await import('../../src/server/gateway.ts');
const build = JSON.parse(
    readFileSync(new URL('../../artifacts/build.json', import.meta.url), 'utf8'),
  ),
  content = JSON.parse(
    readFileSync(new URL('../../artifacts/content.json', import.meta.url), 'utf8'),
  );
test(
  'external media upgrades preserve gateway origin/drain guards and native gameplay socket ownership',
  { timeout: 10000 },
  async () => {
    const transport = new WebSocketServer({ noServer: true }),
      clients: WebSocket[] = [],
      events: string[] = [],
      calls: string[] = [];
    const gateway = await createGateway({
      build,
      content,
      admit: async () => null,
      allowedOrigins: ['https://school.invalid'],
      onEvent: (name) => events.push(name),
      upgradeClient: (request, socket, head) => {
        calls.push(request.url!);
        if (request.url === '/fixture-throw') throw new Error('fixture');
        if (request.url !== '/voxel-media/rtc') return false;
        transport.handleUpgrade(request, socket, head, (peer) => peer.send('external transport'));
        return true;
      },
    });
    assert(gateway.address && typeof gateway.address === 'object');
    const origin = `ws://127.0.0.1:${gateway.address.port}`;
    async function open(path: string, from = 'https://school.invalid') {
      const socket = new WebSocket(origin + path, { headers: { Origin: from } });
      clients.push(socket);
      socket.on('error', () => {});
      const frames: string[] = [];
      socket.on('message', (data) => frames.push(data.toString()));
      const accepted = await new Promise<boolean>((resolve) => {
        socket.once('open', () => resolve(true));
        socket.once('error', () => resolve(false));
      });
      return { socket, frames, accepted };
    }
    let closed: Promise<void> | undefined;
    try {
      assert.equal((await open('/voxel-media/rtc', 'https://other.invalid')).accepted, false);
      assert.deepEqual(calls, []);
      const media = await open('/voxel-media/rtc');
      assert(media.accepted);
      if (!media.frames.length) await once(media.socket, 'message');
      assert.deepEqual(media.frames, ['external transport']);
      const native = await open('/voxel');
      assert(native.accepted);
      assert.deepEqual(calls, ['/voxel-media/rtc']);
      assert.equal((await open('/unknown')).accepted, false);
      assert.equal((await open('/fixture-throw')).accepted, false);
      assert(events.includes('VOXEL_CLIENT_UPGRADE_FAILED'));
      assert.equal(gateway.rooms.size, 0);
      for (const peer of transport.clients) peer.terminate();
      closed = gateway.close();
      const rejected = new PassThrough(),
        before = calls.length;
      gateway.http.emit(
        'upgrade',
        {
          url: '/voxel-media/rtc',
          headers: { origin: 'https://school.invalid' },
        } as IncomingMessage,
        rejected,
        Buffer.alloc(0),
      );
      assert(rejected.destroyed);
      assert.equal(calls.length, before);
      await closed;
    } finally {
      for (const socket of clients) socket.terminate();
      for (const peer of transport.clients) peer.terminate();
      await (closed ?? gateway.close());
      await new Promise<void>((resolve) => transport.close(() => resolve()));
    }
  },
);
