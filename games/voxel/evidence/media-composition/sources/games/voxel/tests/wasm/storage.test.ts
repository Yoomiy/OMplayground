import assert from 'node:assert/strict';
import { test } from 'node:test';
import { textures } from '../../tools/compile-content.ts';
import { content, engine, flatWorld } from './fixture.ts';
test('actual Wasm round-trips high IDs through generation, blueprints, edits, unload, and mesh input', () => {
  const gen = new engine.TerrainGen(42),
    world = new engine.VoxelWorld();
  try {
    const high = content.defaults.test_299;
    assert.ok(high > 255);
    gen.set_void();
    gen.add_blueprint(-1, 16, -1, 1, 1, 1, new Uint16Array([high]));
    const column = gen.generate(-1, -1);
    assert.equal(new TextDecoder().decode(column.slice(0, 4)), 'VXC2');
    world.insert_column(-1, -1, column);
    assert.equal(world.get_block(-1, 16, -1), high);
    world.set_block(-2, 16, -1, 256);
    assert.equal(world.get_block(-2, 16, -1), 256);
    world.set_block(-3, 16, -1, 255);
    assert.equal(world.get_block(-3, 16, -1), 255);
    const edits = world.export_edits();
    world.remove_column(-1, -1);
    assert.equal(world.get_block(-1, 16, -1), 65535);
    world.insert_column(-1, -1, column);
    assert.equal(world.get_block(-2, 16, -1), 256);
    const copy = new engine.VoxelWorld();
    try {
      copy.import_edits(edits);
      copy.insert_column(-1, -1, column);
      assert.equal(copy.get_block(-2, 16, -1), 256);
    } finally {
      copy.free();
    }
    const mesh = new engine.ChunkMesher();
    try {
      const out = mesh.mesh(world.extract_region(-1, -1));
      assert.equal(out[79], 2);
      assert.ok(out[1] > 0);
    } finally {
      mesh.free();
    }
    assert.equal(world.set_block(-1, 16, -1, 65535), false);
    assert.equal(world.set_block(-1, 16, -1, 65536), false);
    assert.throws(() => gen.add_blueprint(0, 0, 0, 2, 1, 1, new Uint16Array([high])));
    assert.deepEqual(JSON.parse(engine.block_registry_json()).textures, textures);
  } finally {
    world.free();
    gen.free();
  }
});
test('high-state collision, selection, skylight/block light, AO, and packed mesh match equivalent low states', () => {
  const a = flatWorld(),
    b = flatWorld(),
    mesher = new engine.ChunkMesher();
  try {
    a.set_block(8, 1, 8, content.defaults.stone_slab);
    b.set_block(8, 1, 8, content.defaults.z_slab);
    assert.equal(a.collision_top(8, 1, 8), 0.5);
    assert.equal(b.collision_top(8, 1, 8), 0.5);
    assert.deepEqual(a.target_boxes(8, 1, 8), b.target_boxes(8, 1, 8));
    a.set_block(9, 2, 8, content.defaults.glowstone);
    b.set_block(9, 2, 8, content.defaults.z_glow);
    assert.ok(content.defaults.z_glow > 255);
    assert.deepEqual(mesher.mesh(a.extract_region(0, 0)), mesher.mesh(b.extract_region(0, 0)));
    const hit = b.raycast(8.5, 3, 8.5, 0, -1, 0, 4);
    assert.equal(hit[7], content.defaults.z_slab);
    assert.equal(hit[8], 1.5);
  } finally {
    a.free();
    b.free();
    mesher.free();
  }
});
test('Wasm rejects version mismatches and corrupt/truncated buffers without partially changing state', () => {
  const world = flatWorld(),
    gen = new engine.TerrainGen(1),
    mesh = new engine.ChunkMesher();
  try {
    const original = world.get_block(0, 0, 0);
    const column = gen.generate(0, 0),
      bad = column.slice();
    bad[3] = 49;
    for (const data of [bad, column.slice(0, 40), column.slice(0, -1)])
      assert.throws(() => world.insert_column(0, 0, data));
    assert.equal(world.get_block(0, 0, 0), original);
    const region = world.extract_region(0, 0);
    assert.throws(() => mesh.mesh(region.slice(4)));
    assert.throws(() => mesh.mesh(region.slice(0, -1)));
    world.set_block(1, 2, 3, content.defaults.z_glow);
    const edits = world.export_edits();
    const count = world.edit_count();
    assert.throws(() => world.import_edits(edits.slice(0, -1)));
    assert.equal(world.edit_count(), count);
    assert.throws(() => engine.set_content('{}'), /immutable/);
  } finally {
    world.free();
    gen.free();
    mesh.free();
  }
});
test('liquid behavior is independent of old stock IDs and non-solid ladders stay passable', () => {
  const world = flatWorld();
  try {
    assert.ok(content.defaults.water > 255);
    world.set_block(8, 1, 8, content.defaults.water);
    world.set_block(8, 2, 8, content.defaults.water);
    const slot = world.player_add(8.5, 1, 8.5);
    world.player_step(slot, 0, 0, false, false, false, false, 1, 1, 1, 1, 1 / 60);
    assert.equal(world.player_state(slot)[7], 1);
    assert.equal(world.collision_top(8, 1, 8), 0);
    world.set_block(9, 1, 8, content.defaults.ladder);
    assert.equal(world.collision_top(9, 1, 8), 0);
    assert.ok(world.target_boxes(9, 1, 8).length > 0);
  } finally {
    world.free();
  }
});
