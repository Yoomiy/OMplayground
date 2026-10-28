import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { source } from '../content/index.ts';
import { compileContent } from '../tools/compile-content.ts';
import { emptyAppearance } from '../src/shared/appearance.ts';
import { AvatarEquipmentRenderer } from '../src/render/avatar-equipment.ts';
import type { AvatarPose } from '../src/render/avatars.ts';
const content = compileContent(source).manifest;
function fixture() {
  const scene = new THREE.Scene(),
    albedo = new THREE.Texture(),
    surface = new THREE.Texture();
  return {
    scene,
    albedo,
    surface,
    renderer: new AvatarEquipmentRenderer(scene, content.blocks, content.items, albedo, surface),
  };
}
function actor(): AvatarPose {
  return {
    id: 'peer',
    position: [49.5, 68, -2.7],
    yaw: 0,
    pitch: 0,
    speed: 0,
    flying: false,
    appearance: {
      held: 'wooden_pickaxe',
      equipment: {
        head: 'helios_medallion',
        body: null,
        legs: 'feather_talisman',
        feet: 'trail_boots',
        offhand: 'heavy_shield',
      },
    },
  };
}
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 0.00002, `${a} must equal ${b}`);
test('submitted held and worn instances follow the avatar joints and preserve absolute coordinates across chunk-origin shifts', () => {
  const f = fixture(),
    a = actor(),
    first = new THREE.Vector3(48, 0, -16),
    second = new THREE.Vector3(64, 0, 0);
  try {
    f.renderer.update([a], first, 0, 1);
    assert.equal(f.renderer.stats.visible, 6);
    assert.equal(f.renderer.stats.held, 1);
    assert.equal(f.renderer.stats.worn, 5);
    const before = f.renderer.samples;
    near(before.find((s) => s.slot === 'held')!.position[0], 1.86);
    near(before.find((s) => s.slot === 'offhand')!.position[0], 1.14);
    const feet = before.filter((s) => s.slot === 'feet');
    assert.equal(feet.length, 2);
    assert.ok(feet.every((s) => s.vertices === 48));
    near(feet[0].position[1], 68.3);
    f.renderer.update([a], second, 0, 1);
    for (const sample of f.renderer.samples) {
      const old = before.find((s) => s.slot === sample.slot && s.side === sample.side)!;
      for (const axis of [0, 1, 2])
        near(
          sample.position[axis] + second.getComponent(axis),
          old.position[axis] + first.getComponent(axis),
        );
    }
    f.renderer.update([{ ...a, yaw: Math.PI / 2 }], first, 0, 1);
    assert.ok(
      f.renderer.samples.find((s) => s.slot === 'held')!.position[2] > a.position[2] - first.z,
    );
    assert.ok(
      f.renderer.samples.find((s) => s.slot === 'offhand')!.position[2] < a.position[2] - first.z,
    );
    const moving = { ...a, speed: 4 };
    f.renderer.update([moving], first, 0.1, 1);
    const movingFeet = f.renderer.samples.filter((s) => s.slot === 'feet');
    f.renderer.update([moving], first, 0.25, 1);
    assert.notDeepEqual(
      f.renderer.samples.filter((s) => s.slot === 'feet'),
      movingFeet,
    );
    f.renderer.update([{ ...moving, flying: true }], first, 0.25, 1);
    near(f.renderer.samples.find((s) => s.slot === 'feet')!.position[1], 68.3);
  } finally {
    f.renderer.dispose();
    f.albedo.dispose();
    f.surface.dispose();
  }
});
test('growable equipment batches render every actor, shrink/release old buffers, and never dispose caller-owned textures', () => {
  const f = fixture(),
    a = actor();
  const actors = Array.from({ length: 129 }, (_, i) => ({
    ...a,
    id: `peer-${i}`,
    appearance: {
      ...emptyAppearance(),
      held: 'wooden_pickaxe',
      equipment: { ...emptyAppearance().equipment, feet: 'trail_boots' },
    },
  }));
  let textureDisposals = 0,
    releases = 0;
  f.albedo.addEventListener('dispose', () => textureDisposals++);
  f.surface.addEventListener('dispose', () => textureDisposals++);
  try {
    f.renderer.update(actors, new THREE.Vector3(), 0, 1);
    assert.equal(f.renderer.stats.visible, 387);
    assert.equal(f.scene.children.length, 2);
    assert.equal(
      f.scene.children.reduce((n, m) => n + (m as THREE.InstancedMesh).count, 0),
      387,
    );
    for (const mesh of f.scene.children as THREE.InstancedMesh<
      THREE.BufferGeometry,
      THREE.RawShaderMaterial
    >[]) {
      mesh.addEventListener('dispose', () => releases++);
      mesh.geometry.addEventListener('dispose', () => releases++);
      mesh.material.addEventListener('dispose', () => releases++);
    }
    f.renderer.update(actors.slice(0, 3), new THREE.Vector3(), 1, 1);
    assert.equal(releases, 6);
    assert.equal(f.renderer.stats.visible, 9);
    assert.equal(f.scene.children.length, 2);
    assert.equal(f.renderer.stats.capacity, 16);
    f.renderer.update([], new THREE.Vector3(), 2, 1);
    assert.equal(f.scene.children.length, 0);
    assert.deepEqual(f.renderer.samples, []);
    assert.deepEqual(f.renderer.stats, { visible: 0, held: 0, worn: 0, kinds: 0, capacity: 0 });
    f.renderer.dispose();
    f.renderer.dispose();
    f.renderer.update(actors, new THREE.Vector3(), 3, 1);
    assert.equal(f.scene.children.length, 0);
    assert.equal(textureDisposals, 0);
  } finally {
    f.renderer.dispose();
    f.albedo.dispose();
    f.surface.dispose();
  }
});
test('avatar block items use the same cutout, tint and liquid styling as world items', () => {
  const f = fixture(),
    a = actor();
  try {
    f.renderer.update(
      [{ ...a, appearance: { ...emptyAppearance(), held: 'oak_leaves' } }],
      new THREE.Vector3(),
      0,
      0.4,
    );
    let mesh = f.scene.children[0] as THREE.InstancedMesh<
      THREE.BufferGeometry,
      THREE.RawShaderMaterial
    >;
    assert.equal(mesh.material.uniforms.uCutout.value, 1);
    assert.equal(mesh.material.uniforms.uTint.value, 2);
    f.renderer.update(
      [{ ...a, appearance: { ...emptyAppearance(), held: 'water' } }],
      new THREE.Vector3(),
      1,
      0.4,
    );
    mesh = f.scene.children[0] as typeof mesh;
    assert.equal(mesh.material.transparent, true);
    assert.equal(mesh.material.depthWrite, false);
    assert.equal(mesh.material.uniforms.uAlpha.value, 0.65);
    assert.equal(mesh.material.uniforms.uAlbedo.value, f.albedo);
    assert.equal(mesh.material.uniforms.uMaterial.value, f.surface);
  } finally {
    f.renderer.dispose();
    f.albedo.dispose();
    f.surface.dispose();
  }
});
