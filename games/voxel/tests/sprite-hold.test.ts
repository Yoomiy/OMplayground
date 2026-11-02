import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { SPRITE_HOLD } from '../src/render/sprite-hold.ts';
import { AVATAR_PRESETS, AVATAR_COLORS } from '../src/render/upstream/blockyard/avatar.ts';
import { HeldBlockRenderer } from '../src/render/held-block.ts';
import { source } from '../content/index.ts';
import { compileContent } from '../tools/compile-content.ts';
const reference = JSON.parse(
  readFileSync(new URL('fixtures/blockyard-hold-rest.json', import.meta.url), 'utf8'),
);
const near = (actual: number[], expected: number[]) =>
  actual.forEach((value, i) =>
    assert.ok(Math.abs(value - expected[i]) < 1e-10, `${i}: ${value} != ${expected[i]}`),
  );
test('held sprites match the unmodified Blockyard arm-chain and attached-rest reference', () => {
  for (const name of ['tool', 'item'] as const) {
    const actual = SPRITE_HOLD[name],
      expected = reference.poses[name];
    near(actual.fist.toArray(), expected.grip);
    near(actual.gripLocal.toArray(), expected.gripLocal);
    near(actual.itemRotation.toArray(), expected.itemRot);
    near(actual.armRotation.toArray(), expected.armRot);
    near(actual.armOffset.toArray(), expected.armOffset);
    assert.equal(actual.itemScale, expected.itemScale);
  }
});
test('rendered pickaxe handle sits at the fist, changes avatar colors, and restores block transforms', () => {
  const content = compileContent(source).manifest,
    albedo = new THREE.Texture(),
    surface = new THREE.Texture();
  const held = new HeldBlockRenderer(content.blocks, content.items, albedo, surface);
  let tool: THREE.Mesh | undefined,
    fov = 0,
    handColor = 0;
  const renderer = {
    autoClear: true,
    clearDepth() {},
    render(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
      scene.updateMatrixWorld(true);
      const colors: number[] = [];
      scene.traverse((node) => {
        if (node instanceof THREE.Mesh && node.material instanceof THREE.MeshBasicMaterial)
          colors.push(node.material.color.getHex());
      });
      handColor = colors[0];
      fov = camera.fov;
      scene.traverse((node) => {
        if (node instanceof THREE.Mesh && node.material instanceof THREE.RawShaderMaterial)
          tool = node;
      });
    },
  } as unknown as THREE.WebGLRenderer;
  held.draw(renderer, 1.6, 0, 0, 0, 1, true, 'stone_pickaxe', 6);
  const grip = SPRITE_HOLD.tool.gripLocal.clone().applyMatrix4(tool!.matrixWorld);
  near(grip.toArray(), SPRITE_HOLD.tool.fist.toArray());
  assert.equal(fov, 75);
  assert.equal(handColor, AVATAR_COLORS.tone[AVATAR_PRESETS[6].avatar.tone]);
  held.draw(renderer, 1.6, 0, 0, 0, 1, true, 'stone_pickaxe', 0);
  assert.equal(handColor, AVATAR_COLORS.tone[AVATAR_PRESETS[0].avatar.tone]);
  held.draw(renderer, 1.6, 0, 0, 0, 1, true, 'oak_planks', 6);
  assert.equal(fov, 55);
  assert.ok(tool!.quaternion.equals(new THREE.Quaternion()));
  held.dispose();
  albedo.dispose();
  surface.dispose();
});
