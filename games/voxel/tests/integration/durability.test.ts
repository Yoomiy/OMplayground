import { developmentAdmission } from '../../tools/development-admission.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { MemoryCheckpoints } from '../fixtures/checkpoint-storage.ts';
import { connectProbe } from '../fixtures/socket-probe.ts';
import type { SocketProbe } from '../fixtures/socket-probe.ts';
import { CheckpointStorage } from '../../src/server/checkpoint-storage.ts';
import { RoomDurability } from '../../src/server/room-durability.ts';
import { initSync, set_content, VoxelWorld, TerrainGen } from '../../engine/pkg/voxel_engine.js';
import { GameRoom } from '../../src/sim/game-room.ts';
import { WorldStore } from '../../src/sim/world-store.ts';
import { source } from '../../content/index.ts';
import { compileContent } from '../../tools/compile-content.ts';
import type { BuildIdentity } from '../../src/shared/protocol.ts';
import type { OwnerResolver } from '../../src/server/owner-authorization.ts';
import { Explosives } from '../../src/sim/explosives.ts';
const { createGateway }: typeof import('../../src/server/gateway.ts') = process.env
  .VOXEL_TEST_BUNDLE
  ? await import(new URL('../../dist-server/gateway.js', import.meta.url).href)
  : await import('../../src/server/gateway.ts');
const build = JSON.parse(
  readFileSync(new URL('../../artifacts/build.json', import.meta.url), 'utf8'),
) as BuildIdentity;
const content = compileContent(source);
initSync({
  module: readFileSync(new URL('../../engine/pkg/voxel_engine_bg.wasm', import.meta.url)),
});
set_content(JSON.stringify(content.manifest));

test(
  'the live gateway autosave timer commits a coherent checkpoint within the healthy durability window',
  { timeout: 25000 },
  async () => {
    const backend = new MemoryCheckpoints(),
      { gateway, origin } = await gatewayFor(backend);
    let probe: SocketProbe | undefined;
    try {
      probe = await connectProbe(origin, 'autosave', content.manifest.blocks.length);
      await probe.ready();
      const started = performance.now();
      while (!backend.rows.get('autosave')!.checkpoint && performance.now() - started < 22000)
        await delay(50);
      const row = backend.rows.get('autosave')!,
        pointer = row.checkpoint;
      assert.ok(pointer, 'autosave commits without an explicit lifecycle call');
      assert.ok(performance.now() - started < 30000);
      const snapshot = await new CheckpointStorage(
        row.worldId,
        backend,
        backend,
        content.manifest,
        build,
      ).load(pointer);
      assert.equal(snapshot.paused, false);
      assert.equal(snapshot.players.length, 1);
      assert.ok(snapshot.tick >= 400);
      assert.equal(snapshot.worldId, (await probe.event('welcome')).worldId);
    } finally {
      probe?.socket.terminate();
      await gateway.close();
    }
  },
);
const admitted = (id = 'a') => ({
  id,
  role: 'participant' as const,
  capabilities: { build: true, fly: true, observe: false, combat: true, explosives: true },
});

test(
  'last-player departure commits a pause before releasing ownership and a racing join waits for that checkpoint',
  { timeout: 15000 },
  async () => {
    const backend = new MemoryCheckpoints(),
      { gateway, origin } = await gatewayFor(backend);
    let old: SocketProbe | undefined, next: SocketProbe | undefined, unblock!: () => void;
    try {
      old = await connectProbe(origin, 'departure', content.manifest.blocks.length);
      await old.ready();
      let entered!: () => void;
      const committing = new Promise<void>((r) => (entered = r)),
        held = new Promise<void>((r) => (unblock = r));
      backend.failCommit = async () => {
        entered();
        await held;
      };
      const closing = once(old.socket, 'close');
      old.socket.terminate();
      await closing;
      await Promise.race([
        committing,
        delay(2000).then(() => {
          throw new Error('last-player commit did not start');
        }),
      ]);
      let joined = false;
      const joining = connectProbe(origin, 'departure', content.manifest.blocks.length).then(
        (probe) => {
          joined = true;
          next = probe;
          return probe;
        },
      );
      void joining.catch(() => {});
      await delay(40);
      assert.equal(joined, false);
      assert.equal(backend.rows.get('departure')!.epoch, 1);
      assert.equal(backend.rows.get('departure')!.checkpoint, null);
      unblock();
      backend.failCommit = null;
      next = await joining;
      const row = backend.rows.get('departure')!,
        welcome = await next.event('welcome');
      assert.equal(row.epoch, 2);
      assert.equal(welcome.worldId, row.worldId);
      const checkpoint = await new CheckpointStorage(
        row.worldId,
        backend,
        backend,
        content.manifest,
        build,
      ).load(row.checkpoint!);
      assert.equal(checkpoint.paused, true);
      assert.equal(checkpoint.players.length, 1);
      assert.ok(checkpoint.players[0].reservationMs! > 0);
      gateway.resume('departure');
      await next.ready();
    } finally {
      unblock?.();
      backend.failCommit = null;
      old?.socket.terminate();
      next?.socket.terminate();
      await gateway.close();
    }
  },
);

test(
  'drain reports storage failure instead of claiming a successful save, and still stops its worker and releases its lease',
  { timeout: 15000 },
  async () => {
    const backend = new MemoryCheckpoints(),
      { gateway, origin } = await gatewayFor(backend);
    let probe: SocketProbe | undefined,
      closed = false;
    try {
      probe = await connectProbe(origin, 'drain', content.manifest.blocks.length);
      await probe.ready();
      backend.failPut = async () => {
        throw new Error('storage unavailable');
      };
      await assert.rejects(gateway.close(), /storage unavailable/);
      closed = true;
      assert.equal(gateway.rooms.size, 0);
      assert.equal(backend.rows.get('drain')!.checkpoint, null);
      assert.equal(backend.rows.get('drain')!.deadline, backend.now);
    } finally {
      probe?.socket.terminate();
      backend.failPut = null;
      if (!closed) await gateway.close();
    }
  },
);
async function gatewayFor(backend: MemoryCheckpoints, resolveOwner?: OwnerResolver) {
  const gateway = await createGateway({
    build,
    content: content.manifest,
    worldDefaults: { mode: 'survival' },
    resolveOwner,
    persistence: {
      objects: backend,
      metadata: backend,
      resolveOwner: async (_room, id) => admitted(id),
    },
    admit: async (request) =>
      developmentAdmission(admitted(String(request.headers['x-test-actor'] ?? 'a'))),
  });
  assert.ok(gateway.address && typeof gateway.address === 'object');
  return { gateway, origin: `http://127.0.0.1:${gateway.address.port}` };
}

test(
  'live gateway owner refresh preserves an offline fuse through policy outages and commits its explicit revocation',
  { timeout: 12000 },
  async () => {
    const backend = new MemoryCheckpoints(),
      lease = (await backend.acquire('owner-refresh', 'seed'))!;
    const room = new GameRoom(
      new WorldStore(new VoxelWorld(), new TerrainGen(4242)),
      content.manifest,
      build,
      { send() {}, close() {} },
      lease.worldId,
      4242,
      0,
      0,
      'survival',
    );
    const rule = content.manifest.behavior.find((block) => block.family === 'tnt')!.explosive!;
    try {
      room.join(admitted(), 'seed', 0);
      const p = room.checkpoint(0).spawn;
      room.explosives.add('a', content.defaults.tnt, [p[0] + 8, p[1] + 0.1, p[2] + 8], rule);
      await new CheckpointStorage(lease.worldId, backend, backend, content.manifest, build).save(
        lease,
        1,
        room.checkpoint(0),
      );
      await backend.release(lease);
    } finally {
      room.dispose();
    }
    let checks = 0,
      revoked = false;
    const { gateway, origin } = await gatewayFor(backend, async (_room, id) => {
      checks++;
      if (checks === 1) return admitted(id); // explicit startup reconstruction proof
      if (revoked) return null;
      throw new Error('private provider outage');
    });
    let viewer: SocketProbe | undefined;
    try {
      viewer = await connectProbe(
        origin,
        'owner-refresh',
        content.manifest.blocks.length,
        'viewer',
      );
      await viewer.ready();
      await delay(4300);
      const storage = new CheckpointStorage(
        lease.worldId,
        backend,
        backend,
        content.manifest,
        build,
      );
      const held = await storage.load(await gateway.save('owner-refresh', true));
      const heldBombs = Explosives.fromCheckpoint(content.manifest, held.explosives).checkpoint(
        content.manifest,
      ).entries;
      assert.ok(checks >= 3);
      assert.equal(heldBombs.length, 1);
      assert.equal(heldBombs[0].remaining, 0);
      assert.equal(heldBombs[0].owner, 'a');
      revoked = true;
      gateway.resume('owner-refresh');
      assert.equal((await viewer.event('explosion')).cancelled, true);
      const finished = await storage.load(await gateway.save('owner-refresh', true));
      assert.equal(Explosives.fromCheckpoint(content.manifest, finished.explosives).size, 0);
    } finally {
      viewer?.socket.terminate();
      await gateway.close();
    }
  },
);

test(
  'concurrent joins allocate one durable owner and queued autosaves coalesce without acknowledging pause before commit',
  { timeout: 15000 },
  async () => {
    const backend = new MemoryCheckpoints(),
      { gateway, origin } = await gatewayFor(backend);
    const probes: SocketProbe[] = [];
    let unblock: (() => void) | undefined;
    try {
      probes.push(
        ...(await Promise.all(
          ['a', 'b'].map((id) =>
            connectProbe(origin, 'coalesce', content.manifest.blocks.length, id),
          ),
        )),
      );
      await Promise.all(probes.map((probe) => probe.ready()));
      assert.equal(gateway.rooms.size, 1);
      assert.equal(backend.rows.get('coalesce')!.epoch, 1);
      let entered!: () => void;
      const committing = new Promise<void>((r) => (entered = r)),
        held = new Promise<void>((r) => (unblock = r));
      backend.failCommit = async () => {
        entered();
        await held;
      };
      const first = gateway.save('coalesce');
      await committing;
      const autosaves = Array.from({ length: 80 }, () => gateway.save('coalesce'));
      let acknowledged = false;
      const paused = gateway.save('coalesce', true).then((pointer) => {
        acknowledged = true;
        return pointer;
      });
      await probes[0].wait(
        (
          event,
        ): event is Extract<
          import('../../src/shared/protocol.ts').ServerMessage,
          { type: 'baseline' }
        > =>
          'type' in event &&
          event.type === 'baseline' &&
          event.reason === 'pause' &&
          event.phase === 'paused',
      );
      await delay(40);
      assert.equal(acknowledged, false);
      assert.equal(backend.rows.get('coalesce')!.checkpoint, null);
      unblock!();
      backend.failCommit = null;
      assert.equal((await first).sequence, 1);
      const committed = await paused;
      assert.equal(committed.sequence, 2);
      assert.ok((await Promise.all(autosaves)).every((pointer) => pointer.sequence === 2));
      assert.equal(backend.commits.length, 2);
      const loaded = await new CheckpointStorage(
        backend.rows.get('coalesce')!.worldId,
        backend,
        backend,
        content.manifest,
        build,
      ).load(committed);
      assert.equal(loaded.paused, true);
      assert.equal(loaded.players.length, 2);
    } finally {
      unblock?.();
      backend.failCommit = null;
      for (const probe of probes) probe.socket.terminate();
      await gateway.close();
    }
  },
);

test(
  'gateway worker crash restores the committed world, owned inventory and dropped stack under a new lease/input epoch',
  { timeout: 15000 },
  async () => {
    const backend = new MemoryCheckpoints(),
      room = new GameRoom(
        new WorldStore(new VoxelWorld(), new TerrainGen(4242)),
        content.manifest,
        build,
        { send() {}, close() {} },
        'seed-room',
        4242,
        0,
        0,
        'survival',
      );
    const seedLease = (await backend.acquire('recover', 'seed-checkpoint'))!;
    try {
      room.join(admitted(), 'seed-connection', 0);
      room.inventories.receive('a', { itemType: 'stone', count: 23 });
      await new CheckpointStorage(
        seedLease.worldId,
        backend,
        backend,
        content.manifest,
        build,
      ).save(seedLease, 1, { ...room.checkpoint(0), worldId: seedLease.worldId });
      await backend.release(seedLease);
    } finally {
      room.dispose();
    }
    const { gateway, origin } = await gatewayFor(backend),
      probes: SocketProbe[] = [];
    try {
      const before = await connectProbe(origin, 'recover', content.manifest.blocks.length);
      probes.push(before);
      const initial = await before.ready(),
        inventory = await before.event('inventory');
      assert.equal(inventory.view.bag[0]?.count, 23);
      before.send({
        type: 'inventory',
        epoch: initial.epoch,
        sequence: 1,
        operation: { kind: 'drop', slot: 0, count: 2, revision: inventory.view.revision },
      });
      const result = await before.event('result');
      assert.equal(result.outcome?.ok, true);
      const pointer = await gateway.save('recover', true);
      const stored = new CheckpointStorage(
        seedLease.worldId,
        backend,
        backend,
        content.manifest,
        build,
      );
      const snapshot = await stored.load(pointer);
      assert.equal((snapshot.inventories as any).players[0].bag[0].count, 21);
      assert.equal((snapshot.drops as any).entries[0].stack.count, 2);
      const oldHandle = gateway.rooms.get('recover')!,
        closed = once(before.socket, 'close');
      await oldHandle.worker.terminate();
      await closed;
      // Failure cleanup releases the old lease only after the old worker has stopped.
      for (let n = 0; backend.rows.get('recover')!.deadline > backend.now && n < 100; n++)
        await delay(5);
      assert.equal(backend.rows.get('recover')!.deadline, backend.now);
      const after = await connectProbe(origin, 'recover', content.manifest.blocks.length);
      probes.push(after);
      const welcome = await after.event('welcome'),
        restored = await after.event('inventory');
      assert.equal(welcome.worldId, seedLease.worldId);
      assert.ok(welcome.epoch > initial.epoch);
      assert.equal(restored.view.bag[0]?.count, 21);
      assert.equal(backend.rows.get('recover')!.epoch, 3);
      const recovered = await stored.load(await gateway.save('recover', true));
      assert.deepEqual(recovered.world, snapshot.world);
      assert.deepEqual(recovered.drops, snapshot.drops);
      assert.deepEqual(recovered.inventories, snapshot.inventories);
    } finally {
      for (const probe of probes) probe.socket.terminate();
      await gateway.close();
    }
  },
);

test(
  'a failed save stays unsaved and retries the identical graph before committing a newer explicit pause',
  { timeout: 15000 },
  async () => {
    const backend = new MemoryCheckpoints(),
      { gateway, origin } = await gatewayFor(backend);
    let probe: SocketProbe | undefined;
    try {
      probe = await connectProbe(origin, 'retry', content.manifest.blocks.length);
      await probe.ready();
      backend.loseCommitResponse = true;
      await assert.rejects(gateway.save('retry'), /response lost/);
      const first = backend.rows.get('retry')!.checkpoint!;
      assert.equal(first.sequence, 1);
      const paused = await gateway.save('retry', true);
      assert.equal(paused.sequence, 2);
      assert.equal(backend.commits.length, 2);
      const stored = new CheckpointStorage(
        backend.rows.get('retry')!.worldId,
        backend,
        backend,
        content.manifest,
        build,
      );
      assert.equal((await stored.load(first)).paused, false);
      assert.equal((await stored.load(paused)).paused, true);
    } finally {
      probe?.socket.terminate();
      await gateway.close();
    }
  },
);

test(
  'ownership renewal outage stops worker publication and disconnects players before the confirmed lease expires',
  { timeout: 10000 },
  async () => {
    const backend = new MemoryCheckpoints(),
      acquire = backend.acquire.bind(backend);
    backend.acquire = async (room, owner) => {
      const lease = await acquire(room, owner);
      return lease && { ...lease, validForMs: 2200 };
    };
    backend.renew = async () => {
      throw new Error('metadata unavailable');
    };
    const { gateway, origin } = await gatewayFor(backend);
    let probe: SocketProbe | undefined;
    try {
      probe = await connectProbe(origin, 'fence', content.manifest.blocks.length);
      const handle = gateway.rooms.get('fence')!,
        closed = once(probe.socket, 'close');
      const deadline = handle.durability!.ownershipDeadline;
      await closed;
      assert.ok(performance.now() >= deadline - 30);
      assert.ok(
        performance.now() < deadline + 1000,
        'disconnect precedes the service lease expiration safety boundary',
      );
      assert.equal(gateway.rooms.size, 0);
      assert.ok(
        probe.events.some(
          (event) => 'type' in event && event.type === 'error' && event.code === 'RECOVERING',
        ),
      );
      assert.equal(backend.rows.get('fence')!.checkpoint, null);
      await assert.rejects(gateway.save('fence'), /unavailable/);
    } finally {
      probe?.socket.terminate();
      await gateway.close();
    }
  },
);

test('overlapping shutdown callers wait for the same confirmed lease release', async () => {
  const backend = new MemoryCheckpoints(),
    release = backend.release.bind(backend);
  let unblock!: () => void,
    calls = 0,
    acknowledged = false;
  const held = new Promise<void>((resolve) => (unblock = resolve));
  backend.release = async (lease) => {
    calls++;
    await held;
    await release(lease);
  };
  const durability = await RoomDurability.acquire(
    { objects: backend, metadata: backend },
    content.manifest,
    build,
    'shared-release',
    'gateway',
    () => {},
  );
  try {
    const first = durability.close(),
      second = durability.close();
    assert.equal(first, second);
    const waiting = second.then(() => (acknowledged = true));
    await delay(10);
    assert.equal(calls, 1);
    assert.equal(acknowledged, false);
    unblock();
    await Promise.all([first, waiting]);
    assert.equal(acknowledged, true);
    assert.equal(backend.rows.get('shared-release')!.deadline, backend.now);
  } finally {
    unblock();
    await durability.close();
  }
});
