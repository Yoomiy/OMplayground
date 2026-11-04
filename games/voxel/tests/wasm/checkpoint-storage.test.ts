import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { MemoryCheckpoints } from '../fixtures/checkpoint-storage.ts';
import { CheckpointStorage, CheckpointFenced } from '../../src/server/checkpoint-storage.ts';
import { GameRoom } from '../../src/sim/game-room.ts';
import { roomFixture } from './room-fixture.ts';
import { engine, content } from './fixture.ts';
import type { RoomCheckpoint } from '../../src/sim/room-checkpoint.ts';
import type { BuildIdentity } from '../../src/shared/protocol.ts';
const build = JSON.parse(
  readFileSync(new URL('../../artifacts/build.json', import.meta.url), 'utf8'),
) as BuildIdentity;
function repository(backend: MemoryCheckpoints, worldId: string) {
  return new CheckpointStorage(worldId, backend, backend, content.manifest, build);
}
function atWorld(snapshot: RoomCheckpoint, worldId: string): RoomCheckpoint {
  return { ...snapshot, worldId };
}

test('immutable checkpoint graphs reuse unchanged columns, commit coherent private state last and reconstruct a fresh native room', async () => {
  const f = roomFixture('survival', 0, true),
    backend = new MemoryCheckpoints();
  let restored: GameRoom | undefined;
  try {
    const lease = (await backend.acquire('school', 'gateway-a'))!,
      store = repository(backend, lease.worldId);
    f.room.inventories.receive('a', { itemType: 'stone', count: 23 });
    f.store.require([
      [0, 100, 0],
      [16, 100, 0],
    ]);
    while (f.store.generateOne()) {}
    f.store.set(1, 100, 0, content.defaults.test_299);
    f.store.set(17, 100, 0, content.defaults.stone);
    const first = atWorld(f.room.checkpoint(f.now), lease.worldId);
    const pointer1 = await store.save(lease, 1, first);
    assert.equal(backend.puts.length, 3, 'two changed columns and one coherent root');
    assert.deepEqual(backend.rows.get('school')!.checkpoint, pointer1);
    const pointer2 = await store.save({ ...lease, sequence: 1 }, 2, first);
    assert.equal(backend.puts.length, 4, 'unchanged terrain references are reused without uploads');
    f.store.set(2, 100, 0, content.defaults.test_299);
    const third = atWorld(f.room.checkpoint(f.now), lease.worldId);
    const pointer3 = await store.save({ ...lease, sequence: 2 }, 3, third);
    assert.equal(backend.puts.length, 6, 'one dirty column and one new root');
    const fresh = repository(backend, lease.worldId),
      loaded = await fresh.load(pointer3);
    const world = new engine.VoxelWorld(),
      gen = new engine.TerrainGen(third.seed);
    try {
      restored = GameRoom.fromCheckpoint(
        world,
        gen,
        content.manifest,
        build,
        { send() {}, close() {} },
        loaded,
        100000,
      );
    } catch (error) {
      world.free();
      gen.free();
      throw error;
    }
    assert.equal(world.column_count(), 0);
    const reconstructed = restored.checkpoint(100000);
    assert.deepEqual(reconstructed.world, third.world);
    assert.deepEqual(reconstructed.inventories, third.inventories);
    assert.deepEqual(reconstructed.players[0].vitals, third.players[0].vitals);
    assert.deepEqual(
      (await fresh.load(pointer1)).world,
      first.world,
      'older immutable checkpoints remain intact',
    );
    assert.equal(pointer2.sequence, 2);
  } finally {
    f.room.dispose();
    restored?.dispose();
  }
});

test('a storage failure or rejected commit preserves the last pointer; commit-response loss retries idempotently', async () => {
  const f = roomFixture('survival', 0, true),
    backend = new MemoryCheckpoints();
  try {
    const lease = (await backend.acquire('failure', 'gateway-a'))!,
      store = repository(backend, lease.worldId);
    const snapshot = atWorld(f.room.checkpoint(f.now), lease.worldId);
    const first = await store.save(lease, 1, snapshot),
      nextLease = { ...lease, sequence: 1 };
    backend.failPut = async () => {
      throw new Error('storage unavailable');
    };
    await assert.rejects(store.save(nextLease, 2, snapshot), /storage unavailable/);
    assert.deepEqual(backend.rows.get('failure')!.checkpoint, first);
    backend.failPut = null;
    backend.failCommit = async () => {
      throw new Error('database unavailable');
    };
    await assert.rejects(store.save(nextLease, 2, snapshot), /database unavailable/);
    assert.deepEqual(backend.rows.get('failure')!.checkpoint, first);
    backend.failCommit = null;
    backend.loseCommitResponse = true;
    await assert.rejects(store.save(nextLease, 2, snapshot), /response lost/);
    const committed = backend.rows.get('failure')!.checkpoint!;
    assert.equal(committed.sequence, 2);
    assert.deepEqual(await store.save(nextLease, 2, snapshot), committed);
    assert.equal(backend.commits.length, 2, 'retry never creates a second commit');
    assert.deepEqual((await store.load(first)).inventories, snapshot.inventories);
  } finally {
    f.room.dispose();
  }
});

test('a stale owner cannot advance a pointer after takeover; the new epoch keeps world identity and committed state', async () => {
  const f = roomFixture('survival', 0, true),
    backend = new MemoryCheckpoints();
  try {
    const first = (await backend.acquire('lease', 'gateway-a'))!,
      oldStore = repository(backend, first.worldId);
    const snapshot = atWorld(f.room.checkpoint(f.now), first.worldId);
    const pointer = await oldStore.save(first, 1, snapshot);
    assert.equal(await backend.acquire('lease', 'gateway-b'), null);
    backend.now = 30000;
    const next = (await backend.acquire('lease', 'gateway-b'))!;
    assert.equal(next.worldId, first.worldId);
    assert.equal(next.epoch, first.epoch + 1);
    assert.equal(next.sequence, 1);
    assert.deepEqual(next.checkpoint, pointer);
    assert.equal(await backend.renew(first), null);
    await assert.rejects(oldStore.save({ ...first, sequence: 1 }, 2, snapshot), CheckpointFenced);
    assert.deepEqual(backend.rows.get('lease')!.checkpoint, pointer);
    const current = repository(backend, next.worldId);
    await current.load(next.checkpoint!);
    const saved = await current.save(next, 2, snapshot);
    await backend.release(first);
    assert.ok(await backend.renew(next), 'old cleanup cannot release a replacement owner');
    assert.equal(saved.ownerEpoch, next.epoch);
  } finally {
    f.room.dispose();
  }
});

test('capture bytes are detached before asynchronous upload and overlapping saves cannot accumulate snapshots', async () => {
  const f = roomFixture('survival', 0, true),
    backend = new MemoryCheckpoints();
  try {
    f.room.inventories.receive('a', { itemType: 'stone', count: 17 });
    const lease = (await backend.acquire('copy', 'gateway'))!,
      store = repository(backend, lease.worldId);
    const mutable = JSON.parse(JSON.stringify(atWorld(f.room.checkpoint(f.now), lease.worldId)));
    let resolve!: () => void;
    const held = new Promise<void>((r) => (resolve = r));
    backend.failPut = () => held;
    const saving = store.save(lease, 1, mutable);
    try {
      await assert.rejects(store.save(lease, 1, mutable), /already in flight/);
      mutable.inventories.players[0].bag[0].count = 1;
      mutable.players[0].state[0] += 50;
    } finally {
      resolve();
    }
    const pointer = await saving;
    const loaded = await store.load(pointer);
    assert.equal(
      (loaded.inventories as RoomCheckpoint['inventories']).players[0].bag[0]?.count,
      17,
    );
    assert.notEqual(loaded.players[0].state[0], mutable.players[0].state[0]);
    assert.equal(backend.puts.length, 1);
  } finally {
    f.room.dispose();
  }
});

test('missing, truncated, corrupt or cross-world object references fail recovery without changing the active pointer', async () => {
  const f = roomFixture('survival', 0, true),
    backend = new MemoryCheckpoints();
  try {
    const lease = (await backend.acquire('integrity', 'gateway'))!,
      store = repository(backend, lease.worldId);
    const pointer = await store.save(lease, 1, atWorld(f.room.checkpoint(f.now), lease.worldId));
    const bytes = backend.objects.get(pointer.object.key)!;
    backend.objects.delete(pointer.object.key);
    await assert.rejects(store.load(pointer), /missing/);
    backend.objects.set(pointer.object.key, bytes.slice(1));
    await assert.rejects(store.load(pointer), /integrity/);
    const corrupted = Uint8Array.from(bytes);
    corrupted[0] ^= 1;
    backend.objects.set(pointer.object.key, corrupted);
    await assert.rejects(store.load(pointer), /integrity/);
    backend.objects.set(pointer.object.key, bytes);
    const wrong = repository(backend, 'different-world');
    await assert.rejects(wrong.load(pointer), /reference/);
    await assert.rejects(store.load({ ...pointer, ownerEpoch: 2 }), /manifest/);
    assert.deepEqual(backend.rows.get('integrity')!.checkpoint, pointer);
    assert.ok(await store.load(pointer));
  } finally {
    f.room.dispose();
  }
});
