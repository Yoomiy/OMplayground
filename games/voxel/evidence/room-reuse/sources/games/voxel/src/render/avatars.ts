import * as THREE from 'three';
import type { ActorAppearance } from '../shared/appearance.ts';
import type { EngineBlock, ItemDefinition } from '../shared/content.ts';
import { avatarIdentity, avatarSwing } from './avatar-motion.ts';
import { AvatarEquipmentRenderer } from './avatar-equipment.ts';
export type AvatarPose = Readonly<{
  id: string;
  position: readonly number[];
  yaw: number;
  pitch: number;
  speed: number;
  flying: boolean;
  appearance: ActorAppearance;
}>;
const palette = [0x4da6a6, 0x7f97d5, 0xc68e65, 0x83a868, 0xb781aa].map(
  (color) => new THREE.Color(color),
);
const skin = new THREE.Color().setRGB(0.76, 0.54, 0.35),
  trousers = new THREE.Color().setRGB(0.12, 0.19, 0.27);
/** Fixed draw-call count, growable instance buffers; no limit on admitted actors. */
export class AvatarRenderer {
  private geometry = new THREE.BoxGeometry(1, 1, 1);
  private material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  private faceGeometry = new THREE.PlaneGeometry(1, 1);
  private faceTexture: THREE.DataTexture;
  private faceMaterial: THREE.MeshBasicMaterial;
  private parts: THREE.InstancedMesh[] = [];
  private capacity = 8;
  private base = new THREE.Matrix4();
  private local = new THREE.Matrix4();
  private transform = new THREE.Matrix4();
  private rotation = new THREE.Matrix4();
  private color = new THREE.Color();
  private disposed = false;
  private equipment: AvatarEquipmentRenderer;
  private scene: THREE.Scene;
  get gear() {
    return { ...this.equipment.stats, samples: this.equipment.samples };
  }
  private sampleActors: { id: string; index: number }[] = [];
  private sampleMatrix = new THREE.Matrix4();
  readonly stats = { visible: 0, capacity: 8 };
  get samples() {
    return this.sampleActors.map(({ id, index }) => {
      this.parts[0].getMatrixAt(index, this.sampleMatrix);
      const head = [
        this.sampleMatrix.elements[12],
        this.sampleMatrix.elements[13],
        this.sampleMatrix.elements[14],
      ];
      this.parts[1].getMatrixAt(index, this.sampleMatrix);
      return {
        id,
        head,
        yaw: Math.atan2(this.sampleMatrix.elements[2], this.sampleMatrix.elements[0]),
      };
    });
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
    const pixels = new Uint8Array(8 * 8 * 4);
    const pixel = (x: number, y: number, r: number, g: number, b: number) =>
      pixels.set([r, g, b, 255], (y * 8 + x) * 4);
    for (const x of [2, 5]) {
      pixel(x, 4, 245, 245, 235);
      pixel(x, 3, 25, 35, 45);
    }
    for (const x of [3, 4]) pixel(x, 1, 70, 42, 33);
    this.faceTexture = new THREE.DataTexture(pixels, 8, 8);
    this.faceTexture.magFilter = this.faceTexture.minFilter = THREE.NearestFilter;
    this.faceTexture.needsUpdate = true;
    this.faceMaterial = new THREE.MeshBasicMaterial({
      map: this.faceTexture,
      transparent: true,
      alphaTest: 0.5,
    });
    this.allocate();
  }
  private allocate(): void {
    for (const part of this.parts) {
      part.removeFromParent();
      part.dispose();
    }
    this.parts = Array.from({ length: 7 }, (_, i) => {
      const part = new THREE.InstancedMesh(
        i === 6 ? this.faceGeometry : this.geometry,
        i === 6 ? this.faceMaterial : this.material,
        this.capacity,
      );
      part.count = 0;
      part.frustumCulled = false;
      part.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.scene.add(part);
      return part;
    });
    this.stats.capacity = this.capacity;
  }
  update(
    actors: readonly AvatarPose[],
    origin: THREE.Vector3,
    camera: readonly number[],
    seconds: number,
    daylight: number,
  ): void {
    if (this.disposed) return;
    // Players can pass through one another. Suppress bodies that would contain the camera.
    const visible = actors.filter(
      (actor) =>
        Math.hypot(actor.position[0] - camera[0], actor.position[2] - camera[2]) > 0.65 ||
        Math.abs(actor.position[1] - camera[1]) > 1.8,
    );
    let desired = 8;
    while (desired < visible.length) desired *= 2;
    if (desired > this.capacity || desired * 4 < this.capacity) {
      this.capacity = desired;
      this.allocate();
    }
    for (const part of this.parts) part.count = visible.length;
    const light = 0.2 + daylight * 0.8;
    for (let index = 0; index < visible.length; index++) {
      const actor = visible[index],
        hash = avatarIdentity(actor.id);
      const swing = avatarSwing(actor, seconds, hash);
      this.base
        .makeRotationY(-actor.yaw)
        .setPosition(actor.position[0] - origin.x, actor.position[1], actor.position[2] - origin.z);
      for (let part = 0; part < 7; part++) {
        if (part === 0 || part === 6) {
          this.local.makeTranslation(0, 1.58, 0).multiply(this.rotation.makeRotationX(actor.pitch));
          if (part === 6)
            this.local
              .multiply(this.transform.makeTranslation(0, 0, -0.223))
              .multiply(this.rotation.makeRotationY(Math.PI));
          this.local.multiply(this.transform.makeScale(0.44, 0.44, part === 6 ? 1 : 0.44));
        } else if (part === 1) this.local.makeScale(0.52, 0.56, 0.28).setPosition(0, 1.08, 0);
        else {
          const arm = part < 4,
            right = part % 2 === 0,
            direction = right ? 1 : -1;
          this.local
            .makeTranslation(direction * (arm ? 0.36 : 0.14), arm ? 1.32 : 0.8, 0)
            .multiply(this.rotation.makeRotationX(swing * direction * (arm ? 1 : -1)))
            .multiply(this.transform.makeTranslation(0, arm ? -0.275 : -0.4, 0))
            .multiply(
              this.rotation.makeScale(arm ? 0.18 : 0.23, arm ? 0.55 : 0.8, arm ? 0.2 : 0.28),
            );
        }
        this.transform.multiplyMatrices(this.base, this.local);
        this.parts[part].setMatrixAt(index, this.transform);
        if (part !== 6) {
          this.color
            .copy(
              part === 0 || part === 2 || part === 3
                ? skin
                : part === 1
                  ? palette[hash % palette.length]
                  : trousers,
            )
            .multiplyScalar(light);
          this.parts[part].setColorAt(index, this.color);
        }
      }
    }
    this.faceMaterial.color.setRGB(light, light, light);
    for (const part of this.parts) {
      part.instanceMatrix.needsUpdate = true;
      if (part.instanceColor) part.instanceColor.needsUpdate = true;
    }
    this.stats.visible = visible.length;
    this.sampleActors = visible.slice(0, 8).map((actor, index) => ({ id: actor.id, index }));
    this.equipment.update(visible, origin, seconds, daylight);
  }
  clear(): void {
    for (const part of this.parts) part.count = 0;
    this.sampleActors = [];
    this.stats.visible = 0;
    this.equipment.clear();
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.equipment.dispose();
    for (const part of this.parts) {
      part.removeFromParent();
      part.dispose();
    }
    this.parts = [];
    this.sampleActors = [];
    for (const geometry of [this.geometry, this.faceGeometry]) {
      geometry.dispose();
      for (const name of Object.keys(geometry.attributes)) geometry.deleteAttribute(name);
      geometry.setIndex(null);
    }
    this.material.dispose();
    this.faceMaterial.dispose();
    this.faceTexture.dispose();
    this.faceTexture.image.data = new Uint8Array(0);
    this.stats.visible = this.stats.capacity = 0;
  }
}
