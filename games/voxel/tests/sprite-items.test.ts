import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { source } from '../content/index.ts';
import { compileContent } from '../tools/compile-content.ts';
import { itemSprite } from '../src/render/item-sprites.ts';
import { itemGeometry, worldItemMaterial, HeldBlockRenderer } from '../src/render/held-block.ts';
import { DropRenderer } from '../src/render/drops.ts';
const content = compileContent(source).manifest;
const item = (id: string) => content.items.find((value) => value.itemType === id)!;
test('sprite-backed items share exact pixels and one-pixel thickness; worn armor retains its model', () => {
  const albedo = new THREE.Texture(),
    surface = new THREE.Texture();
  let borrowed = 0;
  albedo.addEventListener('dispose', () => borrowed++);
  surface.addEventListener('dispose', () => borrowed++);
  for (const id of [
    'wooden_pickaxe',
    'stone_pickaxe',
    'iron_pickaxe',
    'diamond_pickaxe',
    'diamond',
    'iron_ingot',
    'gold_ingot',
    'iron_vest',
  ]) {
    const geometry = itemGeometry(item(id), content.blocks);
    geometry.computeBoundingBox();
    assert.equal(geometry.boundingBox!.max.z - geometry.boundingBox!.min.z, 1 / 16);
    const normal = geometry.getAttribute('normal');
    assert.ok(Array.from(normal.array).some((value) => value === -1));
    const material = worldItemMaterial(item(id), content.blocks, albedo, surface);
    assert.equal(material.defines.ITEM_SPRITE, 1);
    assert.equal(material.defines.INSTANCED_ITEMS, 1);
    const texture = material.uniforms.uSprite.value as THREE.DataTexture;
    assert.deepEqual(texture.image.data, itemSprite(item(id)));
    assert.equal(material.uniforms.uCutout.value, 1);
    let released = 0;
    texture.addEventListener('dispose', () => released++);
    material.dispose();
    assert.equal(released, 1);
    geometry.dispose();
  }
  const worn = worldItemMaterial(item('iron_vest'), content.blocks, albedo, surface, 'body');
  assert.equal(worn.defines.ITEM_SPRITE, undefined);
  worn.dispose();
  assert.equal(borrowed, 0);
  albedo.dispose();
  surface.dispose();
});
test('first-person switches between sprite and block materials without leaking sprite textures', () => {
  const albedo = new THREE.Texture(),
    surface = new THREE.Texture();
  const held = new HeldBlockRenderer(content.blocks, content.items, albedo, surface);
  let material: THREE.RawShaderMaterial | undefined;
  const renderer = {
    autoClear: true,
    clearDepth() {},
    render(scene: THREE.Scene) {
      scene.traverse((node) => {
        if (node instanceof THREE.Mesh && node.material instanceof THREE.RawShaderMaterial)
          material = node.material;
      });
    },
  } as unknown as THREE.WebGLRenderer;
  held.draw(renderer, 1.6, 0, 0, 0, 1, true, 'stone_pickaxe');
  assert.equal(material!.defines.ITEM_SPRITE, 1);
  assert.equal(material!.defines.INSTANCED_ITEMS, undefined);
  const first = material!.uniforms.uSprite.value as THREE.DataTexture;
  let releases = 0;
  first.addEventListener('dispose', () => releases++);
  held.draw(renderer, 1.6, 0, 0, 1, 1, true, 'stone_pickaxe');
  assert.equal(releases, 0);
  held.draw(renderer, 1.6, 0, 0, 2, 1, true, 'oak_planks');
  assert.equal(releases, 1);
  assert.equal(material!.defines.ITEM_SPRITE, undefined);
  held.draw(renderer, 1.6, 0, 0, 3, 1, true, 'diamond_pickaxe');
  const last = material!.uniforms.uSprite.value as THREE.DataTexture;
  last.addEventListener('dispose', () => releases++);
  held.dispose();
  held.dispose();
  assert.equal(releases, 2);
  albedo.dispose();
  surface.dispose();
});
test('dropped sprites stay instanced, follow origin shifts, and release owned textures on shrink/removal', () => {
  const scene = new THREE.Scene(),
    albedo = new THREE.Texture(),
    surface = new THREE.Texture();
  const collision = {
    get_block: () => 0,
    target_boxes: () => new Uint8Array(),
    sweep_body: (x: number, y: number, z: number, dx: number, dy: number, dz: number) =>
      new Float64Array([x + dx, y + dy, z + dz, 0, 0, 0]),
  };
  const drops = new DropRenderer(scene, content.blocks, content.items, albedo, surface);
  const values = Array.from({ length: 129 }, (_, i) => ({
    id: `drop-${i}`,
    revision: 1,
    stack: { itemType: 'stone_pickaxe', count: 1 },
    position: [100 + i, 64, 0] as const,
  }));
  drops.update(values, new THREE.Vector3(96, 0, 0), 0, 1, collision);
  const batch = scene.children[0] as THREE.InstancedMesh<
    THREE.BufferGeometry,
    THREE.RawShaderMaterial
  >;
  assert.equal(scene.children.length, 1);
  assert.equal(batch.count, 129);
  assert.equal(batch.material.defines.ITEM_SPRITE, 1);
  const matrix = new THREE.Matrix4();
  batch.getMatrixAt(0, matrix);
  assert.equal(matrix.elements[12], 4);
  let textures = 0;
  (batch.material.uniforms.uSprite.value as THREE.DataTexture).addEventListener(
    'dispose',
    () => textures++,
  );
  drops.update(values.slice(0, 1), new THREE.Vector3(112, 0, 0), 0, 1, collision);
  assert.equal(textures, 1);
  const smaller = scene.children[0] as typeof batch;
  smaller.getMatrixAt(0, matrix);
  assert.equal(matrix.elements[12], -12);
  (smaller.material.uniforms.uSprite.value as THREE.DataTexture).addEventListener(
    'dispose',
    () => textures++,
  );
  drops.update([], new THREE.Vector3(), 0, 1, collision);
  assert.equal(textures, 2);
  assert.equal(scene.children.length, 0);
  drops.dispose();
  albedo.dispose();
  surface.dispose();
});
