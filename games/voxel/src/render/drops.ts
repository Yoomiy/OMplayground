import * as THREE from 'three';
import type { EngineBlock, ItemDefinition } from '../shared/content.ts';
import { DROP_SIZE, DROP_HEIGHT } from '../shared/gameplay.ts';
import type { DropView } from '../shared/gameplay.ts';
import { sweepDrop } from '../shared/drop-physics.ts';
import type { DropCollisionWorld } from '../shared/drop-physics.ts';
import { itemGeometry, worldItemMaterial } from './held-block.ts';
type Batch = { mesh: THREE.InstancedMesh; capacity: number };
/** One growable instance batch per visible item kind, independent of admitted actors. */
export class DropRenderer {
  private batches = new Map<string, Batch>();
  private matrix = new THREE.Matrix4();
  private rotation = new THREE.Quaternion();
  private position = new THREE.Vector3();
  private scale = new THREE.Vector3(DROP_SIZE, DROP_SIZE, DROP_SIZE);
  private euler = new THREE.Euler();
  private delta = new THREE.Vector3();
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
    world: DropCollisionWorld,
  ): void {
    if (this.disposed) return;
    const dt = Math.max(0, Math.min(0.1, seconds - this.lastSeconds));
    this.lastSeconds = seconds;
    const live = new Set(drops.map((drop) => drop.id));
    for (const id of this.shown.keys()) if (!live.has(id)) this.shown.delete(id);
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
        const id = Number(drop.id.slice(5));
        const phase = id % 17;
        const bob = (Math.sin(seconds * 6.6) * 0.5 + 0.5) * 0.022;
        let shown = this.shown.get(drop.id);
        if (!shown) {
          shown = new THREE.Vector3(...drop.position);
          this.shown.set(drop.id, shown);
        }
        this.delta.set(
          drop.position[0] - shown.x,
          drop.position[1] + bob - shown.y,
          drop.position[2] - shown.z,
        );
        if (this.delta.lengthSq() > 16) {
          shown.set(...drop.position);
          this.delta.set(0, bob, 0);
        } else {
          this.delta.multiplyScalar(1 - Math.exp(-20 * dt));
          this.delta.clampLength(0, 0.16 * Math.max(1, dt * 60));
        }
        // Sweep the final visual body, including bobbing. A rotation-safe envelope
        // protects every yaw without item-to-item comparisons or extra meshes.
        const safe = sweepDrop(
          world,
          this.blocks,
          shown.x,
          shown.y,
          shown.z,
          this.delta.x,
          this.delta.y,
          this.delta.z,
        );
        shown.set(safe[0], safe[1], safe[2]);
        this.position.set(
          shown.x - origin.x,
          shown.y + DROP_HEIGHT / 2 - origin.y,
          shown.z - origin.z,
        );
        this.rotation.setFromEuler(this.euler.set(0, seconds * 2.1 * (id % 2 ? -1 : 1) + phase, 0));
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
  clear(): void {
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
