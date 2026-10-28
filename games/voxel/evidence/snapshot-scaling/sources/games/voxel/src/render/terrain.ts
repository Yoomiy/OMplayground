import * as THREE from 'three';
import common from './shaders/common.glsl?raw';
import unpack from './shaders/vertex_unpack.glsl?raw';
import type { Culler } from '../../engine/pkg/voxel_engine.js';
import { columnKey } from '../shared/protocol.ts';
import type { Environment } from '../shared/environment.ts';
import { EnvironmentRenderer } from './environment.ts';
import { AvatarRenderer } from './avatars.ts';
import type { AvatarPose } from './avatars.ts';
import type { EngineBlock, ItemDefinition } from '../shared/content.ts';
import type { DropView } from '../shared/gameplay.ts';
import { DropRenderer } from './drops.ts';
import { ExplosiveRenderer } from './explosives.ts';
import type { ExplosiveView } from '../shared/explosives.ts';
import { HeldBlockRenderer } from './held-block.ts';
import { GpuFramePacer } from './gpu-pacing.ts';
import { EditEffects } from './edit-effects.ts';
const precision =
  'precision highp float; precision highp int; precision highp sampler2D; precision highp sampler2DArray;\n';
// Packed decoding, shape UVs, light/AO fields and animation derive from the pinned Blockyard pipeline.
const vertex =
  precision +
  common +
  unpack +
  `
uniform mat4 modelMatrix,modelViewMatrix,projectionMatrix; uniform vec3 uWorldOrigin;
out vec2 vUV; out vec3 vNormal; out vec3 vWorld; out vec4 vLight; flat out uint vLayer; flat out uint vFlags;
void main(){vec3 origin=modelMatrix[3].xyz+uWorldOrigin; Vtx v=unpackVertex(origin);vec4 view=modelViewMatrix*vec4(v.pos,1.0);gl_Position=projectionMatrix*view;vUV=v.uv;vNormal=v.normal;vWorld=origin+v.pos;vLight=vec4(v.sky,v.blk,v.ao,v.tint);vLayer=v.layer;vFlags=(v.normalIdx>=6u?1u:0u)|(v.fine?4u:0u);}`;
const fragment =
  precision +
  `
uniform sampler2DArray uAlbedo,uMaterial;uniform sampler2D uBiome;uniform vec3 uCamera,uSky,uSun;uniform float uFogEnd,uDaylight,uVision;
in vec2 vUV;in vec3 vNormal;in vec3 vWorld;in vec4 vLight;flat in uint vLayer;flat in uint vFlags;out vec4 fragColor;
void main(){vec2 dx=dFdx(vUV),dy=dFdy(vUV);vec2 uv=vec2(fract(vUV.x),1.0-fract(vUV.y));
if((vFlags&4u)!=0u){vec2 c=clamp(vUV,vec2(.001),vec2(.999));uv=vec2(c.x,1.-c.y);}
vec4 albedo=textureGrad(uAlbedo,vec3(uv,float(vLayer)),dx,dy);vec4 material=textureGrad(uMaterial,vec3(uv,float(vLayer)),dx,dy);
#ifdef CUTOUT
if(albedo.a<.45)discard;
#endif
vec3 base=albedo.rgb;if(vLight.w>.5){vec3 tint=texture(uBiome,vWorld.xz/1024.).rgb;
#ifdef CUTOUT
base*=tint;
#else
base=mix(base,base*tint,1.-albedo.a);
#endif
}
float ao=.38+.62*vLight.z*vLight.z;float sun=max(dot(normalize(vNormal),uSun),0.);
vec3 light=(vec3(.3,.4,.58)*vLight.x*vLight.x+vec3(.8,.72,.55)*sun*vLight.x)*uDaylight+vec3(1.,.62,.28)*pow(max(vLight.y,0.),2.2)*1.8+vec3(.028);
light=mix(light,max(light,vec3(.85)),uVision);
vec3 color=base*light*ao+base*material.a*2.;color=color/(color+vec3(1.));color=pow(color,vec3(1./2.2));
float fog=smoothstep(uFogEnd*.55,uFogEnd,length(vWorld.xz-uCamera.xz));color=mix(color,uSky,fog);
#ifdef TRANSLUCENT
fragColor=vec4(color,.65);
#else
fragColor=vec4(color,1.);
#endif
}`;
type ColumnMesh = {
  x: number;
  z: number;
  slot: number;
  meshes: (THREE.Mesh<THREE.BufferGeometry, THREE.Material> | null)[];
};
export class TerrainRenderer {
  readonly gl: THREE.WebGLRenderer;
  readonly camera = new THREE.PerspectiveCamera(75, 1, 0.05, 1600);
  readonly scene = new THREE.Scene();
  readonly columns = new Map<string, ColumnMesh>();
  readonly origin = new THREE.Vector3();
  private materials: THREE.RawShaderMaterial[];
  private textures: THREE.Texture[] = [];
  private biome: THREE.DataTexture;
  private tile: THREE.DataTexture;
  private tileData = new Uint8Array(1024);
  private culler: Culler;
  private memory: WebAssembly.Memory;
  private uniforms: Record<string, THREE.IUniform>;
  private highlight = new THREE.Group();
  private avatars: AvatarRenderer;
  private environment: EnvironmentRenderer;
  private sky = new THREE.Color();
  private held: HeldBlockRenderer;
  private effects: EditEffects;
  private drops: DropRenderer;
  private explosives: ExplosiveRenderer;
  private disposed = false;
  private scale: number;
  private gpu: GpuFramePacer;
  readonly stats = {
    uploadedBytes: 0,
    columns: 0,
    drawCalls: 0,
    triangles: 0,
    uploadMs: 0,
    prepareMs: 0,
  };
  /** Pay first-person shader, uniform and buffer startup costs before accepting input. */
  async prepare(state: number, signal?: AbortSignal): Promise<void> {
    const started = performance.now();
    const target = new THREE.WebGLRenderTarget(2, 2);
    target.texture.colorSpace = this.gl.outputColorSpace;
    const previous = this.gl.getRenderTarget();
    try {
      if (signal?.aborted) throw new DOMException('Renderer preparation cancelled', 'AbortError');
      if (this.disposed || !this.gpu.begin())
        throw new Error('renderer is unavailable for startup');
      this.gl.setRenderTarget(target);
      this.held.draw(this.gl, 1, state, 0, 0, 1, true, null);
      this.gl.setRenderTarget(previous);
      this.gpu.finish();
      while (!this.gpu.begin()) {
        if (signal?.aborted) throw new DOMException('Renderer preparation cancelled', 'AbortError');
        if (this.disposed || this.gl.getContext().isContextLost())
          throw new Error('graphics context lost during startup');
        if (performance.now() - started > 30000)
          throw new Error('graphics startup did not complete');
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      this.stats.prepareMs = performance.now() - started;
    } finally {
      this.gpu.reset();
      this.gl.setRenderTarget(previous);
      this.held.clear();
      target.dispose();
    }
  }
  get gpuStats() {
    return { ...this.gpu.stats };
  }
  contextLost(): void {
    this.gpu.reset();
  }
  get atmosphere() {
    return { ...this.environment.stats };
  }
  get actors() {
    return { ...this.avatars.stats, samples: this.avatars.samples, equipment: this.avatars.gear };
  }
  get feedback() {
    return {
      held: { ...this.held.stats },
      effects: { ...this.effects.stats },
      drops: { ...this.drops.stats },
      explosives: { ...this.explosives.stats },
      vision: this.uniforms.uVision?.value === 1,
    };
  }
  swing(now: number): void {
    this.held.swing(now);
  }
  resetPresentation(): void {
    this.avatars.clear();
    this.held.clear();
    this.effects.clear();
    this.drops.clear();
    this.explosives.clear();
  }
  editEffect(cell: readonly number[], state: number, now: number, removal: boolean): void {
    this.effects.burst(cell, state, now, removal);
  }
  hitEffect(position: readonly number[], now: number): void {
    this.effects.hit(position, now);
  }
  explosionEffect(position: readonly number[], radius: number, now: number): void {
    this.effects.explosion(position, radius, now);
  }
  constructor(
    canvas: HTMLCanvasElement,
    pixels: Uint8Array,
    layers: number,
    culler: Culler,
    memory: WebAssembly.Memory,
    blocks: readonly EngineBlock[],
    items: readonly ItemDefinition[],
    scale = 1,
  ) {
    this.scale = Math.max(0.5, Math.min(1.5, scale));
    this.culler = culler;
    this.memory = memory;
    this.gl = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
    const context = this.gl.getContext();
    if (!('fenceSync' in context)) throw new Error('WebGL2 GPU synchronization is required');
    this.gpu = new GpuFramePacer(context as WebGL2RenderingContext);
    this.gl.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.gl.setClearColor(0x97c2e0);
    this.gl.outputColorSpace = THREE.LinearSRGBColorSpace;
    const size = layers * 16 * 16 * 4;
    const texture = (data: Uint8Array, srgb: boolean) => {
      const t = new THREE.DataArrayTexture(data, 16, 16, layers);
      t.format = THREE.RGBAFormat;
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.generateMipmaps = true;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.needsUpdate = true;
      this.textures.push(t);
      return t;
    };
    const albedo = texture(pixels.slice(0, size), true),
      material = texture(pixels.slice(size, size * 2), false);
    const lookBytes = new Uint8Array(1024 * 4);
    for (let i = 0; i < 1024; i++) {
      lookBytes[i * 4] = i & 255;
      lookBytes[i * 4 + 1] = i >> 8;
    }
    const looks = new THREE.DataTexture(lookBytes, 1024, 1);
    looks.magFilter = looks.minFilter = THREE.NearestFilter;
    looks.needsUpdate = true;
    this.textures.push(looks);
    const colors = new Uint8Array(1024 * 1024 * 4);
    for (let i = 0; i < colors.length; i += 4) {
      colors[i] = 120;
      colors[i + 1] = 185;
      colors[i + 2] = 80;
      colors[i + 3] = 255;
    }
    this.biome = new THREE.DataTexture(colors, 1024, 1024);
    this.biome.colorSpace = THREE.SRGBColorSpace;
    this.biome.wrapS = this.biome.wrapT = THREE.RepeatWrapping;
    this.biome.magFilter = this.biome.minFilter = THREE.LinearFilter;
    this.biome.needsUpdate = true;
    this.tile = new THREE.DataTexture(this.tileData, 16, 16);
    this.tile.colorSpace = THREE.SRGBColorSpace;
    this.textures.push(this.biome, this.tile);
    this.uniforms = {
      uTime: { value: 0 },
      uWind: { value: new THREE.Vector4(0.4, 0.3, 0.5, 0) },
      uLooks: { value: looks },
      uAlbedo: { value: albedo },
      uMaterial: { value: material },
      uBiome: { value: this.biome },
      uWorldOrigin: { value: this.origin },
      uCamera: { value: new THREE.Vector3() },
      uFogEnd: { value: 43 },
      uSky: { value: new THREE.Vector3(0.59, 0.76, 0.88) },
      uSun: { value: new THREE.Vector3(0.45, 0.85, 0.3).normalize() },
      uDaylight: { value: 1 },
      uVision: { value: 0 },
    };
    this.materials = [0, 1, 2].map(
      (layer) =>
        new THREE.RawShaderMaterial({
          vertexShader: vertex,
          fragmentShader: fragment,
          uniforms: this.uniforms,
          glslVersion: THREE.GLSL3,
          defines: layer === 1 ? { CUTOUT: 1 } : layer === 2 ? { TRANSLUCENT: 1 } : {},
          side: layer === 0 ? THREE.FrontSide : THREE.DoubleSide,
          transparent: layer === 2,
          depthWrite: layer !== 2,
        }),
    );
    this.avatars = new AvatarRenderer(this.scene, blocks, items, albedo, material);
    this.scene.add(this.highlight);
    this.environment = new EnvironmentRenderer(this.scene);
    this.held = new HeldBlockRenderer(blocks, items, albedo, material);
    this.drops = new DropRenderer(this.scene, blocks, items, albedo, material);
    this.explosives = new ExplosiveRenderer(this.scene, blocks, albedo, material);
    this.effects = new EditEffects(this.scene, pixels, layers, blocks);
  }
  resize(width: number, height: number): void {
    this.gl.setSize(Math.round(width * this.scale), Math.round(height * this.scale), false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
  tint(x: number, z: number, raw: Uint8Array): void {
    const rgb = raw.subarray(8, 8 + 768);
    for (let i = 0; i < 256; i++) {
      this.tileData[i * 4] = rgb[i * 3];
      this.tileData[i * 4 + 1] = rgb[i * 3 + 1];
      this.tileData[i * 4 + 2] = rgb[i * 3 + 2];
      this.tileData[i * 4 + 3] = 255;
    }
    this.gl.copyTextureToTexture(
      this.tile,
      this.biome,
      null,
      new THREE.Vector2((((x * 16) % 1024) + 1024) % 1024, (((z * 16) % 1024) + 1024) % 1024),
    );
  }
  install(x: number, z: number, data: Uint32Array): void {
    const start = performance.now();
    if (data[79] !== 2 || data[0] !== 80 || data.length !== 80 + (data[1] + data[2] + data[3]) * 8)
      throw new Error('mesh format mismatch');
    this.remove(x, z);
    let offset = data[0];
    const meshes: ColumnMesh['meshes'] = [];
    for (let layer = 0; layer < 3; layer++) {
      const quads = data[1 + layer];
      if (!quads) {
        meshes.push(null);
        continue;
      }
      const vertices = data.subarray(offset, offset + quads * 8);
      offset += quads * 8;
      const geometry = new THREE.BufferGeometry(),
        attribute = new THREE.BufferAttribute(vertices, 2);
      attribute.gpuType = THREE.IntType;
      geometry.setAttribute('aData', attribute);
      const indices = new Uint32Array(quads * 6);
      for (let q = 0; q < quads; q++) {
        const i = q * 4,
          o = q * 6;
        indices.set([i, i + 1, i + 2, i, i + 2, i + 3], o);
      }
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      geometry.boundingBox = new THREE.Box3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(16, 256, 16),
      );
      geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(8, 128, 8), 130);
      const mesh = new THREE.Mesh(geometry, this.materials[layer]);
      mesh.frustumCulled = false;
      mesh.position.set(x * 16 - this.origin.x, 0, z * 16 - this.origin.z);
      this.scene.add(mesh);
      meshes.push(mesh);
      this.stats.uploadedBytes += vertices.byteLength + indices.byteLength;
    }
    this.columns.set(columnKey(x, z), {
      x,
      z,
      meshes,
      slot: this.culler.set_column(x, z, data.subarray(0, 80)),
    });
    this.stats.columns = this.columns.size;
    this.stats.uploadMs = performance.now() - start;
  }
  remove(x: number, z: number): void {
    const key = columnKey(x, z),
      col = this.columns.get(key);
    if (!col) return;
    for (const mesh of col.meshes)
      if (mesh) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
      }
    this.columns.delete(key);
    this.culler.remove_column(x, z);
    this.stats.columns = this.columns.size;
  }
  target(boxes: readonly (readonly number[])[], cell: readonly number[] | null): void {
    for (const child of [...this.highlight.children]) {
      this.highlight.remove(child);
      const line = child as THREE.LineSegments;
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    }
    if (!cell) return;
    for (const b of boxes) {
      const geo = new THREE.EdgesGeometry(
        new THREE.BoxGeometry(
          (b[3] - b[0]) / 16 + 0.004,
          (b[4] - b[1]) / 16 + 0.004,
          (b[5] - b[2]) / 16 + 0.004,
        ),
      );
      const line = new THREE.LineSegments(
        geo,
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }),
      );
      line.position.set(
        cell[0] + (b[0] + b[3]) / 32 - this.origin.x,
        cell[1] + (b[1] + b[4]) / 32,
        cell[2] + (b[2] + b[5]) / 32 - this.origin.z,
      );
      this.highlight.add(line);
    }
  }
  frame(
    position: readonly number[],
    yaw: number,
    pitch: number,
    remote: readonly AvatarPose[],
    now: number,
    environment: Environment,
    openSky: boolean,
    view: {
      state: number;
      speed: number;
      active: boolean;
      itemType: string | null;
      drops: readonly DropView[];
      explosives: readonly ExplosiveView[];
      vision: boolean;
    },
  ): void {
    if (this.disposed) return;
    if (!this.gpu.begin()) return;
    try {
      const ox = Math.floor(position[0] / 16) * 16,
        oz = Math.floor(position[2] / 16) * 16;
      if (ox !== this.origin.x || oz !== this.origin.z) {
        for (const child of this.highlight.children) {
          child.position.x += this.origin.x - ox;
          child.position.z += this.origin.z - oz;
        }
        this.origin.set(ox, 0, oz);
        for (const c of this.columns.values())
          for (const m of c.meshes) if (m) m.position.set(c.x * 16 - ox, 0, c.z * 16 - oz);
      }
      this.camera.position.set(position[0] - ox, position[1] + 1.62, position[2] - oz);
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.set(pitch, -yaw, 0, 'YXZ');
      this.camera.updateMatrixWorld();
      (this.uniforms.uCamera.value as THREE.Vector3).set(
        position[0],
        position[1] + 1.62,
        position[2],
      );
      this.uniforms.uTime.value = environment.seconds;
      this.uniforms.uDaylight.value = environment.daylight * (1 - environment.rain * 0.35);
      this.uniforms.uVision.value = Number(view.vision);
      this.uniforms.uFogEnd.value = 43 * (1 - environment.rain * 0.2);
      (this.uniforms.uSky.value as THREE.Vector3).set(...environment.sky);
      (this.uniforms.uSun.value as THREE.Vector3).set(...environment.sun);
      (this.uniforms.uWind.value as THREE.Vector4).set(
        environment.wind[0],
        environment.wind[1],
        0.5 + environment.rain * 0.7,
        0,
      );
      this.sky.setRGB(...environment.sky);
      this.gl.setClearColor(this.sky);
      this.environment.update(environment, this.camera, position, openSky);
      const vp = new THREE.Matrix4()
        .multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse)
        .multiply(new THREE.Matrix4().makeTranslation(-ox, 0, -oz));
      this.culler.cull(
        new Float64Array(vp.elements),
        position[0],
        position[1] + 1.62,
        position[2],
        4,
        true,
      );
      const ranges = new Uint32Array(
        this.memory.buffer,
        this.culler.out_ptr(),
        this.culler.capacity() * 6,
      );
      for (const c of this.columns.values())
        for (let layer = 0; layer < 3; layer++) {
          const mesh = c.meshes[layer];
          if (!mesh) continue;
          const at = c.slot * 6 + layer * 2;
          mesh.visible = ranges[at + 1] > 0;
          mesh.geometry.setDrawRange(ranges[at], ranges[at + 1]);
        }
      const itemLight = view.vision ? 1 : environment.daylight;
      this.avatars.update(remote, this.origin, position, environment.seconds, itemLight);
      this.effects.frame(now, this.origin, itemLight);
      this.drops.update(view.drops, this.origin, environment.seconds, itemLight);
      this.explosives.update(view.explosives, this.origin, itemLight);
      this.gl.render(this.scene, this.camera);
      const calls = this.gl.info.render.calls,
        triangles = this.gl.info.render.triangles;
      const drawn = this.held.draw(
        this.gl,
        this.camera.aspect,
        view.state,
        view.speed,
        now,
        itemLight,
        view.active,
        view.itemType,
      );
      this.stats.drawCalls = calls + (drawn ? this.gl.info.render.calls : 0);
      this.stats.triangles = triangles + (drawn ? this.gl.info.render.triangles : 0);
    } finally {
      this.gpu.finish();
    }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const c of [...this.columns.values()]) this.remove(c.x, c.z);
    this.target([], null);
    this.environment.dispose();
    this.held.dispose();
    this.drops.dispose();
    this.explosives.dispose();
    this.effects.dispose();
    this.avatars.dispose();
    for (const m of this.materials) m.dispose();
    for (const t of this.textures) {
      t.dispose();
      if (t.image && typeof t.image === 'object' && 'data' in t.image)
        t.image.data = new Uint8Array(0);
    }
    this.textures = [];
    this.materials = [];
    this.uniforms = {};
    this.scene.clear();
    this.culler.free();
    this.gpu.dispose();
    this.gl.dispose();
    this.gl.forceContextLoss();
  }
}
