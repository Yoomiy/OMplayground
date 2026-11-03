import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { SocketProbe } from '../fixtures/socket-probe.ts';
import { MemoryCheckpoints } from '../fixtures/checkpoint-storage.ts';
const { createGateway }: typeof import('../../src/server/gateway.ts') = process.env
  .VOXEL_TEST_BUNDLE
  ? await import(new URL('../../dist-server/gateway.js', import.meta.url).href)
  : await import('../../src/server/gateway.ts');
const build = JSON.parse(
  readFileSync(new URL('../../artifacts/build.json', import.meta.url), 'utf8'),
);
const content = JSON.parse(
  readFileSync(new URL('../../artifacts/content.json', import.meta.url), 'utf8'),
);
const actor = {
  id: 'fixture-actor',
  role: 'participant' as const,
  capabilities: { build: true, fly: true, observe: false, combat: true, explosives: true },
};
type Entry = { name: string; context: Record<string, string | number | boolean> };
async function until(predicate: () => boolean) {
  for (let n = 0; n < 500 && !predicate(); n++) await delay(10);
  assert.ok(predicate(), 'expected log did not arrive');
}

test(
  'a join has a separate bounded loading deadline, reports progress, and never logs arbitrary peer text',
  { timeout: 45000 },
  async () => {
    const events: Entry[] = [];
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const gateway = await createGateway({
      build,
      content,
      admit: async () => ({
        actor,
        expiresAt: Date.now() + 30000,
        revalidate: async () => {
          await held;
          return { actor, expiresAt: Date.now() + 30000 };
        },
      }),
      onEvent: (name, context) => events.push({ name, context }),
    });
    assert.ok(gateway.address && typeof gateway.address === 'object');
    const origin = `http://127.0.0.1:${gateway.address.port}`;
    const clients: WebSocket[] = [];
    try {
      const admission = await fetch(origin + '/api/voxel/admission', {
        method: 'POST',
        body: JSON.stringify({ room: 'logging' }),
      });
      const value = (await admission.json()) as { ticket: string; buildId: string };
      const socket = new WebSocket(origin.replace('http:', 'ws:') + '/voxel');
      clients.push(socket);
      await once(socket, 'open');
      const closed = once(socket, 'close');
      socket.send(JSON.stringify({ type: 'hello', ...value }));
      await delay(5500);
      assert.equal(socket.readyState, WebSocket.OPEN);
      await closed;
      await until(() => events.some((event) => event.name === 'VOXEL_CONNECTION_CLOSED'));
      const issued = events.find((event) => event.name === 'VOXEL_ADMISSION_ISSUED')!.context;
      const close = events.find((event) => event.name === 'VOXEL_CONNECTION_CLOSED')!.context;
      assert.equal(close.reason, 'join_timeout');
      assert.equal(close.phase, 'revalidating');
      assert.equal(close.room, 'logging');
      assert.equal(close.admissionId, issued.admissionId);
      assert.equal(admission.headers.get('x-correlation-id'), issued.admissionId);
      assert.equal(close.code, 1013);
      assert.ok(Number(close.duration_ms) >= 29900);
      assert.match(String(close.connectionId), /^[a-f0-9-]{36}$/);
      assert.doesNotMatch(JSON.stringify(events), new RegExp(value.ticket));
      const peer = new WebSocket(origin.replace('http:', 'ws:') + '/voxel');
      clients.push(peer);
      await once(peer, 'open');
      const peerClosed = once(peer, 'close');
      peer.close(1000, 'private-token-fixture');
      await peerClosed;
      assert.doesNotMatch(JSON.stringify(events), /private-token-fixture/);
    } finally {
      release();
      for (const client of clients) client.terminate();
      await gateway.close();
    }
  },
);

test(
  'authorization recovery retains room and connection context through detach, retirement, and worker exit',
  { timeout: 12000 },
  async () => {
    const events: Entry[] = [];
    const backend = new MemoryCheckpoints();
    let release!: () => void;
    const held = new Promise<null>((resolve) => {
      release = () => resolve(null);
    });
    const gateway = await createGateway({
      build,
      content,
      persistence: { objects: backend, metadata: backend },
      admit: async () => ({
        actor,
        expiresAt: Date.now() + 30000,
        revalidate: async (stage) =>
          stage === 'actor' ? held : { actor, expiresAt: Date.now() + 2500 },
      }),
      onEvent: (name, context) => events.push({ name, context }),
    });
    assert.ok(gateway.address && typeof gateway.address === 'object');
    const origin = `http://127.0.0.1:${gateway.address.port}`;
    let probe: SocketProbe | undefined;
    try {
      const response = await fetch(origin + '/api/voxel/admission', {
        method: 'POST',
        body: JSON.stringify({ room: 'logging' }),
      });
      const value = (await response.json()) as { ticket: string; buildId: string };
      probe = new SocketProbe(origin.replace('http:', 'ws:') + '/voxel', content.blocks.length);
      await once(probe.socket, 'open');
      probe.send({ type: 'hello', ...value });
      const closed = once(probe.socket, 'close');
      await probe.event('welcome');
      await closed;
      await until(() => events.some((event) => event.name === 'VOXEL_ROOM_SAVED_AND_RELEASED'));
      const ready = events.find((event) => event.name === 'VOXEL_ROOM_READY')!.context;
      const accepted = events.find((event) => event.name === 'VOXEL_ADMISSION_ACCEPTED')!.context;
      const disconnected = events.find(
        (event) => event.name === 'VOXEL_ACTOR_DISCONNECTED',
      )!.context;
      const close = events.find((event) => event.name === 'VOXEL_CONNECTION_CLOSED')!.context;
      for (const name of [
        'VOXEL_ADMISSION_ACCEPTED',
        'VOXEL_ACTOR_DISCONNECTED',
        'VOXEL_CONNECTION_CLOSED',
        'VOXEL_ROOM_RETIRING',
        'VOXEL_ROOM_EXITED',
        'VOXEL_ROOM_SAVED_AND_RELEASED',
      ]) {
        const context = events.find((event) => event.name === name)!.context;
        assert.equal(context.room, 'logging', name);
        assert.equal(context.worldId, ready.worldId, name);
        assert.equal(context.roomInstanceId, ready.roomInstanceId, name);
      }
      assert.equal(accepted.actorId, actor.id);
      assert.equal(accepted.role, actor.role);
      assert.equal(close.actorId, actor.id);
      assert.equal(close.connectionId, accepted.connectionId);
      assert.equal(close.reportedEvent, 'VOXEL_ACTOR_DISCONNECTED');
      assert.equal(disconnected.connectionId, accepted.connectionId);
      assert.equal(disconnected.authorizationFailure, 'expired');
      if (disconnected.origin === 'authorization') {
        assert.equal(disconnected.renewalInFlight, true);
        assert.ok(Number(disconnected.renewalAttempts) >= 1);
        // Node may deliver the millisecond expiry timer just before its fractional deadline.
        assert.ok(Number(disconnected.proofRemainingMs) <= 2);
      } else {
        assert.equal(disconnected.cause, 'authorization_expired');
      }
      assert.equal(
        events.find((event) => event.name === 'VOXEL_ROOM_EXITED')!.context.expected,
        true,
      );
      assert.equal(
        events.find((event) => event.name === 'VOXEL_ROOM_RETIRING')!.context.reason,
        'last_connection_left',
      );
      assert.doesNotMatch(JSON.stringify(events), new RegExp(value.ticket));
    } finally {
      release();
      probe?.socket.terminate();
      await gateway.close();
    }
  },
);
