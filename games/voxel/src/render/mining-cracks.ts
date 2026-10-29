import * as THREE from 'three';

/** Target-shaped crack overlay; stages come only from confirmed mining progress. */
export class MiningCracks {
  readonly group = new THREE.Group();
  private textures: THREE.CanvasTexture[] = [];
  private material = new THREE.MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  constructor() {
    for (let stage = 0; stage < 8; stage++) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 32;
      const context = canvas.getContext('2d')!;
      context.strokeStyle = '#21170f';
      context.lineWidth = stage > 4 ? 2 : 1;
      for (let branch = 0; branch <= stage + 2; branch++) {
        context.beginPath();
        context.moveTo(16, 16);
        for (let step = 1; step <= 2 + stage; step++) {
          const angle = branch * 2.399 + Math.sin(step * 7 + branch) * 0.25;
          const radius = step * 2;
          context.lineTo(
            Math.round(16 + Math.cos(angle) * radius),
            Math.round(16 + Math.sin(angle) * radius),
          );
        }
        context.stroke();
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.magFilter = texture.minFilter = THREE.NearestFilter;
      this.textures.push(texture);
    }
    this.group.visible = false;
  }
  target(
    boxes: readonly (readonly number[])[],
    cell: readonly number[] | null,
    origin: THREE.Vector3,
  ): void {
    for (const child of [...this.group.children]) {
      (child as THREE.Mesh).geometry.dispose();
      this.group.remove(child);
    }
    if (!cell) return;
    for (const box of boxes) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(
          (box[3] - box[0]) / 16 + 0.006,
          (box[4] - box[1]) / 16 + 0.006,
          (box[5] - box[2]) / 16 + 0.006,
        ),
        this.material,
      );
      mesh.position.set(
        cell[0] + (box[0] + box[3]) / 32 - origin.x,
        cell[1] + (box[1] + box[4]) / 32,
        cell[2] + (box[2] + box[5]) / 32 - origin.z,
      );
      this.group.add(mesh);
    }
  }
  progress(value: number): void {
    this.group.visible = value > 0;
    const texture = this.textures[Math.min(7, Math.floor(value * 8))];
    if (texture !== this.material.map) {
      this.material.map = texture;
      this.material.needsUpdate = true;
    }
  }
  dispose(): void {
    this.target([], null, new THREE.Vector3());
    for (const texture of this.textures) texture.dispose();
    this.material.dispose();
  }
}
