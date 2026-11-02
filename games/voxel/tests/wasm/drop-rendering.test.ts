import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { content, flatWorld } from './fixture.ts';
import { DropRenderer } from '../../src/render/drops.ts';
import { Drops } from '../../src/sim/drops.ts';
import { DROP_SIZE, DROP_HALF_WIDTH, DROP_HEIGHT } from '../../src/shared/gameplay.ts';

function visualFixture() {
  const world = flatWorld(),
    scene = new THREE.Scene(),
    albedo = new THREE.Texture(),
    surface = new THREE.Texture();
  const renderer = new DropRenderer(
    scene,
    content.manifest.blocks,
    content.manifest.items,
    albedo,
    surface,
  );
  const matrix = new THREE.Matrix4(),
    bounds = new THREE.Box3();
  const draw = (
    position: readonly [number, number, number],
    time: number,
    origin = new THREE.Vector3(),
  ) => {
    renderer.update(
      [{ id: 'drop-1', revision: 1, stack: { itemType: 'stone', count: 1 }, position }],
      origin,
      time,
      1,
      world,
    );
    assert.equal(scene.children.length, 1, 'one item batch, no halo or pile proxy');
    const batch = scene.children[0] as THREE.InstancedMesh;
    batch.getMatrixAt(0, matrix);
    batch.geometry.computeBoundingBox();
    bounds.copy(batch.geometry.boundingBox!).applyMatrix4(matrix).translate(origin);
    return bounds;
  };
  return {
    world,
    renderer,
    scene,
    draw,
    close() {
      renderer.dispose();
      world.free();
      albedo.dispose();
      surface.dispose();
    },
  };
}

test('every rotating cube corner clears walls, ground and ceilings, including old narrower-body positions', () => {
  const f = visualFixture();
  try {
    assert.ok(DROP_HALF_WIDTH >= DROP_SIZE / Math.sqrt(2));
    f.world.set_block(2, 1, 0, content.defaults.stone);
    for (let frame = 0; frame < 240; frame++) {
      const bounds = f.draw([1.875, 1, 0.5], frame / 60);
      assert.ok(bounds.max.x <= 2 + 1e-6, `wall at frame ${frame}: ${bounds.max.x}`);
      assert.ok(bounds.min.y >= 1 - 1e-6, `ground at frame ${frame}`);
    }
    f.renderer.clear();
    f.world.set_block(0, 2, 0, content.defaults.stone);
    for (let frame = 0; frame < 180; frame++) {
      const bounds = f.draw([0.5, 2 - DROP_HEIGHT, 0.5], frame / 60);
      assert.ok(bounds.max.y <= 2 + 1e-6, `ceiling at frame ${frame}: ${bounds.max.y}`);
      assert.ok(bounds.min.y >= 1 - 1e-6);
    }
  } finally {
    f.close();
  }
});

test('smoothed drop movement goes around terrain corners and rebases without penetrating', () => {
  const f = visualFixture();
  try {
    f.world.set_block(2, 1, 1, content.defaults.stone);
    f.draw([1.5, 1, 1.5], 0);
    for (let frame = 1; frame < 180; frame++) {
      const bounds = f.draw(
        [2.5, 1, 2.5],
        frame / 60,
        new THREE.Vector3(frame % 2 ? 16 : 0, 0, -16),
      );
      assert.ok(
        bounds.max.x <= 2 + 1e-6 || bounds.min.z >= 2 - 1e-6 || bounds.min.x >= 3 - 1e-6,
        `corner at frame ${frame}: ${JSON.stringify(bounds)}`,
      );
    }
    assert.ok(f.draw([2.5, 1, 2.5], 3.1).min.x > 2.2, 'visual reaches the authoritative target');
  } finally {
    f.close();
  }
});

test('newly placed terrain and slab overlaps correct both real and displayed drops', () => {
  const f = visualFixture();
  try {
    const drops = new Drops(content.manifest);
    drops.add({ itemType: 'stone', count: 1 }, [0.5, 1.4, 0.5], 0, null, [0, 0, 0]);
    f.draw([0.5, 1.4, 0.5], 0);
    f.world.set_block(0, 1, 0, content.defaults.stone);
    const bounds = f.draw([0.5, 1.4, 0.5], 1 / 60);
    assert.ok(
      bounds.max.x <= 0 ||
        bounds.min.x >= 1 ||
        bounds.max.z <= 0 ||
        bounds.min.z >= 1 ||
        bounds.min.y >= 2 ||
        bounds.max.y <= 1,
    );
    drops.step(f.world, 1);
    const p = drops.checkpoint(1).entries[0].position;
    assert.ok(
      p[0] + DROP_HALF_WIDTH <= 0 ||
        p[0] - DROP_HALF_WIDTH >= 1 ||
        p[2] + DROP_HALF_WIDTH <= 0 ||
        p[2] - DROP_HALF_WIDTH >= 1 ||
        p[1] >= 2 ||
        p[1] + DROP_HEIGHT <= 1,
    );
    f.renderer.clear();
    f.world.set_block(2, 1, 2, content.defaults.z_slab);
    for (let frame = 0; frame < 30; frame++)
      assert.ok(f.draw([2.5, 1.45, 2.5], frame / 60).min.y >= 1.5);
    f.renderer.clear();
    f.world.set_block(4, 1, 2, content.defaults.oak_stairs);
    const boxes = f.world.target_boxes(4, 1, 2);
    for (let frame = 0; frame < 120; frame++) {
      const bounds = f.draw([4.5, 1.2, 2.5], frame / 60);
      for (let i = 0; i < boxes.length; i += 6) {
        const solid = new THREE.Box3(
          new THREE.Vector3(4 + boxes[i] / 16, 1 + boxes[i + 1] / 16, 2 + boxes[i + 2] / 16),
          new THREE.Vector3(4 + boxes[i + 3] / 16, 1 + boxes[i + 4] / 16, 2 + boxes[i + 5] / 16),
        );
        assert.ok(!bounds.intersectsBox(solid), `stairs at frame ${frame}`);
      }
    }
  } finally {
    f.close();
  }
});

test('mixed full stacks can overlap without pairwise collision sweeps', () => {
  const world = flatWorld();
  try {
    let sweeps = 0;
    const sweep = world.sweep_body.bind(world);
    world.sweep_body = (...args: Parameters<typeof sweep>) => {
      sweeps++;
      return sweep(...args);
    };
    const drops = new Drops(content.manifest);
    for (let n = 0; n < 200; n++)
      drops.add({ itemType: n % 2 ? 'stone' : 'dirt', count: 64 }, [2, 1, 2], 0, null, [0, 0, 0]);
    for (let tick = 1; tick <= 30; tick++) drops.step(world, tick);
    assert.equal(sweeps, 200 * 30, 'exactly one terrain sweep per body per tick');
    assert.equal(drops.size, 200);
    const entries = drops.checkpoint(30).entries;
    for (const entry of entries) assert.deepEqual(entry.position, entries[0].position);
  } finally {
    world.free();
  }
});
