import * as THREE from 'three';
import type { ActorAppearance } from '../shared/appearance.ts';
import type { EngineBlock, ItemDefinition } from '../shared/content.ts';
import { avatarSwing } from './avatar-motion.ts';
import { AvatarEquipmentRenderer } from './avatar-equipment.ts';
import {
  avatarAsset,
  avatarGeometry,
  avatarJoint,
  avatarMaterial,
  avatarVariant,
} from './avatar-model.ts';
import { AVATAR_PRESETS } from './upstream/blockyard/avatar.ts';
export type AvatarPose = Readonly<{
  id: string;
  avatar?: number;
  position: readonly number[];
  yaw: number;
  pitch: number;
  speed: number;
  flying: boolean;
  appearance: ActorAppearance;
  actionSwing?: number;
}>;
type Batch = {
  mesh: THREE.InstancedMesh<THREE.BufferGeometry, THREE.RawShaderMaterial>;
  texture: THREE.DataTexture;
  pose: THREE.InstancedBufferAttribute;
  capacity: number;
};
/** At most eight body draw calls: players with the same upstream preset share a batch. */
export class AvatarRenderer {
  private batches = new Map<number, Batch>();
  private base = new THREE.Matrix4();
  private head = new THREE.Vector3();
  private rotation = new THREE.Matrix4();
  private disposed = false;
  private scene: THREE.Scene;
  private equipment: AvatarEquipmentRenderer;
  private sampleActors: {
    id: string;
    head: number[];
    yaw: number;
    variant: number;
    avatar: string;
  }[] = [];
  readonly stats = { visible: 0, capacity: 0 };
  get gear() {
    return { ...this.equipment.stats, samples: this.equipment.samples };
  }
  get samples() {
    return this.sampleActors.map((sample) => ({ ...sample, head: [...sample.head] }));
  }
  constructor(
    scene: THREE.Scene,
    blocks: readonly EngineBlock[],
    items: readonly ItemDefinition[],
    albedo: THREE.Texture,
    surface: THREE.Texture,
  ) {
    this.scene = scene;
    this.equipment = new AvatarEquipmentRenderer(scene, blocks, items, albedo, surface);
  }
  private allocate(variant: number, capacity: number, previous?: Batch): Batch {
    const asset = avatarAsset(variant);
    const texture =
      previous?.texture ??
      new THREE.DataTexture(asset.atlas.albedo, asset.atlas.width, asset.atlas.height);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = texture.minFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    const material = previous?.mesh.material ?? avatarMaterial(texture);
    const geometry = avatarGeometry(asset);
    const pose = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2);
    pose.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('pose', pose);
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.userData.avatarVariant = variant;
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (previous) {
      previous.mesh.removeFromParent();
      previous.mesh.geometry.dispose();
      previous.mesh.dispose();
    }
    this.scene.add(mesh);
    return { mesh, texture, pose, capacity };
  }
  update(
    actors: readonly AvatarPose[],
    origin: THREE.Vector3,
    camera: readonly number[],
    seconds: number,
    daylight: number,
  ): void {
    if (this.disposed) return;
    const visible = actors.filter(
      (actor) =>
        Math.hypot(actor.position[0] - camera[0], actor.position[2] - camera[2]) > 0.65 ||
        Math.abs(actor.position[1] - camera[1]) > 1.8,
    );
    const groups = new Map<number, AvatarPose[]>();
    for (const actor of visible) {
      const variant = avatarVariant(actor.id, actor.avatar),
        group = groups.get(variant) ?? [];
      group.push(actor);
      groups.set(variant, group);
    }
    for (const [variant, batch] of this.batches)
      if (!groups.has(variant)) {
        this.release(batch);
        this.batches.delete(variant);
      }
    this.sampleActors = [];
    let capacitySum = 0;
    for (const [variant, values] of groups) {
      let capacity = 8;
      while (capacity < values.length) capacity *= 2;
      let batch = this.batches.get(variant);
      if (!batch || capacity > batch.capacity || capacity * 4 < batch.capacity) {
        batch = this.allocate(variant, capacity, batch);
        this.batches.set(variant, batch);
      }
      batch.mesh.count = values.length;
      batch.mesh.material.uniforms.uLight.value = 0.2 + daylight * 0.8;
      values.forEach((actor, index) => {
        this.base
          .makeRotationY(-actor.yaw)
          .setPosition(
            actor.position[0] - origin.x,
            actor.position[1],
            actor.position[2] - origin.z,
          );
        batch.mesh.setMatrixAt(index, this.base);
        batch.pose.setXY(index, actor.pitch, avatarSwing(actor, seconds));
        if (this.sampleActors.length < 8) {
          const pivot = avatarJoint(actor.id, 'head', actor.avatar);
          this.head
            .set(0, 6 / 26, 0)
            .applyMatrix4(this.rotation.makeRotationX(actor.pitch))
            .add(pivot)
            .applyMatrix4(this.base);
          this.sampleActors.push({
            id: actor.id,
            head: this.head.toArray(),
            yaw: actor.yaw,
            variant,
            avatar: AVATAR_PRESETS[variant].name,
          });
        }
      });
      batch.mesh.instanceMatrix.needsUpdate = true;
      batch.pose.needsUpdate = true;
      capacitySum += batch.capacity;
    }
    Object.assign(this.stats, { visible: visible.length, capacity: capacitySum });
    this.equipment.update(visible, origin, seconds, daylight);
  }
  private release(batch: Batch): void {
    batch.mesh.removeFromParent();
    batch.mesh.geometry.dispose();
    batch.mesh.material.dispose();
    batch.mesh.dispose();
    batch.texture.dispose();
    batch.texture.image.data = new Uint8Array(0);
  }
  clear(): void {
    for (const batch of this.batches.values()) batch.mesh.count = 0;
    this.sampleActors = [];
    this.stats.visible = 0;
    this.equipment.clear();
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.equipment.dispose();
    for (const batch of this.batches.values()) this.release(batch);
    this.batches.clear();
    this.sampleActors = [];
    this.stats.visible = this.stats.capacity = 0;
  }
}
