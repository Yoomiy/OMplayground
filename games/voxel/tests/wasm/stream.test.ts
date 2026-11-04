import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorldStream } from '../../src/world/stream.ts';
import type { JobPool } from '../../src/world/stream.ts';
import type { JobIdentity, EngineResult } from '../../src/world/jobs.ts';
import { content, engine } from './fixture.ts';
class DeferredPool implements JobPool {
  count = 1;
  pending: {
    kind: 'generate' | 'mesh';
    tag: JobIdentity;
    region?: Uint8Array;
    resolve: (r: EngineResult) => void;
  }[] = [];
  get available() {
    return this.pending.length ? 0 : 1;
  }
  get active() {
    return this.pending.length;
  }
  submit(kind: 'generate' | 'mesh', tag: JobIdentity, region?: Uint8Array): Promise<EngineResult> {
    return new Promise((resolve) => this.pending.push({ kind, tag, region, resolve }));
  }
  finish(
    generator: InstanceType<typeof engine.TerrainGen>,
    mesher?: InstanceType<typeof engine.ChunkMesher>,
  ) {
    const job = this.pending.shift()!;
    job.resolve(
      job.kind === 'generate'
        ? { kind: 'generate', id: 1, tag: job.tag, data: generator.generate(job.tag.x, job.tag.z) }
        : { kind: 'mesh', id: 1, tag: job.tag, data: mesher!.mesh(job.region!) },
    );
  }
}
test('edits arriving during generation cannot be overwritten, and unload/reload rejects old incarnations', async () => {
  const world = new engine.VoxelWorld(),
    generator = new engine.TerrainGen(42),
    pool = new DeferredPool();
  generator.set_void();
  let requested = 0;
  const renderer = { install() {}, remove() {}, tint() {} };
  const stream = new WorldStream(
    world,
    pool,
    renderer,
    'world',
    content.manifest.hash,
    () => requested++,
    (reason) => assert.fail(reason),
  );
  try {
    stream.receive({ kind: 'baseline', x: 0, z: 0, subscription: 1, revision: 0, edits: [] });
    stream.pump(100);
    stream.receive({
      kind: 'patch',
      x: 0,
      z: 0,
      subscription: 1,
      revision: 1,
      edits: [[256, content.defaults.test_299]],
    });
    pool.finish(generator);
    await Promise.resolve();
    stream.pump(100);
    assert.equal(world.get_block(0, 1, 0), content.defaults.test_299);
    stream.receive({
      kind: 'patch',
      x: 0,
      z: 0,
      subscription: 1,
      revision: 3,
      edits: [[256, content.defaults.stone]],
    });
    assert.equal(requested, 1);
    assert.equal(world.get_block(0, 1, 0), content.defaults.test_299);
    stream.receive({
      kind: 'baseline',
      x: 0,
      z: 0,
      subscription: 1,
      revision: 3,
      edits: [[256, content.defaults.stone]],
    });
    stream.pump(100);
    stream.unload(0, 0, 1);
    stream.receive({
      kind: 'baseline',
      x: 0,
      z: 0,
      subscription: 2,
      revision: 4,
      edits: [[256, content.defaults.glowstone]],
    });
    pool.finish(generator);
    await Promise.resolve();
    stream.pump(100);
    assert.equal(world.has_column(0, 0), false);
    pool.finish(generator);
    await Promise.resolve();
    stream.pump(100);
    assert.equal(world.get_block(0, 1, 0), content.defaults.glowstone);
    assert.ok(stream.stats.discardedJobs >= 1);
    stream.unload(0, 0, 1);
    assert.equal(world.has_column(0, 0), true);
    stream.unload(0, 0, 2);
    assert.equal(world.has_column(0, 0), false);
    assert.equal(world.edit_count(), 0);
  } finally {
    stream.dispose();
    world.free();
    generator.free();
  }
});

test('a neighboring edit invalidates an in-flight mesh even when its own column revision is unchanged', async () => {
  const world = new engine.VoxelWorld(),
    generator = new engine.TerrainGen(42),
    mesher = new engine.ChunkMesher(),
    pool = new DeferredPool();
  generator.set_void();
  generator.set_void_ground(0, content.defaults.stone, content.defaults.stone, 1);
  const installed: Uint32Array[] = [];
  const stream = new WorldStream(
    world,
    pool,
    {
      install(_x, _z, data) {
        installed.push(data);
      },
      remove() {},
      tint() {},
    },
    'world',
    content.manifest.hash,
    () => assert.fail('unexpected gap'),
    (reason) => assert.fail(reason),
  );
  try {
    for (let z = -1; z <= 1; z++)
      for (let x = -1; x <= 1; x++)
        stream.receive({
          kind: 'baseline',
          x,
          z,
          subscription: (z + 1) * 3 + x + 2,
          revision: 0,
          edits: [],
        });
    stream.pump(100);
    for (let i = 0; i < 9; i++) {
      pool.finish(generator);
      await Promise.resolve();
      stream.pump(100);
    }
    assert.equal(pool.pending[0].kind, 'mesh');
    stream.receive({
      kind: 'patch',
      x: 1,
      z: 0,
      subscription: 6,
      revision: 1,
      edits: [[2 << 8, content.defaults.z_glow]],
    });
    pool.finish(generator, mesher);
    await Promise.resolve();
    stream.pump(100);
    assert.equal(installed.length, 0);
    pool.finish(generator, mesher);
    await Promise.resolve();
    stream.pump(100);
    assert.equal(installed.length, 1);
    assert.deepEqual(installed[0], mesher.mesh(world.extract_region(0, 0)));
  } finally {
    stream.dispose();
    world.free();
    generator.free();
    mesher.free();
  }
});
