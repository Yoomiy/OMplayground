import * as THREE from 'three';
import type { EngineBlock, ItemDefinition } from '../shared/content.ts';
import type { DropView } from '../shared/gameplay.ts';
import { itemGeometry, worldItemMaterial } from './held-block.ts';
type Batch = { mesh: THREE.InstancedMesh; capacity: number };
/** One growable instance batch per visible item kind, independent of admitted actors. */
export class DropRenderer {
  private batches = new Map<string, Batch>();
  private matrix = new THREE.Matrix4();
  private rotation = new THREE.Quaternion();
  private position = new THREE.Vector3();
  private scale = new THREE.Vector3(0.25, 0.25, 0.25);
  private euler = new THREE.Euler();
  private halo: THREE.InstancedMesh | null = null;
  private shown = new Map<string, THREE.Vector3>();
  private lastSeconds = 0;
  private disposed = false;
  readonly stats = { visible: 0, kinds: 0 };
  private scene: THREE.Scene;
  private blocks: readonly EngineBlock[];
  private items: readonly ItemDefinition[];
  private albedo: THREE.Texture;
  private surface: THREE.Texture;
  constructor(
    scene: THREE.Scene,
    blocks: readonly EngineBlock[],
    items: readonly ItemDefinition[],
    albedo: THREE.Texture,
    surface: THREE.Texture,
  ) {
    this.scene = scene;
    this.blocks = blocks;
    this.items = items;
    this.albedo = albedo;
    this.surface = surface;
  }
  update(
    drops: readonly DropView[],
    origin: THREE.Vector3,
    seconds: number,
    daylight: number,
  ): void {
    if (this.disposed) return;
    const dt = Math.max(0, Math.min(0.1, seconds - this.lastSeconds));
    this.lastSeconds = seconds;
    const live = new Set(drops.map((drop) => drop.id));
    for (const id of this.shown.keys()) if (!live.has(id)) this.shown.delete(id);
    if (!this.halo || this.halo.instanceMatrix.count < drops.length) {
      this.releaseHalo();
      let capacity = 8;
      while (capacity < drops.length) capacity *= 2;
      this.halo = new THREE.InstancedMesh(
        new THREE.RingGeometry(0.09, 0.17, 20).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({
          color: 0xffe7a3,
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
        capacity,
      );
      this.halo.frustumCulled = false;
      this.halo.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.scene.add(this.halo);
    }
    this.halo.count = drops.length;
    drops.forEach((drop, i) => {
      const target = new THREE.Vector3(...drop.position);
      const position = this.shown.get(drop.id) ?? target.clone();
      if (position.distanceToSquared(target) > 16) position.copy(target);
      else position.lerp(target, 1 - Math.exp(-20 * dt));
      this.shown.set(drop.id, position);
      this.matrix.makeTranslation(
        position.x - origin.x,
        position.y + 0.02 - origin.y,
        position.z - origin.z,
      );
      this.halo!.setMatrixAt(i, this.matrix);
    });
    this.halo.instanceMatrix.needsUpdate = true;
    const groups = new Map<string, DropView[]>();
    for (const drop of drops) {
      const group = groups.get(drop.stack.itemType) ?? [];
      group.push(drop);
      groups.set(drop.stack.itemType, group);
    }
    for (const [kind, batch] of this.batches)
      if (!groups.has(kind)) {
        this.release(batch);
        this.batches.delete(kind);
      }
    for (const [kind, values] of groups) {
      const item = this.items.find((item) => item.itemType === kind);
      if (!item) continue;
      let batch = this.batches.get(kind),
        capacity = 8;
      while (capacity < values.length) capacity *= 2;
      if (!batch || capacity > batch.capacity || capacity * 4 < batch.capacity) {
        if (batch) this.release(batch);
        const material = worldItemMaterial(item, this.blocks, this.albedo, this.surface);
        const mesh = new THREE.InstancedMesh(itemGeometry(item, this.blocks), material, capacity);
        mesh.frustumCulled = false;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.scene.add(mesh);
        batch = { mesh, capacity };
        this.batches.set(kind, batch);
      }
      batch.mesh.visible = true;
      batch.mesh.count = values.length;
      (batch.mesh.material as THREE.RawShaderMaterial).uniforms.uLight.value = 0.2 + daylight * 0.8;
      values.forEach((drop, index) => {
        const phase = Number(drop.id.slice(5)) % 17;
        const shown = this.shown.get(drop.id)!;
        this.position.set(
          shown.x - origin.x,
          shown.y + 0.16 + Math.sin(seconds * 2 + phase) * 0.035,
          shown.z - origin.z,
        );
        this.rotation.setFromEuler(this.euler.set(0, seconds * 0.7 + phase, 0));
        batch!.mesh.setMatrixAt(
          index,
          this.matrix.compose(this.position, this.rotation, this.scale),
        );
      });
      batch.mesh.instanceMatrix.needsUpdate = true;
    }
    this.stats.visible = drops.length;
    this.stats.kinds = groups.size;
  }
  private releaseHalo(): void {
    if (!this.halo) return;
    this.halo.removeFromParent();
    this.halo.geometry.dispose();
    (this.halo.material as THREE.Material).dispose();
    this.halo.dispose();
    this.halo = null;
  }
  clear(): void {
    this.releaseHalo();
    this.shown.clear();
    for (const batch of this.batches.values()) this.release(batch);
    this.batches.clear();
    this.stats.visible = this.stats.kinds = 0;
  }
  private release(batch: Batch): void {
    batch.mesh.removeFromParent();
    batch.mesh.geometry.dispose();
    (batch.mesh.material as THREE.Material).dispose();
    batch.mesh.dispose();
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
  }
}
