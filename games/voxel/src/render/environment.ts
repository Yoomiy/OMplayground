import * as THREE from 'three';
import type { Environment } from '../shared/environment.ts';

/** Small bounded atmosphere; no block simulation or scene lights per torch. */
export class EnvironmentRenderer {
  private group = new THREE.Group();
  private sun = new THREE.Mesh(
    new THREE.CircleGeometry(2.4, 16),
    new THREE.MeshBasicMaterial({ color: 0xffdf92, depthWrite: false }),
  );
  private moon = new THREE.Mesh(
    new THREE.CircleGeometry(1.6, 16),
    new THREE.MeshBasicMaterial({ color: 0xdbe7fa, depthWrite: false }),
  );
  private stars: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private rain: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private rainPositions = new Float32Array(96 * 6);
  private clouds = new THREE.InstancedMesh(
    new THREE.BoxGeometry(18, 1.5, 12),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    }),
    16,
  );
  private matrix = new THREE.Matrix4();
  private direction = new THREE.Vector3();
  private disposed = false;
  readonly stats = { rainLines: 0, stars: false, clouds: 16, sun: false, moon: false };
  constructor(scene: THREE.Scene) {
    const geometry = new THREE.BufferGeometry(),
      points = new Float32Array(64 * 3);
    for (let i = 0; i < 64; i++) {
      const angle = i * 2.399963229728653,
        y = (i + 0.5) / 64;
      const r = Math.sqrt(1 - y * y);
      points.set([Math.cos(angle) * r * 100, y * 100, Math.sin(angle) * r * 100], i * 3);
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
    this.stars = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: 0xdceaff,
        size: 0.3,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    );
    const rainGeometry = new THREE.BufferGeometry();
    rainGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.rainPositions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    this.rain = new THREE.LineSegments(
      rainGeometry,
      new THREE.LineBasicMaterial({
        color: 0x9fbad4,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    this.rain.frustumCulled = this.clouds.frustumCulled = this.stars.frustumCulled = false;
    this.group.add(this.sun, this.moon, this.stars, this.rain, this.clouds);
    scene.add(this.group);
  }
  update(
    environment: Environment,
    camera: THREE.Camera,
    worldPosition: readonly number[],
    openSky: boolean,
  ): void {
    if (this.disposed) return;
    const e = environment,
      p = camera.position;
    this.direction.set(...e.sun);
    this.sun.position.copy(p).addScaledVector(this.direction, 80);
    this.moon.position.copy(p).addScaledVector(this.direction, -80);
    this.sun.quaternion.copy(camera.quaternion);
    this.moon.quaternion.copy(camera.quaternion);
    this.sun.visible = e.sun[1] > -0.05;
    this.moon.visible = e.sun[1] < 0.05;
    this.stars.position.copy(p);
    this.stars.material.opacity = Math.max(0, (0.3 - e.daylight) * 3) * (1 - e.rain);
    this.stars.visible = this.stars.material.opacity > 0.01;
    for (let i = 0; i < 16; i++) {
      const x = ((((i * 59 + e.seconds * e.wind[0] - worldPosition[0]) % 224) + 224) % 224) - 112;
      const z = ((((i * 83 + e.seconds * e.wind[1] - worldPosition[2]) % 224) + 224) % 224) - 112;
      this.matrix
        .makeScale(1 + (i % 3) * 0.4, 1, 1 + (i % 2) * 0.5)
        .setPosition(p.x + x, 118 + (i % 3), p.z + z);
      this.clouds.setMatrixAt(i, this.matrix);
    }
    this.clouds.instanceMatrix.needsUpdate = true;
    const cloudMaterial = this.clouds.material as THREE.MeshBasicMaterial;
    cloudMaterial.opacity = 0.18 + e.rain * 0.38;
    cloudMaterial.color.setRGB(
      e.daylight * (0.85 - e.rain * 0.35),
      e.daylight * (0.9 - e.rain * 0.35),
      e.daylight * (0.98 - e.rain * 0.3),
    );
    this.rain.visible = e.rain > 0.01 && openSky;
    Object.assign(this.stats, {
      rainLines: this.rain.visible ? 96 : 0,
      stars: this.stars.visible,
      sun: this.sun.visible,
      moon: this.moon.visible,
    });
    if (this.rain.visible) {
      for (let i = 0; i < 96; i++) {
        const x = (((i * 37) % 97) / 97) * 20 - 10,
          z = (((i * 53) % 101) / 101) * 20 - 10;
        const y = 12 - ((e.seconds * 12 + i * 0.733) % 16);
        this.rainPositions.set(
          [x, y, z, x - e.wind[0] * 0.15, y + 0.65, z - e.wind[1] * 0.15],
          i * 6,
        );
      }
      this.rain.position.copy(p);
      this.rain.geometry.getAttribute('position').needsUpdate = true;
      this.rain.material.opacity = e.rain * (0.2 + e.daylight * 0.35);
    }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    Object.assign(this.stats, { rainLines: 0, stars: false, clouds: 0, sun: false, moon: false });
    this.group.removeFromParent();
    for (const object of [this.sun, this.moon, this.stars, this.rain, this.clouds]) {
      object.geometry.dispose();
      for (const attribute of Object.keys(object.geometry.attributes))
        object.geometry.deleteAttribute(attribute);
      object.geometry.setIndex(null);
      (object.material as THREE.Material).dispose();
    }
    this.clouds.dispose();
    this.clouds.instanceMatrix = new THREE.InstancedBufferAttribute(new Float32Array(0), 16);
    this.rainPositions = new Float32Array(0);
    this.rain.geometry.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    this.group.clear();
  }
}
