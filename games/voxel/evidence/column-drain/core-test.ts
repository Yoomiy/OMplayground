import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { developmentAdmission } from '../../tools/development-admission.ts';
import { MemoryCheckpoints } from '../fixtures/checkpoint-storage.ts';
import { editedCheckpoint } from '../fixtures/edited-checkpoint.ts';
import { tcpGate } from '../fixtures/tcp-gate.ts';
import { around, parseServerMessage } from '../../src/shared/protocol.ts';
import type { ServerMessage } from '../../src/shared/protocol.ts';
import { decodeChunk } from '../../src/shared/chunk-wire.ts';
const { createGateway }: typeof import('../../src/server/gateway.ts') = process.env
  .VOXEL_TEST_BUNDLE
  ? await import(new URL('../../dist-server/gateway.js', import.meta.url).href)
  : await import('../../src/server/gateway.ts');
const build = JSON.parse(
    fs.readFileSync(new URL('../../artifacts/build.json', import.meta.url), 'utf8'),
  ),
  content = JSON.parse(
    fs.readFileSync(new URL('../../artifacts/content.json', import.meta.url), 'utf8'),
  );

class Reader {
  socket: WebSocket;
  columns = new Map<string, { x: number; z: number; revision: number }>();
  welcome: Extract<ServerMessage, { type: 'welcome' }> | undefined;
  baseline: Extract<ServerMessage, { type: 'baseline' }> | undefined;
  snapshot: Extract<ServerMessage, { type: 'snapshot' }> | undefined;
  closeCode: number | undefined;
  error: Error | undefined;
  frames = 0;
  constructor(url: string, entries: number) {
    this.socket = new WebSocket(url);
    this.socket.on('close', (code) => (this.closeCode = code));
    this.socket.on('error', (e) => (this.error = e));
    this.socket.on('message', (bytes, binary) => {
      try {
        if (binary) {
          const f = decodeChunk(new Uint8Array(bytes as Buffer), content.blocks.length);
          assert(f);
          assert.equal(f.kind, 'baseline');
          assert.equal(f.edits.length, entries);
          assert.equal(f.revision, entries);
          for (let n = 0; n < entries; n++) {
            assert.equal(f.edits[n][0], 256 + n);
            assert.equal(f.edits[n][1], 0);
          }
          this.frames++;
          this.columns.set(`${f.x},${f.z}`, { x: f.x, z: f.z, revision: f.revision });
        } else {
          const e = parseServerMessage(bytes.toString());
          assert(e);
          if (e.type === 'welcome') this.welcome = e;
          else if (e.type === 'baseline') this.baseline = e;
          else if (e.type === 'snapshot') this.snapshot = e;
          else if (e.type === 'error') throw Error(e.code);
        }
      } catch (e) {
        this.error = e as Error;
      }
    });
  }
  async until(predicate: () => boolean) {
    const end = performance.now() + 15000;
    while (!predicate()) {
      if (this.error) throw this.error;
      if (this.closeCode !== undefined) throw Error('socket closed ' + this.closeCode);
      if (performance.now() > end) throw Error('edited baseline timeout');
      await delay(10);
    }
  }
  async ready() {
    await this.until(() => this.columns.size === 49 && this.baseline?.reason === 'join');
    const b = this.baseline!;
    this.socket.send(
      JSON.stringify({
        type: 'ready',
        epoch: b.epoch,
        columns: around(Math.floor(b.state[0] / 16), Math.floor(b.state[2] / 16), 1).map(
          (c) => this.columns.get(`${c.x},${c.z}`)!,
        ),
      }),
    );
    await this.until(() => this.baseline?.reason === 'ready');
    this.socket.send(JSON.stringify({ type: 'focus', epoch: this.baseline!.epoch, active: true }));
    await this.until(() => this.baseline?.reason === 'focus' && this.baseline.state[12] === 0);
  }
}

test(
  'edited checkpoints stream all columns through one/five-second real TCP read stalls and reconnect while a healthy peer continues',
  { timeout: 60000 },
  async () => {
    const backend = new MemoryCheckpoints(),
      room = randomUUID(),
      ids = [randomUUID(), randomUUID()],
      seed = await editedCheckpoint(backend, room, content, build);
    const events: { name: string; context: Record<string, string | number | boolean> }[] = [],
      readers: Reader[] = [],
      serverSockets = new Set<WebSocket>(),
      holds: Record<string, unknown>[] = [];
    const gateway = await createGateway({
      build,
      content,
      persistence: { objects: backend, metadata: backend },
      admit: async (req) =>
        developmentAdmission({
          id: String(req.headers['x-test-actor']),
          role: 'participant',
          capabilities: { build: true, fly: true, observe: false, combat: true, explosives: true },
        }),
      onEvent(name, context) {
        if (/BACKPRESSURE|FAILED|FAULT/.test(name)) events.push({ name, context });
      },
    });
    gateway.sockets.on('connection', (s) => {
      serverSockets.add(s);
      s.on('close', () => serverSockets.delete(s));
    });
    const address = gateway.address;
    assert(address && typeof address === 'object');
    const origin = `http://127.0.0.1:${address.port}`;
    const relay = await tcpGate(address.port);
    let maxBufferedBytes = 0,
      passed = false;
    const sample = setInterval(() => {
      for (const s of serverSockets)
        maxBufferedBytes = Math.max(maxBufferedBytes, s.bufferedAmount);
    }, 4);
    const connect = async (id: string, url = origin.replace('http:', 'ws:') + '/voxel') => {
      const response = await fetch(origin + '/api/voxel/admission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-actor': id },
        body: JSON.stringify({ room }),
      });
      assert.equal(response.status, 200);
      const ticket = await response.json(),
        reader = new Reader(url, seed.entries);
      readers.push(reader);
      await once(reader.socket, 'open');
      return { reader, ticket };
    };
    try {
      assert(seed.baselineBytes > 4 * 1024 * 1024);
      const healthy = await connect(ids[0]);
      healthy.reader.socket.send(JSON.stringify({ type: 'hello', ...healthy.ticket }));
      await healthy.reader.ready();
      let oldEpoch = 0;
      for (const holdMs of [1000, 5000]) {
        const { reader, ticket } = await connect(ids[1], relay.url);
        relay.hold();
        reader.socket.send(JSON.stringify({ type: 'hello', ...ticket }));
        await healthy.reader.until(() => !!healthy.reader.snapshot);
        const before = healthy.reader.snapshot!.tick,
          started = performance.now();
        await delay(holdMs);
        assert.equal(reader.frames, 0, 'the proxy actually suspends server TCP reads');
        assert.equal(healthy.reader.closeCode, undefined);
        assert(
          healthy.reader.snapshot!.tick > before,
          'healthy simulation continues during another peer stall',
        );
        relay.release();
        await reader.ready();
        assert.equal(reader.frames, 49);
        assert.equal(reader.welcome!.worldId, seed.worldId);
        assert(reader.welcome!.epoch > oldEpoch);
        oldEpoch = reader.welcome!.epoch;
        holds.push({
          holdMs,
          elapsedHeldMs: performance.now() - started,
          frames: reader.frames,
          worldId: reader.welcome!.worldId,
          epoch: reader.welcome!.epoch,
        });
        reader.socket.terminate();
        await once(reader.socket, 'close');
      }
      assert.deepEqual(events, []);
      assert(
        maxBufferedBytes <= 1024 * 1024,
        'baseline queue remains inside shared output recovery budget',
      );
      passed = true;
    } finally {
      clearInterval(sample);
      relay.release();
      for (const r of readers) r.socket.terminate();
      await relay.close();
      await gateway.close();
      fs.mkdirSync(new URL('../../test-results/', import.meta.url), { recursive: true });
      fs.writeFileSync(
        new URL(
          `../../test-results/column-drain-${process.env.VOXEL_TEST_BUNDLE ? 'packaged' : 'source'}.json`,
          import.meta.url,
        ),
        JSON.stringify(
          {
            result: passed ? 'REAL_TCP_EDITED_BASELINE_DRAIN_AND_RECONNECT_PASS' : 'FAIL',
            buildId: build.buildId,
            seed,
            holds,
            maxBufferedBytes,
            events,
            readers: readers.map((r) => ({
              frames: r.frames,
              closeCode: r.closeCode,
              error: r.error?.message,
            })),
            remainingRooms: gateway.rooms.size,
            scope:
              'Local prepared edited checkpoint, actual TCP read suspension and native workers. Contract persistence; no hosted or physical school network qualification.',
          },
          null,
          2,
        ) + '\n',
      );
    }
  },
);
