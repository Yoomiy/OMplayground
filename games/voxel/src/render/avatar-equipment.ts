import * as THREE from 'three';
import type { EngineBlock, ItemDefinition } from '../shared/content.ts';
import { EQUIPMENT } from '../shared/inventory.ts';
import type { EquipmentSlot } from '../shared/inventory.ts';
import type { AvatarPose } from './avatars.ts';
import { itemSprite } from './item-sprites.ts';
import { avatarJoint } from './avatar-model.ts';
import { avatarSwing } from './avatar-motion.ts';
import { itemGeometry, worldItemMaterial } from './held-block.ts';
type Attachment = {
  actor: AvatarPose;
  item: ItemDefinition;
  slot: EquipmentSlot | 'held';
  side: number;
};
type Batch = {
  mesh: THREE.InstancedMesh<THREE.BufferGeometry, THREE.RawShaderMaterial>;
  capacity: number;
};
/** Growable batches of visible gear. Public item identities never carry ownership metadata. */
export class AvatarEquipmentRenderer {
  private scene: THREE.Scene;
  private blocks: readonly EngineBlock[];
  private items: Map<string, ItemDefinition>;
  private albedo: THREE.Texture;
  private surface: THREE.Texture;
  private batches = new Map<string, Batch>();
  private root = new THREE.Matrix4();
  private local = new THREE.Matrix4();
  private scratch = new THREE.Matrix4();
  private matrix = new THREE.Matrix4();
  private sampleRefs: {
    id: string;
    itemType: string;
    slot: Attachment['slot'];
    side: number;
    batch: Batch;
    index: number;
  }[] = [];
  private disposed = false;
  readonly stats = { visible: 0, held: 0, worn: 0, kinds: 0, capacity: 0 };
  constructor(
    scene: THREE.Scene,
    blocks: readonly EngineBlock[],
    items: readonly ItemDefinition[],
    albedo: THREE.Texture,
    surface: THREE.Texture,
  ) {
    this.scene = scene;
    this.blocks = blocks;
    this.items = new Map(items.map((item) => [item.itemType, item]));
    this.albedo = albedo;
    this.surface = surface;
  }
  get samples() {
    return this.sampleRefs.map(({ id, itemType, slot, side, batch, index }) => {
      batch.mesh.getMatrixAt(index, this.matrix);
      return {
        id,
        itemType,
        slot,
        side,
        position: this.matrix.elements.slice(12, 15),
        grip: (slot === 'held' && itemSprite(this.items.get(itemType)!)
          ? new THREE.Vector3(-0.28, -0.28, 0)
          : new THREE.Vector3()
        )
          .applyMatrix4(this.matrix)
          .toArray(),
        vertices: batch.mesh.geometry.getAttribute('position').count,
      };
    });
  }
  update(
    actors: readonly AvatarPose[],
    origin: THREE.Vector3,
    seconds: number,
    daylight: number,
  ): void {
    if (this.disposed) return;
    const groups = new Map<string, Attachment[]>();
    const add = (actor: AvatarPose, kind: string | null, slot: Attachment['slot'], side = 0) => {
      if (!kind) return;
      const item = this.items.get(kind);
      if (!item || (slot !== 'held' && item.equipment !== slot))
        throw new Error('invalid avatar equipment');
      const key = `${kind}:${slot === 'feet' ? 'foot' : 'item'}`;
      const group = groups.get(key) ?? [];
      group.push({ actor, item, slot, side });
      groups.set(key, group);
    };
    for (const actor of actors) {
      add(actor, actor.appearance.held, 'held');
      for (const slot of EQUIPMENT) {
        if (slot === 'feet')
          for (const side of [-1, 1]) add(actor, actor.appearance.equipment[slot], slot, side);
        else add(actor, actor.appearance.equipment[slot], slot);
      }
    }
    this.sampleRefs = [];
    for (const [key, batch] of this.batches)
      if (!groups.has(key)) {
        this.release(batch);
        this.batches.delete(key);
      }
    let visible = 0,
      held = 0,
      capacitySum = 0;
    for (const [key, values] of groups) {
      let batch = this.batches.get(key),
        capacity = 8;
      while (capacity < values.length) capacity *= 2;
      if (!batch || capacity > batch.capacity || capacity * 4 < batch.capacity) {
        if (batch) this.release(batch);
        const first = values[0];
        const mesh = new THREE.InstancedMesh(
          itemGeometry(first.item, this.blocks, first.slot === 'held' ? undefined : first.slot),
          worldItemMaterial(
            first.item,
            this.blocks,
            this.albedo,
            this.surface,
            first.slot === 'held' ? undefined : first.slot,
          ),
          capacity,
        );
        mesh.frustumCulled = false;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.scene.add(mesh);
        batch = { mesh, capacity };
        this.batches.set(key, batch);
      }
      batch.mesh.count = values.length;
      batch.mesh.material.uniforms.uLight.value = 0.2 + daylight * 0.8;
      for (const [index, entry] of values.entries()) {
        this.pose(entry, origin, seconds);
        batch.mesh.setMatrixAt(index, this.matrix);
        if (this.sampleRefs.length < 24)
          this.sampleRefs.push({
            id: entry.actor.id,
            itemType: entry.item.itemType,
            slot: entry.slot,
            side: entry.side,
            batch,
            index,
          });
        if (entry.slot === 'held') held++;
      }
      batch.mesh.instanceMatrix.needsUpdate = true;
      visible += values.length;
      capacitySum += batch.capacity;
    }
    Object.assign(this.stats, {
      visible,
      held,
      worn: visible - held,
      kinds: groups.size,
      capacity: capacitySum,
    });
  }
  private pose(entry: Attachment, origin: THREE.Vector3, seconds: number): void {
    const { actor, slot, side, item } = entry,
      swing = avatarSwing(actor, seconds);
    this.root
      .makeRotationY(-actor.yaw)
      .setPosition(actor.position[0] - origin.x, actor.position[1], actor.position[2] - origin.z);
    let scale = 0.5;
    if (slot === 'held' || slot === 'offhand') {
      const direction = slot === 'held' ? 1 : -1;
      const arm = avatarJoint(actor.id, direction > 0 ? 'upperArmR' : 'upperArmL', actor.avatar);
      const grip = avatarJoint(actor.id, direction > 0 ? 'gripR' : 'gripL', actor.avatar);
      this.local
        .makeTranslation(arm.x, arm.y, arm.z)
        .multiply(this.scratch.makeRotationX(swing * direction))
        .multiply(this.scratch.makeTranslation(grip.x - arm.x, grip.y - arm.y, grip.z - arm.z));
      if (slot === 'held' && itemSprite(item)) {
        // Upstream inFist: .62 scale, lower-left handle in the fist. Our figures face -Z.
        this.local.multiply(this.scratch.makeRotationY(Math.PI / 2));
        this.local.multiply(this.scratch.makeScale(0.62, 0.62, 0.62));
        this.local.multiply(this.scratch.makeTranslation(0.28, 0.28, 0));
        scale = 1;
      } else {
        if (slot === 'held') this.local.multiply(this.scratch.makeRotationZ(-0.2));
        scale = slot === 'offhand' ? 0.8 : item.places ? 0.34 : 0.65;
      }
    } else if (slot === 'feet') {
      const leg = avatarJoint(actor.id, side > 0 ? 'upperLegR' : 'upperLegL', actor.avatar);
      const foot = avatarJoint(actor.id, side > 0 ? 'footR' : 'footL', actor.avatar);
      this.local
        .makeTranslation(leg.x, leg.y, leg.z)
        .multiply(this.scratch.makeRotationX(-swing * side))
        .multiply(
          this.scratch.makeTranslation(
            foot.x - leg.x,
            foot.y - leg.y + 0.31 - 3 / 26,
            foot.z - leg.z,
          ),
        );
      scale = 0.62;
    } else if (slot === 'head') {
      const head = avatarJoint(actor.id, 'head', actor.avatar);
      this.local
        .makeTranslation(head.x, head.y, head.z)
        .multiply(this.scratch.makeRotationX(actor.pitch))
        .multiply(this.scratch.makeTranslation(0, 0.32, -0.25));
      scale = 0.45;
    } else if (slot === 'body') {
      this.local.makeTranslation(0, 1.05, -0.19);
      scale = 0.65;
    } else this.local.makeTranslation(0.25, 0.85, -0.19);
    this.local.multiply(this.scratch.makeScale(scale, scale, scale));
    this.matrix.multiplyMatrices(this.root, this.local);
  }
  private release(batch: Batch): void {
    batch.mesh.removeFromParent();
    batch.mesh.geometry.dispose();
    batch.mesh.material.dispose();
    batch.mesh.dispose();
  }
  clear(): void {
    for (const batch of this.batches.values()) this.release(batch);
    this.batches.clear();
    this.sampleRefs = [];
    Object.assign(this.stats, { visible: 0, held: 0, worn: 0, kinds: 0, capacity: 0 });
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
  }
}
