import { CheckpointStorage } from '../../src/server/checkpoint-storage.ts';
import { MemoryCheckpoints } from '../fixtures/checkpoint-storage.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { initSync, set_content, VoxelWorld, TerrainGen } from '../../engine/pkg/voxel_engine.js';
import { GameRoom } from '../../src/sim/game-room.ts';
import { readRoomCheckpoint } from '../../src/sim/room-checkpoint.ts';
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const content = JSON.parse(read('../../artifacts/content.json'));
const build = JSON.parse(read('../../artifacts/build.json'));
const bytes = read('../fixtures/prior-engine-checkpoint.json');
const saved = JSON.parse(bytes);
const provenance = JSON.parse(read('../fixtures/prior-engine-checkpoint.provenance.json'));
initSync({
  module: readFileSync(new URL('../../engine/pkg/voxel_engine_bg.wasm', import.meta.url)),
});
set_content(JSON.stringify(content));

test('hung storage reads, uploads and commits time out without losing the last save or duplicating a late commit', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const flush = async () => {
    for (let i = 0; i < 30; i++) await Promise.resolve();
  };
  const timeout = async (work: Promise<unknown>) => {
    const rejected = assert.rejects(
      work,
      (error) => error instanceof Error && error.name === 'TimeoutError',
    );
    await flush();
    t.mock.timers.tick(10001);
    return rejected;
  };
  const room = GameRoom.fromCheckpoint(
    new VoxelWorld(),
    new TerrainGen(saved.seed),
    content,
    build,
    { send() {}, close() {} },
    saved,
    1000,
    new Map([
      [
        'compat-player',
        {
          id: 'compat-player',
          role: 'participant',
          capabilities: { build: true, fly: true, observe: false, combat: true, explosives: true },
        },
      ],
    ]),
  );
  const backend = new MemoryCheckpoints();
  try {
    const lease = (await backend.acquire('hung-storage', 'owner'))!;
    const snapshot = { ...room.checkpoint(1000), worldId: lease.worldId };
    const store = new CheckpointStorage(lease.worldId, backend, backend, content, build);
    const first = await store.save(lease, 1, snapshot);
    let releasePut!: () => void;
    backend.failPut = () => new Promise((resolve) => (releasePut = resolve));
    await timeout(store.save({ ...lease, sequence: 1 }, 2, snapshot));
    assert.deepEqual(backend.rows.get(lease.room)!.checkpoint, first);
    backend.failPut = null;
    const second = await store.save({ ...lease, sequence: 1 }, 2, snapshot);
    releasePut();
    await flush();
    assert.deepEqual(backend.rows.get(lease.room)!.checkpoint, second);

    const get = backend.get.bind(backend);
    let releaseGet!: () => void;
    backend.get = async (object) => {
      await new Promise<void>((resolve) => (releaseGet = resolve));
      return get(object);
    };
    await timeout(store.load(second));
    backend.get = get;
    releaseGet();
    await flush();
    assert.deepEqual((await store.load(second)).inventories, snapshot.inventories);

    const commit = backend.commit.bind(backend);
    let releaseCommit!: () => void;
    backend.commit = async (...args) => {
      await new Promise<void>((resolve) => (releaseCommit = resolve));
      return commit(...args);
    };
    const pending = store.save({ ...lease, sequence: 2 }, 3, snapshot);
    await flush();
    await timeout(pending);
    assert.deepEqual(backend.rows.get(lease.room)!.checkpoint, second);
    backend.commit = commit;
    const third = await store.save({ ...lease, sequence: 2 }, 3, snapshot);
    releaseCommit();
    await flush();
    assert.deepEqual(backend.rows.get(lease.room)!.checkpoint, third);
    assert.equal(
      backend.commits.length,
      3,
      'the timed-out commit and its retry share one identity',
    );
  } finally {
    room.dispose();
  }
});
test('actual previous-release checkpoint restores ownership, terrain and timed objects after the biome query addition', () => {
  assert.equal(createHash('sha256').update(bytes).digest('hex'), provenance.sha256);
  assert.equal(saved.engineHash, provenance.engineHash);
  const room = GameRoom.fromCheckpoint(
    new VoxelWorld(),
    new TerrainGen(saved.seed),
    content,
    build,
    { send() {}, close() {} },
    saved,
    1000,
    new Map([
      [
        'compat-player',
        {
          id: 'compat-player',
          role: 'participant',
          capabilities: { build: true, fly: true, observe: false, combat: true, explosives: true },
        },
      ],
    ]),
  );
  try {
    const next = room.checkpoint(1000);
    for (const key of ['world', 'inventories', 'drops', 'explosives', 'seed', 'tick'])
      assert.deepEqual(next[key as keyof typeof next], saved[key], key);
    assert.deepEqual(
      next.players,
      saved.players.map((player: object) => ({ ...player, reservationMs: 30000 })),
    );
    assert.equal(next.engineHash, build.engineHash);
  } finally {
    room.dispose();
  }
});
test('engine compatibility remains directional and rejects unrelated engines and malformed checkpoints', () => {
  assert.throws(() => readRoomCheckpoint({ ...saved, engineHash: '0'.repeat(64) }, content, build));
  assert.throws(() => readRoomCheckpoint(saved, content, { ...build, engineHash: '1'.repeat(64) }));
  assert.throws(() =>
    readRoomCheckpoint(
      { ...saved, players: [{ ...saved.players[0], state: [NaN] }] },
      content,
      build,
    ),
  );
});

test('the immutable storage graph from the prior engine loads under the reviewed current engine', async () => {
  const backend = new MemoryCheckpoints();
  backend.rows.set('prior', {
    worldId: saved.worldId,
    owner: 'owner',
    epoch: 1,
    sequence: 0,
    deadline: 30000,
    checkpoint: null,
  });
  const lease = (await backend.acquire('prior', 'owner'))!;
  const oldBuild = { ...build, engineHash: saved.engineHash, buildId: saved.sourceBuildId };
  const pointer = await new CheckpointStorage(
    saved.worldId,
    backend,
    backend,
    content,
    oldBuild,
  ).save(lease, 1, saved);
  const loaded = await new CheckpointStorage(saved.worldId, backend, backend, content, build).load(
    pointer,
  );
  assert.equal(loaded.engineHash, build.engineHash);
  assert.deepEqual(loaded.world, saved.world);
  assert.deepEqual(loaded.inventories, saved.inventories);
  assert.deepEqual(loaded.drops, saved.drops);
  assert.deepEqual(loaded.explosives, saved.explosives);
  const manifest = backend.objects.get(pointer.object.key)!;
  backend.objects.delete(pointer.object.key);
  await assert.rejects(
    new CheckpointStorage(saved.worldId, backend, backend, content, build).load(pointer),
    /missing/,
  );
  backend.objects.set(pointer.object.key, new Uint8Array(manifest.length));
  await assert.rejects(
    new CheckpointStorage(saved.worldId, backend, backend, content, build).load(pointer),
    /integrity/,
  );
});
