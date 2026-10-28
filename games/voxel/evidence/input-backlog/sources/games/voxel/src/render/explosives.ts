import * as THREE from 'three';
import type { EngineBlock } from '../shared/content.ts';
import type { ExplosiveView } from '../shared/explosives.ts';
import { geometryFor, itemMaterial } from './held-block.ts';
/** Two growable instance batches for normal/flash phases, with no body admission limit. */
export class ExplosiveRenderer {
  private meshes: THREE.InstancedMesh[] = [];
  private geometry: THREE.BufferGeometry | null = null;
  private capacity = 0;
  private state = -1;
  private matrix = new THREE.Matrix4();
  readonly stats = { visible: 0, capacity: 0, flashing: 0 };
  constructor(
    private scene: THREE.Scene,
    private blocks: readonly EngineBlock[],
    private albedo: THREE.Texture,
    private material: THREE.Texture,
  ) {}
  update(bodies: readonly ExplosiveView[], origin: THREE.Vector3, daylight: number): void {
    if (!bodies.length) {
      this.clear();
      return;
    }
    let capacity = 8;
    while (capacity < bodies.length) capacity *= 2;
    if (
      this.capacity < capacity ||
      this.capacity > capacity * 4 ||
      this.state !== bodies[0].state
    ) {
      this.clear();
      this.capacity = capacity;
      this.state = bodies[0].state;
      this.geometry = geometryFor(this.blocks[this.state]);
      this.meshes = [false, true].map((flash) => {
        const material = itemMaterial(this.albedo, this.material, true);
        material.uniforms.uColor.value.setScalar(flash ? 3 : 1);
        const mesh = new THREE.InstancedMesh(this.geometry!, material, capacity);
        mesh.frustumCulled = false;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.scene.add(mesh);
        return mesh;
      });
    }
    const counts = [0, 0];
    for (const body of bodies) {
      const flash = body.remaining % 12 < 6 ? 1 : 0;
      this.matrix.makeScale(0.9, 0.9, 0.9);
      this.matrix.setPosition(
        body.position[0] - origin.x,
        body.position[1] + 0.45,
        body.position[2] - origin.z,
      );
      this.meshes[flash].setMatrixAt(counts[flash]++, this.matrix);
    }
    this.meshes.forEach((mesh, index) => {
      mesh.count = counts[index];
      mesh.visible = counts[index] > 0;
      mesh.instanceMatrix.needsUpdate = true;
      (mesh.material as THREE.RawShaderMaterial).uniforms.uLight.value = 0.25 + daylight * 0.75;
    });
    this.stats.visible = bodies.length;
    this.stats.capacity = this.capacity;
    this.stats.flashing = counts[1];
  }
  clear(): void {
    for (const mesh of this.meshes) {
      mesh.removeFromParent();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    }
    this.geometry?.dispose();
    this.geometry = null;
    this.meshes = [];
    this.capacity = 0;
    this.state = -1;
    this.stats.visible = this.stats.capacity = this.stats.flashing = 0;
  }
  dispose(): void {
    this.clear();
  }
}
