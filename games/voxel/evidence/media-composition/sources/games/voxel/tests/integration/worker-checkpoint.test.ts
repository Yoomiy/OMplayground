import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { Worker } from 'node:worker_threads';
import { setTimeout as delay } from 'node:timers/promises';
import { roomFixture } from '../wasm/room-fixture.ts';
import { content } from '../wasm/fixture.ts';
import type { AdmittedActor } from '../../src/sim/game-room.ts';
import type { RoomCheckpoint } from '../../src/sim/room-checkpoint.ts';
import type { BuildIdentity, ServerMessage } from '../../src/shared/protocol.ts';
import type { FromRoom, ToRoom, RoomWorkerData } from '../../src/server/room-worker-protocol.ts';

const build = JSON.parse(
  readFileSync(new URL('../../artifacts/build.json', import.meta.url), 'utf8'),
) as BuildIdentity;
const module = await WebAssembly.compile(
  readFileSync(new URL('../../engine/pkg/voxel_engine_bg.wasm', import.meta.url)),
);
const owner: AdmittedActor = {
  id: 'a',
  role: 'participant',
  capabilities: { build: true, fly: true, observe: false, combat: true, explosives: true },
};

class RoomWorker {
  worker: Worker;
  events: FromRoom[] = [];
  listeners = new Set<() => void>();
  ended: { code: number } | null = null;
  error: Error | null = null;
  requestId = 0;
  constructor(
    start: RoomWorkerData['start'],
    ownershipDeadline?: number,
    refreshOwners = false,
    enforceLifecycle = false,
  ) {
    this.worker = new Worker(
      new URL(
        process.env.VOXEL_TEST_BUNDLE
          ? '../../dist-server/room-worker.js'
          : '../../src/server/room-worker.ts',
        import.meta.url,
      ),
      {
        workerData: {
          module,
          build,
          content: content.manifest,
          start,
          refreshOwners,
          enforceLifecycle,
          ...(ownershipDeadline === undefined ? {} : { ownershipDeadline }),
        } satisfies RoomWorkerData,
      },
    );
    this.worker.on('message', (event: FromRoom) => {
      this.events.push(event);
      for (const notify of this.listeners) notify();
    });

    this.worker.on('error', (error) => {
      this.error = error;
      for (const notify of this.listeners) notify();
    });
    this.worker.on('exit', (code) => {
      this.ended = { code };
      for (const notify of this.listeners) notify();
    });
  }
  send(message: ToRoom) {
    this.worker.postMessage(message);
  }
  wait<T extends FromRoom>(predicate: (event: FromRoom) => event is T): Promise<T> {
    return new Promise((resolve, reject) => {
      const finish = (error: Error | null, value?: T) => {
        clearTimeout(timeout);
        this.listeners.delete(check);
        if (error) reject(error);
        else resolve(value!);
      };
      const check = () => {
        const found = this.events.find(predicate);
        if (found) finish(null, found);
        else if (this.error || this.ended)
          finish(this.error ?? new Error(`worker exited: ${this.ended!.code}`));
      };
      const timeout = setTimeout(() => finish(new Error('worker event timeout')), 10000);
      this.listeners.add(check);
      check();
    });
  }
  async checkpoint(pause = true): Promise<RoomCheckpoint> {
    const requestId = ++this.requestId;
    this.send({ type: 'checkpoint', requestId, pause });
    const response = await this.wait(
      (event): event is Extract<FromRoom, { type: 'checkpoint' | 'checkpoint-failed' }> =>
        (event.type === 'checkpoint' || event.type === 'checkpoint-failed') &&
        event.requestId === requestId,
    );
    assert.equal(response.type, 'checkpoint');
    return (response as Extract<FromRoom, { type: 'checkpoint' }>).checkpoint;
  }
  async outbound<T extends ServerMessage['type']>(type: T) {
    const response = await this.wait(
      (event): event is Extract<FromRoom, { type: 'send' }> =>
        event.type === 'send' &&
        typeof event.payload === 'string' &&
        JSON.parse(event.payload).type === type,
    );
    return JSON.parse(response.payload as string) as Extract<ServerMessage, { type: T }>;
  }
  async close() {
    if (!this.ended) {
      this.send({ type: 'stop' });
      const force = setTimeout(() => void this.worker.terminate(), 2000);
      await new Promise<void>((resolve) => this.worker.once('exit', () => resolve()));
      clearTimeout(force);
    }
  }
}

test(
  'a real room worker captures at a message boundary, freezes on pause and resumes earned ticks without changing an earlier capture',
  { timeout: 15000 },
  async () => {
    const peer = new RoomWorker({
      type: 'fresh',
      worldId: 'worker-fresh',
      seed: 4242,
      initialTick: 1200,
      mode: 'survival',
    });
    try {
      await peer.wait(
        (event): event is Extract<FromRoom, { type: 'ready' }> => event.type === 'ready',
      );
      peer.send({
        type: 'join',
        authorizationUntil: performance.now() + 30000,
        actor: owner,
        connection: 'first',
      });
      await peer.outbound('baseline');
      const first = await peer.checkpoint(),
        bytes = JSON.stringify(first);
      assert.equal(first.worldId, 'worker-fresh');
      assert.equal(first.mode, 'survival');
      assert.ok(first.tick >= 1200);
      assert.equal(first.paused, true);
      assert.deepEqual(
        first.players.map((player) => player.id),
        ['a'],
      );
      await delay(110);
      const paused = await peer.checkpoint(false);
      assert.equal(paused.tick, first.tick);
      assert.deepEqual(paused.players[0].vitals, first.players[0].vitals);
      peer.send({ type: 'resume' });
      await delay(110);
      const later = await peer.checkpoint();
      assert.ok(later.tick > first.tick);
      assert.ok(later.epoch > first.epoch);
      assert.equal(JSON.stringify(first), bytes);
    } finally {
      await peer.close();
    }
    assert.equal(peer.error, null);
    assert.equal(peer.ended?.code, 0);
    assert.equal(
      peer.events.some((event) => event.type === 'fault'),
      false,
    );
  },
);

test(
  'offline TNT owner deadlines hold due work while the supervisor stalls and late proofs cannot revive an older request',
  { timeout: 10000 },
  async () => {
    const f = roomFixture('survival', 0, true);
    let snapshot: RoomCheckpoint;
    try {
      const p = f.state(),
        rule = content.manifest.behavior.find((block) => block.family === 'tnt')!.explosive!;
      f.room.requireOwnerAuthorizations();
      f.room.explosives.add('a', content.defaults.tnt, [p[0] + 8, p[1] + 0.1, p[2] + 8], rule);
      f.tick(108);
      snapshot = f.room.checkpoint(f.now);
      assert.equal(snapshot.explosives.entries[0].remaining, 12);
    } finally {
      f.room.dispose();
    }
    const peer = new RoomWorker(
      { type: 'restore', checkpoint: snapshot, owners: [['a', owner]] },
      undefined,
      true,
    );
    try {
      const first = await peer.wait(
        (event): event is Extract<FromRoom, { type: 'owner-authorization-needed' }> =>
          event.type === 'owner-authorization-needed',
      );
      peer.send({
        type: 'owner-authorization',
        requestId: first.requestId,
        owners: [['a', owner]],
        deadline: Math.min(first.deadline, performance.now() + 100),
      });
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1300);
      const held = await peer.checkpoint(false);
      assert.ok(held.tick >= snapshot.tick + 15);
      assert.equal(held.explosives.entries.length, 1);
      assert.equal(held.explosives.entries[0].remaining, 0);
      const next = await peer.wait(
        (event): event is Extract<FromRoom, { type: 'owner-authorization-needed' }> =>
          event.type === 'owner-authorization-needed' && event.requestId > first.requestId,
      );
      peer.send({
        type: 'owner-authorization',
        requestId: first.requestId,
        owners: [['a', owner]],
        deadline: performance.now() + 1000,
      });
      await delay(50);
      assert.equal((await peer.checkpoint(false)).explosives.entries.length, 1);
      peer.send({
        type: 'owner-authorization',
        requestId: next.requestId,
        owners: [['a', null]],
        deadline: next.deadline,
      });
      await delay(50);
      assert.equal((await peer.checkpoint(false)).explosives.entries.length, 0);
      assert.equal(peer.error, null);
    } finally {
      await peer.close();
    }
    assert.equal(peer.ended?.code, 0);
  },
);

test(
  'room-policy expiry independently freezes world time during a supervisor stall and old replies cannot unpause it',
  { timeout: 10000 },
  async () => {
    const peer = new RoomWorker(
      {
        type: 'fresh',
        worldId: 'room-policy-expiry',
        seed: 4242,
        initialTick: 0,
        mode: 'survival',
      },
      undefined,
      false,
      true,
    );
    try {
      await peer.wait(
        (event): event is Extract<FromRoom, { type: 'ready' }> => event.type === 'ready',
      );
      peer.send({
        type: 'join',
        actor: owner,
        connection: 'participant',
        authorizationUntil: performance.now() + 30000,
      });
      const first = await peer.wait(
        (event): event is Extract<FromRoom, { type: 'room-policy-needed' }> =>
          event.type === 'room-policy-needed',
      );
      peer.send({
        type: 'room-policy',
        requestId: first.requestId,
        state: 'playing',
        deadline: Math.min(first.deadline, performance.now() + 140),
      });
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 700);
      const held = await peer.checkpoint(false);
      assert.equal(held.paused, true);
      assert.ok(held.tick <= 6);
      const next = await peer.wait(
        (event): event is Extract<FromRoom, { type: 'room-policy-needed' }> =>
          event.type === 'room-policy-needed' && event.requestId > first.requestId,
      );
      peer.send({
        type: 'room-policy',
        requestId: first.requestId,
        state: 'playing',
        deadline: performance.now() + 1000,
      });
      peer.send({ type: 'resume' });
      await delay(80);
      assert.equal((await peer.checkpoint(false)).tick, held.tick);
      peer.send({
        type: 'room-policy',
        requestId: next.requestId,
        state: 'paused',
        deadline: next.deadline,
      });
      peer.send({ type: 'resume' });
      await delay(80);
      const paused = await peer.checkpoint(false);
      assert.equal(paused.paused, true);
      assert.equal(paused.tick, held.tick);
    } finally {
      await peer.close();
    }
    assert.equal(peer.ended?.code, 0);
  },
);

test(
  'worker restart reconstructs one private checkpoint, needs fresh owner authorization, and never advances saved fuses or drops during offline pause',
  { timeout: 15000 },
  async () => {
    const f = roomFixture('survival', 0, true);
    let snapshot: RoomCheckpoint;
    try {
      f.tick(6);
      f.room.inventories.receive('a', { itemType: 'stone', count: 13 });
      f.room.inventories.receive('a', {
        itemType: 'iron_pickaxe',
        count: 1,
        instance: { durability: 79 },
      });
      const state = f.state(),
        rule = content.manifest.behavior.find((block) => block.family === 'tnt')!.explosive!;
      f.store.set(
        Math.floor(state[0]) + 2,
        Math.floor(state[1]) + 3,
        Math.floor(state[2]),
        content.defaults.test_299,
      );
      f.room.drops.add(
        { itemType: 'stone', count: 2 },
        [state[0] + 8, state[1] + 0.1, state[2]],
        6,
        'a',
      );
      f.room.explosives.add(
        'a',
        content.defaults.tnt,
        [state[0] + 8, state[1] + 0.1, state[2] + 8],
        rule,
      );
      f.room.setPaused(true, f.now);
      snapshot = f.room.checkpoint(f.now);
    } finally {
      f.room.dispose();
    }
    const peer = new RoomWorker({ type: 'restore', checkpoint: snapshot, owners: [['a', owner]] });
    try {
      await peer.wait(
        (event): event is Extract<FromRoom, { type: 'ready' }> => event.type === 'ready',
      );
      assert.equal(
        peer.events.some((event) => event.type === 'send'),
        false,
      );
      const first = await peer.checkpoint(false);
      for (const key of [
        'worldId',
        'seed',
        'mode',
        'tick',
        'spawn',
        'world',
        'inventories',
        'drops',
        'explosives',
      ] as const)
        assert.deepEqual(first[key], snapshot[key], key);
      // Mutating the supervisor's structured clone cannot alter the worker or the saved source.
      (first.inventories.players[0].bag[0] as { count: number }).count = 1;
      await delay(110);
      const second = await peer.checkpoint(false);
      assert.deepEqual(second.inventories, snapshot.inventories);
      assert.deepEqual(second.explosives, snapshot.explosives);
      assert.deepEqual(second.drops, snapshot.drops);
      assert.equal(second.tick, snapshot.tick);
      peer.send({
        type: 'join',
        authorizationUntil: performance.now() + 30000,
        actor: {
          ...owner,
          capabilities: { ...owner.capabilities, build: false, explosives: false },
        },
        connection: 'fresh',
      });
      const welcome = await peer.outbound('welcome'),
        inventory = await peer.outbound('inventory');
      assert.ok(welcome.epoch > snapshot.epoch);
      assert.equal(welcome.explosives, false);
      assert.equal(inventory.view.bag[0]?.count, 13);
      assert.equal(inventory.view.bag[1]?.instance?.durability, 79);
      assert.equal(inventory.view.station, 'personal');
      peer.send({ type: 'resume' });
      await delay(110);
      const later = await peer.checkpoint();
      assert.ok(later.tick > snapshot.tick);
      assert.equal(later.explosives.entries[0].remaining, 120 - (later.tick - snapshot.tick));
    } finally {
      await peer.close();
    }
    assert.equal(peer.error, null);
    assert.equal(peer.ended?.code, 0);
  },
);

test(
  'invalid worker recovery faults before ready or player publication instead of silently making a new world',
  { timeout: 15000 },
  async () => {
    for (const checkpoint of [null, { schema: 2 }, { seed: 4242, schema: 1 }]) {
      const peer = new RoomWorker({ type: 'restore', checkpoint, owners: [] });
      try {
        await peer.wait(
          (event): event is Extract<FromRoom, { type: 'fault' }> => event.type === 'fault',
        );
      } finally {
        await peer.close();
      }
      assert.equal(peer.ended?.code, 1);
      assert.equal(
        peer.events.some((event) => event.type === 'ready' || event.type === 'send'),
        false,
      );
    }
  },
);

test(
  'worker ownership deadline still stops ticks and publication while its supervisor event loop is blocked',
  { timeout: 15000 },
  async () => {
    const peer = new RoomWorker(
      { type: 'fresh', worldId: 'worker-fenced', seed: 4242, initialTick: 0, mode: 'survival' },
      performance.now() + 1000,
    );
    try {
      await peer.wait(
        (event): event is Extract<FromRoom, { type: 'ready' }> => event.type === 'ready',
      );
      peer.send({
        type: 'join',
        authorizationUntil: performance.now() + 30000,
        actor: owner,
        connection: 'before-fence',
      });
      await peer.outbound('welcome');
      // Deliberately stall this supervisor, not the room worker, beyond its confirmed deadline.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1100);
      await peer.wait(
        (event): event is Extract<FromRoom, { type: 'fault' }> => event.type === 'fault',
      );
      const fault = peer.events.findIndex((event) => event.type === 'fault');
      assert.equal(
        peer.events
          .slice(fault + 1)
          .some((event) => event.type === 'send' || event.type === 'checkpoint'),
        false,
      );
    } finally {
      await peer.close();
    }
    assert.equal(peer.ended?.code, 1);
  },
);

test(
  'actor authorization expires inside the worker while the supervisor is blocked, without terminating the room or restoring the socket',
  { timeout: 15000 },
  async () => {
    const peer = new RoomWorker({
      type: 'fresh',
      worldId: 'actor-authorization',
      seed: 4242,
      initialTick: 0,
      mode: 'survival',
    });
    try {
      await peer.wait(
        (event): event is Extract<FromRoom, { type: 'ready' }> => event.type === 'ready',
      );
      const deadline = performance.now() + 1100;
      peer.send({
        type: 'join',
        actor: owner,
        connection: 'expired',
        authorizationUntil: deadline,
      });
      await peer.outbound('welcome');
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1200);
      const closed = await peer.wait(
        (event): event is Extract<FromRoom, { type: 'close' }> =>
          event.type === 'close' && event.reason === 'UNAUTHORIZED',
      );
      assert.equal(closed.connection, 'expired');
      peer.send({
        type: 'authorization',
        connection: 'expired',
        deadline: performance.now() + 30000,
      });
      const snapshot = await peer.checkpoint();
      assert.ok(snapshot.players[0].reservationMs !== null);
      assert.equal(
        peer.events.some((event) => event.type === 'fault'),
        false,
      );
      assert.equal(
        peer.events.filter(
          (event) =>
            event.type === 'send' &&
            typeof event.payload === 'string' &&
            JSON.parse(event.payload).type === 'welcome',
        ).length,
        1,
      );
    } finally {
      await peer.close();
    }
    assert.equal(peer.ended?.code, 0);
  },
);
