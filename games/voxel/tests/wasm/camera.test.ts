import assert from 'node:assert/strict';
import { test } from 'node:test';
import { flatWorld, content } from './fixture.ts';
import { cameraView } from '../../src/client/camera.ts';

test('third-person camera follows the view line, stops before walls and never moves the player', () => {
  const world = flatWorld();
  try {
    const position = [1.5, 1, 1.5],
      slot = world.player_add(...(position as [number, number, number]));
    const original = world.player_state(slot);
    assert.deepEqual(cameraView(world, position, 0, 0, 0), { eye: [1.5, 2.62, 1.5], distance: 0 });
    assert.deepEqual(cameraView(world, position, 0, 0, 4), { eye: [1.5, 2.62, 5.5], distance: 4 });
    world.set_block(1, 2, 4, content.defaults.stone);
    const blocked = cameraView(world, position, 0, 0, 4);
    assert.ok(blocked.distance > 1.5 && blocked.distance < 2.5);
    assert.ok(blocked.eye[2] + 0.12 < 4);
    assert.equal(blocked.eye[0], position[0]);
    assert.equal(blocked.eye[1], position[1] + 1.62);
    const upwardLook = cameraView(world, position, 0, 1, 6);
    assert.ok(upwardLook.eye[1] >= 1.12, 'camera stays above solid ground');
    assert.deepEqual(world.player_state(slot), original);
  } finally {
    world.free();
  }
});

test('camera obstruction uses collision shapes across negative coordinates and respects zoom bounds', () => {
  const world = flatWorld();
  try {
    const position = [-0.5, 1, -0.5];
    world.set_block(-3, 2, -1, content.defaults.z_slab);
    const slab = cameraView(world, position, Math.PI / 2, 0, 4);
    assert.equal(slab.distance, 4, 'camera clears the lower half of a slab');
    world.set_block(-3, 2, -1, content.defaults.stone);
    const wall = cameraView(world, position, Math.PI / 2, 0, 4);
    assert.ok(wall.distance < slab.distance);
    assert.ok(wall.eye[0] - 0.12 > -2);
    assert.equal(cameraView(world, position, 0, 0, -1).distance, 0);
    assert.equal(cameraView(world, position, 0, 0, 100).distance, 6);
  } finally {
    world.free();
  }
});
