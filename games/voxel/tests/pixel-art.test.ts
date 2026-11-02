import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { source } from '../content/index.ts';
import { compileContent } from '../tools/compile-content.ts';
import { itemSprite } from '../src/render/item-sprites.ts';
import { AvatarRenderer } from '../src/render/avatars.ts';
import { avatarVariant, AVATAR_COUNT, avatarAsset } from '../src/render/avatar-model.ts';
import { emptyAppearance } from '../src/shared/appearance.ts';

const manifest = compileContent(source).manifest;
// SHA-256 of the original Bed Wars atlas regions, without recolouring/resampling.
const ORIGINAL = {
  iron_ingot: '298c8a9637af323be6c4548270132cffd158559cfbc0c7f1e15d3c704b9f51b8',
  gold_ingot: '9fe7d8c316f8759522fa5bb2e8cbd7aa041c9924825207394402a3ec99c28d98',
  diamond: '3b931cb81d5ea0cb3aa50e48db42af00357b31657448a00bef481af07381a213',
  wooden_pickaxe: 'fa34ab44be7a62cc485bc3ff1571602c478774f11d196301219bc90199522c90',
  iron_pickaxe: 'b98133fdb57bbd8c5049e8857ea91af6a32726d7855a0a5694ec714e3fa6abce',
  diamond_pickaxe: '5939e26bee9eeee0824271ede5587dff9f2a1e7a08d322079d225d9491c4d2e2',
  iron_vest: 'b716a56d748c2e90f9b9a4005f92559eaa6db38290aa8726e5d0ce9e2699673d',
};
test('matching inventory items use exact upstream pixels; everything else keeps model thumbnails', () => {
  for (const item of manifest.items) {
    const pixels = itemSprite(item),
      hash = ORIGINAL[item.itemType as keyof typeof ORIGINAL];
    if (item.itemType === 'stone_pickaxe') {
      assert.ok(pixels);
      continue;
    }
    if (!hash) {
      assert.equal(pixels, null, item.itemType);
      continue;
    }
    assert.ok(pixels);
    assert.equal(pixels.length, 1024);
    assert.equal(createHash('sha256').update(pixels).digest('hex'), hash, item.itemType);
  }
});
test('stone pickaxe changes only the upstream material palette, preserving its silhouette and handle', () => {
  const stone = itemSprite(manifest.items.find((item) => item.itemType === 'stone_pickaxe')!)!;
  const iron = itemSprite(manifest.items.find((item) => item.itemType === 'iron_pickaxe')!)!;
  let handle = 0,
    changed = 0;
  for (let i = 0; i < 256; i++) {
    const at = i * 4;
    assert.equal(stone[at + 3], iron[at + 3]);
    const rgb = (iron[at] << 16) | (iron[at + 1] << 8) | iron[at + 2];
    if ([0x8a6436, 0x5e4020, 0x26180a].includes(rgb) && iron[at + 3]) {
      assert.deepEqual(stone.slice(at, at + 4), iron.slice(at, at + 4));
      handle++;
    }
    if (stone[at] !== iron[at] || stone[at + 1] !== iron[at + 1] || stone[at + 2] !== iron[at + 2])
      changed++;
  }
  assert.ok(handle > 10);
  assert.ok(changed > 10);
});
test('player identity consistently selects distinct local presets with different shapes and appearances', () => {
  assert.equal(AVATAR_COUNT, 12);
  const appearances = new Set<string>(),
    shapes = new Set<number>();
  for (let i = 0; i < AVATAR_COUNT; i++) {
    const asset = avatarAsset(i);
    appearances.add(createHash('sha256').update(asset.atlas.albedo).digest('hex'));
    shapes.add(asset.position.length);
    assert.ok(asset.position.every(Number.isFinite));
  }
  assert.equal(appearances.size, AVATAR_COUNT);
  assert.ok(shapes.size > 4);
  for (const id of ['alice', 'bob', 'guest-0123']) {
    const first = avatarVariant(id);
    assert.equal(avatarVariant(id), first);
    assert.ok(first >= 0 && first < AVATAR_COUNT);
  }
});
test('upstream avatar batches cover every player, preserve origin shifts, grow and release GPU resources', () => {
  const scene = new THREE.Scene(),
    albedo = new THREE.Texture(),
    surface = new THREE.Texture();
  const renderer = new AvatarRenderer(scene, manifest.blocks, manifest.items, albedo, surface);
  const actors = Array.from({ length: 129 }, (_, i) => ({
    id: `player-${i}`,
    position: [100 + i * 2, 64, 0],
    yaw: 0.4,
    pitch: 0.2,
    speed: 0,
    flying: false,
    appearance: emptyAppearance(),
  }));
  renderer.update(actors, new THREE.Vector3(96, 0, 0), [0, 64, 0], 1, 1);
  assert.equal(renderer.stats.visible, 129);
  const batches = scene.children.filter((node) => node instanceof THREE.InstancedMesh);
  assert.equal(batches.length, AVATAR_COUNT);
  assert.equal(
    batches.reduce((n, batch) => n + batch.count, 0),
    129,
  );
  assert.ok(
    batches.every(
      (batch) => batch.geometry.getAttribute('pose') instanceof THREE.InstancedBufferAttribute,
    ),
  );
  const before = renderer.samples;
  renderer.update(actors, new THREE.Vector3(112, 0, 16), [0, 64, 0], 1, 1);
  for (const old of before) {
    const now = renderer.samples.find((sample) => sample.id === old.id)!;
    assert.ok(Math.abs(old.head[0] + 96 - now.head[0] - 112) < 0.0001);
    assert.ok(Math.abs(old.head[2] - now.head[2] - 16) < 0.0001);
    assert.equal(now.avatar, old.avatar);
  }
  let textures = 0,
    geometries = 0;
  for (const batch of batches) {
    const material = batch.material as THREE.RawShaderMaterial;
    (material.uniforms.uSkin.value as THREE.DataTexture).addEventListener(
      'dispose',
      () => textures++,
    );
    batch.geometry.addEventListener('dispose', () => geometries++);
  }
  renderer.update(actors.slice(0, 1), new THREE.Vector3(), [0, 64, 0], 2, 0.2);
  assert.equal(scene.children.length, 1);
  renderer.dispose();
  renderer.dispose();
  assert.equal(scene.children.length, 0);
  assert.equal(textures, AVATAR_COUNT);
  assert.equal(geometries, AVATAR_COUNT);
  albedo.dispose();
  surface.dispose();
});
