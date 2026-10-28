import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import {
  initSync,
  set_content,
  VoxelWorld,
  TerrainGen,
  ChunkMesher,
  Culler,
} from '../../engine/pkg/voxel_engine.js';
import { stepBoundedMovement } from '../../src/shared/movement.ts';
initSync({
  module: readFileSync(new URL('../../engine/pkg/voxel_engine_bg.wasm', import.meta.url)),
});
const manifest = JSON.parse(
  readFileSync(new URL('../../artifacts/content.json', import.meta.url), 'utf8'),
);
set_content(JSON.stringify(manifest));
test('natural-world jump/walk and camera-relative culling remain correct through a negative column boundary', () => {
  const world = new VoxelWorld(),
    generator = new TerrainGen(4242),
    mesher = new ChunkMesher(),
    culler = new Culler(),
    camera = new THREE.PerspectiveCamera(75, 1.6, 0.05, 1600);
  try {
    for (let z = -3; z <= 3; z++)
      for (let x = 0; x <= 6; x++) world.insert_column(x, z, generator.generate(x, z));
    for (let z = -2; z <= 2; z++)
      for (let x = 1; x <= 5; x++)
        culler.set_column(x, z, mesher.mesh(world.extract_region(x, z)).subarray(0, 80));
    const slot = world.player_add(49.5, 68, 0.5),
      initial = world.player_state(slot);
    initial[6] = 1;
    world.player_restore(slot, initial);
    let peak = 68;
    for (let step = 0; step < 120; step++) {
      stepBoundedMovement(world, slot, {
        x: step > 40 ? 1 : 0,
        z: 0,
        yaw: -0.48,
        pitch: 0.34,
        jump: step === 0,
        sneak: false,
        sprint: false,
      });
      const state = world.player_state(slot),
        ox = Math.floor(state[0] / 16) * 16,
        oz = Math.floor(state[2] / 16) * 16;
      peak = Math.max(peak, state[1]);
      camera.position.set(state[0] - ox, state[1] + 1.62, state[2] - oz);
      camera.rotation.set(0.34, 0.48, 0, 'YXZ');
      camera.updateMatrixWorld();
      const vp = new THREE.Matrix4()
        .multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
        .multiply(new THREE.Matrix4().makeTranslation(-ox, 0, -oz));
      culler.cull(new Float64Array(vp.elements), state[0], state[1] + 1.62, state[2], 4, true);
      assert.ok(culler.visible_sections() > 0 && culler.visible_sections() <= 400);
      assert.ok(Array.from(state).every(Number.isFinite));
    }
    const final = world.player_state(slot);
    assert.ok(peak > 68.5);
    assert.ok(final[0] > 53 && final[2] < -1.5);
  } finally {
    world.free();
    generator.free();
    mesher.free();
    culler.free();
  }
});
test('hidden observer bodies never block creative placement', () => {
  const world = new VoxelWorld();
  try {
    const slot = world.player_add(8.5, 1, 8.5),
      stone = manifest.blocks.findIndex((b: { name: string }) => b.name === 'stone');
    assert.equal(world.player_overlaps(8, 1, 8, stone), true);
    world.set_ghost(slot, true);
    assert.equal(world.player_overlaps(8, 1, 8, stone), false);
    world.set_ghost(slot, false);
    assert.equal(world.player_overlaps(8, 1, 8, stone), true);
  } finally {
    world.free();
  }
});
