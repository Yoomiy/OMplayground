import assert from 'node:assert/strict';
import { test } from 'node:test';
import { content, engine } from './fixture.ts';
import { WorldStore } from '../../src/sim/world-store.ts';
import { MAX_COLUMN_REVISION } from '../../src/shared/chunk-wire.ts';
import type { Cell } from '../../src/shared/protocol.ts';
const json = (value: unknown) => JSON.parse(JSON.stringify(value));
function fresh() {
  const generator = new engine.TerrainGen(4242);
  generator.set_void();
  generator.set_void_ground(0, content.defaults.stone, content.defaults.stone, 1);
  return { generator, world: new engine.VoxelWorld() };
}
const load = (store: WorldStore) => {
  store.require([
    [0.5, 1, 0.5],
    [16.5, 1, 0.5],
  ]);
  while (store.generateOne()) {}
};

test('changed columns recover lazily into native generation with high states, removals, cell stamps and unload/reload intact', () => {
  const a = fresh(),
    b = fresh(),
    original = new WorldStore(a.world, a.generator);
  let restored: WorldStore | undefined;
  try {
    load(original);
    original.set(-1, 17, -1, content.defaults.test_299);
    original.set(0, 1, 0, content.defaults.glowstone);
    original.set(0, 1, 0, 0);
    original.set(16, 1, 0, content.defaults.stone_slab);
    original.set(15, 1, 0, content.defaults.oak_planks);
    original.clearMany([
      [15, 1, 0],
      [16, 1, 0],
    ]);
    const snapshot = original.checkpoint(content.manifest),
      bytes = JSON.stringify(snapshot);
    restored = WorldStore.fromCheckpoint(b.world, b.generator, content.manifest, json(snapshot));
    assert.equal(
      restored.world.column_count(),
      0,
      'restoration must not generate terrain synchronously',
    );
    assert.deepEqual(restored.checkpoint(content.manifest), snapshot);
    load(restored);
    for (const cell of [
      [-1, 17, -1],
      [0, 1, 0],
      [15, 1, 0],
      [16, 1, 0],
    ] as readonly Cell[]) {
      assert.equal(restored.world.get_block(...cell), original.world.get_block(...cell));
      assert.equal(restored.cellRevision(...cell), original.cellRevision(...cell));
    }
    for (const [x, z] of [
      [-1, -1],
      [0, 0],
      [1, 0],
    ]) {
      assert.equal(restored.revision(x, z), original.revision(x, z));
      assert.deepEqual(new Map(restored.edits(x, z)), new Map(original.edits(x, z)));
    }
    assert.ok(restored.world.get_block(-1, 17, -1) > 255);
    const high = restored.world.get_block(-1, 17, -1);
    restored.world.forget_column(-1, -1);
    load(restored);
    assert.equal(restored.world.get_block(-1, 17, -1), high);
    original.set(0, 2, 0, content.defaults.stone);
    assert.equal(JSON.stringify(snapshot), bytes);
    restored.set(0, 2, 0, content.defaults.stone);
    assert.deepEqual(restored.checkpoint(content.manifest), original.checkpoint(content.manifest));
    assert.equal(Object.isFrozen(snapshot.columns[0].edits[0]), true);
  } finally {
    original.dispose();
    if (restored) restored.dispose();
    else {
      b.world.free();
      b.generator.free();
    }
  }
});

test('failed native replay removes the whole partial column and retains immutable metadata for a successful retry', () => {
  const a = fresh(),
    original = new WorldStore(a.world, a.generator),
    b = fresh();
  let restored: WorldStore | undefined;
  try {
    load(original);
    original.set(0, 1, 0, content.defaults.stone);
    original.set(0, 2, 0, content.defaults.glowstone);
    const snapshot = original.checkpoint(content.manifest);
    restored = WorldStore.fromCheckpoint(b.world, b.generator, content.manifest, json(snapshot));
    const native = restored.world.set_block.bind(restored.world);
    let writes = 0;
    restored.world.set_block = (...args) => (++writes === 2 ? false : native(...args));
    assert.throws(() => load(restored!), /column edit replay failed/);
    assert.equal(writes, 2);
    assert.equal(restored.world.has_column(0, 0), false);
    assert.equal(restored.heightAt(0, 0), 252);
    assert.deepEqual(restored.checkpoint(content.manifest), snapshot);
    restored.world.set_block = native;
    load(restored);
    assert.equal(restored.world.get_block(0, 1, 0), content.defaults.stone);
    assert.equal(restored.world.get_block(0, 2, 0), content.defaults.glowstone);
  } finally {
    original.dispose();
    if (restored) restored.dispose();
    else {
      b.world.free();
      b.generator.free();
    }
  }
});

test('invalid checkpoint suffixes never install edits into an engine and revision exhaustion cannot wrap or partially clear a blast', () => {
  const a = fresh(),
    original = new WorldStore(a.world, a.generator);
  try {
    load(original);
    original.set(0, 1, 0, content.defaults.stone);
    original.set(16, 1, 0, content.defaults.stone);
    const snapshot = original.checkpoint(content.manifest),
      before = json(snapshot),
      mutations: ((v: any) => void)[] = [
        (v) => (v.schema = 2),
        (v) => (v.contentHash = 'wrong'),
        (v) => v.columns.push(v.columns[0]),
        (v) => (v.columns[0].x = 16),
        (v) => (v.columns[0].revision = MAX_COLUMN_REVISION + 1),
        (v) => (v.columns[0].edits = []),
        (v) => v.columns[0].edits.push(v.columns[0].edits[0]),
        (v) => (v.columns[0].edits[0][0] = 65536),
        (v) => (v.columns[0].edits[0][1] = 65535),
        (v) => (v.columns[0].edits[0][2] = 0),
        (v) => (v.columns[0].revision = 2),
        (v) => v.columns.push({ x: 2, z: 0, revision: 1, edits: [[0, 65535, 1]] }),
        (v) => (v.columns = Array(1)),
      ];
    for (const mutate of mutations) {
      const b = fresh(),
        value = json(snapshot);
      mutate(value);
      try {
        assert.throws(
          () => WorldStore.fromCheckpoint(b.world, b.generator, content.manifest, value),
          /invalid world checkpoint/,
        );
        assert.equal(b.world.column_count(), 0);
      } finally {
        b.world.free();
        b.generator.free();
      }
    }
    assert.deepEqual(original.checkpoint(content.manifest), before);
    assert.throws(
      () =>
        WorldStore.fromCheckpoint(original.world, original.generator, content.manifest, snapshot),
      /fresh compute world/,
    );
    const max = json(snapshot);
    max.columns[0].revision = MAX_COLUMN_REVISION;
    max.columns[0].edits[0][2] = MAX_COLUMN_REVISION;
    const b = fresh(),
      restored = WorldStore.fromCheckpoint(b.world, b.generator, content.manifest, max);
    try {
      load(restored);
      const stable = restored.checkpoint(content.manifest);
      assert.equal(restored.set(0, 1, 0, 0), null);
      assert.equal(
        restored.clearMany([
          [16, 1, 0],
          [0, 1, 0],
        ]),
        null,
      );
      assert.equal(restored.world.get_block(16, 1, 0), content.defaults.stone);
      assert.equal(restored.world.get_block(0, 1, 0), content.defaults.stone);
      assert.deepEqual(restored.checkpoint(content.manifest), stable);
    } finally {
      restored.dispose();
    }
  } finally {
    original.dispose();
  }
});
