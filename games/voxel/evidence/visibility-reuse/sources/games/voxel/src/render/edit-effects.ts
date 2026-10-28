import * as THREE from 'three';
import type { EngineBlock } from '../shared/content.ts';
type Particle = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  started: number;
  color: readonly number[];
};
/** One bounded presentation buffer, independent of world transactions or player counts. */
export class EditEffects {
  private particles: Particle[] = [];
  private positions = new Float32Array(128 * 3);
  private colors = new Float32Array(128 * 3);
  private points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private palette: number[][];
  private disposed = false;
  readonly stats = { live: 0, bursts: 0, hits: 0, explosions: 0 };
  constructor(
    scene: THREE.Scene,
    pixels: Uint8Array,
    layers: number,
    private blocks: readonly EngineBlock[],
  ) {
    this.palette = Array.from({ length: layers }, (_, layer) => {
      const color = [0, 0, 0];
      for (let i = 0; i < 256; i += 8)
        for (let channel = 0; channel < 3; channel++)
          color[channel] += pixels[(layer * 256 + i) * 4 + channel] / (255 * 32);
      return color;
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage),
    );
    this.points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ vertexColors: true, size: 0.055, sizeAttenuation: true }),
    );
    this.points.frustumCulled = false;
    this.points.visible = false;
    scene.add(this.points);
  }
  burst(cell: readonly number[], state: number, now: number, removal: boolean): void {
    if (this.disposed) return;
    const color = this.palette[this.blocks[state]?.tex[2] ?? 0] ?? [0.6, 0.6, 0.6];
    const count = removal ? 12 : 6;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= 128) this.particles.shift();
      const angle = i * 2.399963 + this.stats.bursts,
        radius = removal ? 0.25 : 0.6;
      this.particles.push({
        x: cell[0] + 0.5 + Math.cos(angle) * radius,
        y: cell[1] + 0.55,
        z: cell[2] + 0.5 + Math.sin(angle) * radius,
        vx: Math.cos(angle) * 1.6,
        vy: 1 + (i % 4) * 0.4,
        vz: Math.sin(angle) * 1.6,
        started: now,
        color,
      });
    }
    this.stats.bursts++;
  }
  hit(position: readonly number[], now: number): void {
    if (this.disposed) return;
    for (let i = 0; i < 8; i++) {
      if (this.particles.length >= 128) this.particles.shift();
      const angle = i * 2.399963 + this.stats.hits;
      this.particles.push({
        x: position[0],
        y: position[1],
        z: position[2],
        vx: Math.cos(angle) * 1.2,
        vy: 0.5 + i * 0.12,
        vz: Math.sin(angle) * 1.2,
        started: now,
        color: [1, 0.72, 0.25],
      });
    }
    this.stats.bursts++;
    this.stats.hits++;
  }
  explosion(position: readonly number[], radius: number, now: number): void {
    if (this.disposed) return;
    for (let i = 0; i < 40; i++) {
      if (this.particles.length >= 128) this.particles.shift();
      const angle = i * 2.399963 + this.stats.explosions;
      this.particles.push({
        x: position[0],
        y: position[1],
        z: position[2],
        vx: Math.cos(angle) * radius * (0.5 + (i % 4) * 0.25),
        vy: 1 + (i % 6) * 0.5,
        vz: Math.sin(angle) * radius * (0.5 + (i % 4) * 0.25),
        started: now,
        color: i % 3 === 0 ? [1, 0.6, 0.15] : [0.6, 0.58, 0.54],
      });
    }
    this.stats.bursts++;
    this.stats.explosions++;
  }
  clear(): void {
    this.particles = [];
    this.points.visible = false;
    this.stats.live = 0;
  }
  frame(now: number, origin: THREE.Vector3, daylight: number): void {
    if (this.disposed) return;
    this.particles = this.particles.filter((p) => now - p.started < 650);
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i],
        t = Math.max(0, (now - p.started) / 1000);
      this.positions.set(
        [p.x + p.vx * t - origin.x, p.y + p.vy * t - 6 * t * t, p.z + p.vz * t - origin.z],
        i * 3,
      );
      this.colors.set(
        p.color.map((v) => v * (0.2 + daylight * 0.8)),
        i * 3,
      );
    }
    this.points.visible = this.particles.length > 0;
    this.points.geometry.setDrawRange(0, this.particles.length);
    this.points.geometry.getAttribute('position').needsUpdate = true;
    this.points.geometry.getAttribute('color').needsUpdate = true;
    this.stats.live = this.particles.length;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.points.removeFromParent();
    this.points.geometry.dispose();
    this.points.material.dispose();
    this.points.geometry.deleteAttribute('position');
    this.points.geometry.deleteAttribute('color');
    this.positions = this.colors = new Float32Array(0);
    this.particles = [];
    this.palette = [];
    this.stats.live = 0;
  }
}
