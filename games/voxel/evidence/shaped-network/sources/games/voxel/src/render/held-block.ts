import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { EngineBlock, ItemDefinition } from '../shared/content.ts';
import type { EquipmentSlot } from '../shared/inventory.ts';

/** View-model primitives use the same 1/16 extents and face-layer order as the engine. */
export function geometryFor(block: EngineBlock): THREE.BufferGeometry {
  let boxes: readonly (readonly number[])[] = [[0, 0, 0, 16, 16, 16]];
  if (block.shape === 'air') return new THREE.BufferGeometry();
  if (block.shape === 'slab') boxes = [[0, block.top ? 8 : 0, 0, 16, block.top ? 16 : 8, 16]];
  if (block.shape === 'stairs')
    boxes = [
      [0, block.top ? 8 : 0, 0, 16, block.top ? 16 : 8, 16],
      [0, block.top ? 0 : 8, 0, 16, block.top ? 8 : 16, 8],
    ];
  if (block.shape === 'torch') boxes = [[7, 0, 7, 9, 10, 9]];
  if (block.shape === 'wall_torch') boxes = [[7, 3, 14, 9, 13, 16]];
  if (block.shape === 'boxes') boxes = block.boxes ?? [];
  if (block.shape === 'fence') boxes = [[6, 0, 6, 10, 16, 10]];
  if (block.shape === 'pane') boxes = [[7, 0, 7, 9, 16, 9]];
  if (block.shape === 'post') boxes = [[6, 0, 6, 10, 16, 10]];
  const pieces: THREE.BufferGeometry[] = [];
  if (block.shape === 'cross') {
    for (const angle of [-Math.PI / 4, Math.PI / 4]) {
      const plane = new THREE.PlaneGeometry(1, 1);
      plane.setAttribute('layer', new THREE.Float32BufferAttribute(Array(4).fill(block.tex[0]), 1));
      plane.rotateY(angle);
      pieces.push(plane);
    }
  } else
    for (const box of boxes) {
      const geo = new THREE.BoxGeometry(
        (box[3] - box[0]) / 16,
        (box[4] - box[1]) / 16,
        (box[5] - box[2]) / 16,
      );
      geo.translate(
        (box[0] + box[3]) / 32 - 0.5,
        (box[1] + box[4]) / 32 - 0.5,
        (box[2] + box[5]) / 32 - 0.5,
      );
      const position = geo.getAttribute('position'),
        normal = geo.getAttribute('normal'),
        uv = geo.getAttribute('uv');
      const layers = new Float32Array(position.count);
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i) + 0.5,
          y = position.getY(i) + 0.5,
          z = position.getZ(i) + 0.5;
        const nx = normal.getX(i),
          ny = normal.getY(i),
          nz = normal.getZ(i);
        const face = nx > 0 ? 0 : nx < 0 ? 1 : ny > 0 ? 2 : ny < 0 ? 3 : nz > 0 ? 4 : 5;
        uv.setXY(
          i,
          nx ? (nx > 0 ? 1 - z : z) : nz ? (nz > 0 ? x : 1 - x) : x,
          ny ? (ny > 0 ? 1 - z : z) : y,
        );
        layers[i] = block.tex[face];
      }
      geo.setAttribute('layer', new THREE.BufferAttribute(layers, 1));
      pieces.push(geo);
    }
  if (!pieces.length) return new THREE.BufferGeometry();
  const geometry = mergeGeometries(pieces, false);
  for (const piece of pieces) piece.dispose();
  if (!geometry) throw new Error('invalid held block geometry');
  geometry.rotateY((-(block.turn ?? block.facing ?? 0) * Math.PI) / 2);
  return geometry;
}
const vertex = `precision highp float; in vec3 position,normal;in vec2 uv;in float layer;
#ifdef INSTANCED_ITEMS
in mat4 instanceMatrix;
#endif
uniform mat4 modelViewMatrix,projectionMatrix;uniform mat3 normalMatrix;out vec2 vUV;out float vLayer,vShade;
void main(){vec4 p=vec4(position,1.);vec3 n=normal;
#ifdef INSTANCED_ITEMS
p=instanceMatrix*p;n=mat3(instanceMatrix)*n;
#endif
vUV=uv;vLayer=layer;vShade=.45+.55*max(dot(normalize(normalMatrix*n),normalize(vec3(.4,.8,1.))),0.);gl_Position=projectionMatrix*modelViewMatrix*p;}`;
const fragment = `precision highp float;precision highp sampler2DArray;in vec2 vUV;in float vLayer,vShade;
uniform sampler2DArray uAlbedo,uMaterial;uniform float uLight,uCutout,uTint,uAlpha;uniform vec3 uColor;out vec4 fragColor;
void main(){vec2 uv=clamp(vec2(vUV.x,1.-vUV.y),vec2(.001),vec2(.999));vec4 a=texture(uAlbedo,vec3(uv,vLayer));
if(uCutout>.5&&a.a<.4)discard;vec3 color=a.rgb;if(uTint>1.5)color*=vec3(.46,.7,.3);else if(uTint>.5)color=mix(color,color*vec3(.46,.7,.3),1.-a.a);
color*=uLight*vShade*uColor;color+=a.rgb*texture(uMaterial,vec3(uv,vLayer)).a*2.;color=pow(color/(color+vec3(1.)),vec3(1./2.2));fragColor=vec4(color,uAlpha);}`;

export function itemGeometry(
  item: ItemDefinition,
  blocks: readonly EngineBlock[],
  wornSlot?: EquipmentSlot,
): THREE.BufferGeometry {
  const placed = item.places && blocks.find((b) => b.name === item.places && b.placeable !== false);
  if (placed && item.model !== 'bucket') return geometryFor(placed);
  const wood = blocks.find((b) => b.name === 'oak_planks') ?? blocks[1],
    stone = blocks.find((b) => b.name === 'stone') ?? wood,
    authored = item.material ? blocks.find((block) => block.name === item.material) : undefined;
  const part = (boxes: number[][], material: EngineBlock) =>
    geometryFor({ ...material, shape: 'boxes', boxes, turn: 0, facing: 0 });
  const forms: Partial<Record<NonNullable<ItemDefinition['model']>, number[][]>> = {
    bucket: [
      [3, 2, 3, 13, 4, 13],
      [2, 4, 2, 4, 12, 14],
      [12, 4, 2, 14, 12, 14],
      [4, 4, 2, 12, 12, 4],
      [4, 4, 12, 12, 12, 14],
      [2, 12, 7, 4, 16, 9],
      [12, 12, 7, 14, 16, 9],
      [4, 14, 7, 12, 16, 9],
    ],
    ingot: [[3, 5, 5, 13, 10, 11]],
    gem: [
      [5, 3, 5, 11, 13, 11],
      [3, 5, 6, 13, 11, 10],
      [6, 5, 3, 10, 11, 13],
    ],
    fiber: [
      [3, 2, 6, 13, 4, 8],
      [4, 6, 7, 12, 8, 9],
      [3, 10, 6, 13, 12, 8],
    ],
    grain: [
      [3, 1, 6, 5, 14, 8],
      [7, 0, 7, 9, 15, 9],
      [11, 2, 6, 13, 14, 8],
      [2, 11, 5, 6, 15, 9],
      [6, 12, 6, 10, 16, 10],
      [10, 10, 5, 14, 14, 9],
    ],
    loaf: [
      [2, 3, 4, 14, 9, 12],
      [4, 9, 5, 12, 12, 11],
    ],
    cookie: [
      [3, 4, 3, 13, 7, 13],
      [5, 4, 2, 11, 7, 14],
    ],
    melon: [
      [2, 3, 6, 14, 7, 10],
      [4, 7, 6, 12, 10, 10],
      [6, 10, 6, 10, 12, 10],
    ],
    carrot: [
      [6, 1, 6, 10, 6, 10],
      [5, 6, 5, 11, 11, 11],
      [4, 11, 4, 12, 14, 12],
      [7, 14, 7, 9, 16, 9],
    ],
    potato: [
      [3, 4, 4, 13, 11, 12],
      [5, 3, 5, 11, 12, 11],
    ],
    cake: [
      [2, 2, 2, 14, 9, 14],
      [1, 9, 1, 15, 11, 15],
      [5, 11, 5, 7, 13, 7],
      [10, 11, 9, 12, 13, 11],
    ],
    sheet: [[2, 7, 2, 14, 8, 14]],
    armor: [
      [1, 3, 6, 15, 14, 9],
      [1, 12, 6, 4, 16, 12],
      [12, 12, 6, 15, 16, 12],
    ],
  };
  if (item.model === 'bucket' && item.remainder && placed) {
    const shell = part(forms.bucket!, authored ?? stone),
      water = part([[4, 4, 4, 12, 10, 12]], placed),
      combined = mergeGeometries([shell, water], false)!;
    shell.dispose();
    water.dispose();
    return combined;
  }
  if (item.model && forms[item.model]) return part(forms[item.model]!, authored ?? wood);
  if (item.model === 'talisman' || item.model === 'medallion')
    return part(
      item.model === 'medallion'
        ? [
            [5, 5, 6, 11, 11, 9],
            [7, 11, 7, 9, 15, 8],
          ]
        : [
            [7, 2, 6, 9, 12, 9],
            [4, 4, 6, 7, 10, 9],
            [9, 6, 6, 12, 12, 9],
          ],
      item.perks?.vision
        ? (blocks.find((b) => b.name === 'glowstone') ?? stone)
        : item.perks?.sunRegen
          ? (blocks.find((b) => b.name === 'sand') ?? stone)
          : (blocks.find((b) => b.name === 'oak_leaves') ?? wood),
    );
  if (item.model === 'powder')
    return part(
      [
        [3, 0, 3, 13, 4, 13],
        [5, 4, 5, 11, 7, 11],
      ],
      authored ?? {
        ...stone,
        tex: Array(6).fill(blocks.find((b) => b.name === 'bedrock')?.tex[0] ?? stone.tex[0]),
      },
    );
  if (item.model === 'igniter')
    return part(
      [
        [3, 3, 6, 7, 12, 10],
        [9, 2, 6, 13, 9, 10],
      ],
      stone,
    );
  if (item.model === 'shield')
    return part(
      [
        [2, 1, 6, 14, 16, 9],
        [4, 0, 6, 12, 3, 9],
        [6, 5, 9, 10, 12, 12],
      ],
      wood,
    );
  if (item.model === 'apple')
    return part(
      [
        [4, 3, 4, 12, 11, 12],
        [7, 11, 7, 9, 14, 9],
      ],
      blocks.find((b) => b.name === 'oak_log') ?? wood,
    );
  if (item.model === 'boots')
    return part(
      wornSlot === 'feet'
        ? [
            [5, 0, 2, 11, 5, 13],
            [5, 5, 6, 11, 10, 13],
          ]
        : [
            [2, 0, 2, 6, 5, 13],
            [10, 0, 2, 14, 5, 13],
            [2, 5, 6, 6, 10, 13],
            [10, 5, 6, 14, 10, 13],
          ],
      item.modifiers?.jump ? (blocks.find((b) => b.name === 'glass') ?? stone) : wood,
    );
  const handle = part([[7, 0, 7, 9, 13, 9]], wood);
  if (item.model === 'stick') return handle;
  const head =
    item.model === 'pickaxe'
      ? [
          [2, 12, 7, 14, 14, 9],
          [1, 10, 7, 3, 13, 9],
          [13, 10, 7, 15, 13, 9],
        ]
      : item.model === 'axe'
        ? [[5, 10, 6, 12, 15, 10]]
        : [[5, 11, 6, 11, 16, 10]];
  const blade = part(
      head,
      authored ??
        (item.activation === 'held'
          ? (blocks.find((b) => b.name === 'sand') ?? stone)
          : (item.tool?.tier ?? 1) >= 2
            ? stone
            : wood),
    ),
    merged = mergeGeometries([handle, blade], false);
  handle.dispose();
  blade.dispose();
  if (!merged) throw new Error('invalid item model');
  return merged;
}
export function itemMaterial(
  albedo: THREE.Texture,
  material: THREE.Texture,
  instanced = false,
): THREE.RawShaderMaterial {
  return new THREE.RawShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    glslVersion: THREE.GLSL3,
    defines: instanced ? { INSTANCED_ITEMS: 1 } : {},
    side: THREE.DoubleSide,
    uniforms: {
      uAlbedo: { value: albedo },
      uMaterial: { value: material },
      uLight: { value: 1 },
      uCutout: { value: 0 },
      uTint: { value: 0 },
      uAlpha: { value: 1 },
      uColor: { value: new THREE.Vector3(1, 1, 1) },
    },
  });
}

/** Shared world-item styling for dropped and avatar-attached models. Textures remain caller-owned. */
export function worldItemMaterial(
  item: ItemDefinition,
  blocks: readonly EngineBlock[],
  albedo: THREE.Texture,
  surface: THREE.Texture,
): THREE.RawShaderMaterial {
  const material = itemMaterial(albedo, surface, true);
  const block = blocks.find((block) =>
    item.model === 'bucket'
      ? block.name === item.material
      : block.name === item.places && block.placeable !== false,
  );
  material.uniforms.uCutout.value = block?.layer === 1 ? 1 : 0;
  material.uniforms.uTint.value = block?.tint ? (block.layer === 1 ? 2 : 1) : 0;
  material.transparent = block?.layer === 2;
  material.depthWrite = block?.layer !== 2;
  material.uniforms.uAlpha.value = block?.layer === 2 ? 0.65 : 1;
  material.uniforms.uColor.value.set(
    ...(item.color ??
      (item.model === 'apple' ? ([1.5, 0.15, 0.1] as const) : ([1, 1, 1] as const))),
  );
  return material;
}

export class HeldBlockRenderer {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(55, 1, 0.01, 4);
  private grip = new THREE.Group();
  private hand = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.45, 0.16),
    new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(0.76, 0.54, 0.35) }),
  );
  private sleeve = new THREE.Mesh(
    new THREE.BoxGeometry(0.17, 0.22, 0.17),
    new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(0.15, 0.33, 0.4) }),
  );
  private block: THREE.Mesh<THREE.BufferGeometry, THREE.RawShaderMaterial>;
  private state = -1;
  private itemType: string | null = null;
  private swingAt = -Infinity;
  private disposed = false;
  readonly stats = { state: -1, itemType: null as string | null, visible: false, swings: 0 };
  private blocks: readonly EngineBlock[];
  private items: readonly ItemDefinition[];
  constructor(
    blocks: readonly EngineBlock[],
    items: readonly ItemDefinition[],
    albedo: THREE.Texture,
    material: THREE.Texture,
  ) {
    this.blocks = blocks;
    this.items = items;
    this.block = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.RawShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        glslVersion: THREE.GLSL3,
        side: THREE.DoubleSide,
        uniforms: {
          uAlbedo: { value: albedo },
          uMaterial: { value: material },
          uLight: { value: 1 },
          uCutout: { value: 0 },
          uTint: { value: 0 },
          uAlpha: { value: 1 },
          uColor: { value: new THREE.Vector3(1, 1, 1) },
        },
      }),
    );
    this.hand.position.set(0, -0.22, 0.08);
    this.sleeve.position.set(0, -0.38, 0.09);
    this.block.scale.setScalar(0.28);
    this.block.position.set(0, 0.04, -0.06);
    this.grip.add(this.hand, this.sleeve, this.block);
    this.scene.add(this.grip);
  }
  swing(now: number): void {
    this.swingAt = now;
    this.stats.swings++;
  }
  clear(): void {
    this.swingAt = -Infinity;
    this.stats.visible = false;
  }
  draw(
    renderer: THREE.WebGLRenderer,
    aspect: number,
    state: number,
    speed: number,
    now: number,
    light: number,
    visible: boolean,
    itemType: string | null,
  ): boolean {
    if (this.disposed) return false;
    this.stats.visible = visible;
    if (!visible) return false;
    const item = this.items.find((item) => item.itemType === itemType);
    const definition =
      (item?.model === 'bucket' && this.blocks.find((block) => block.name === item.material)) ||
      (item?.places &&
        this.blocks.find((block) => block.name === item.places && block.placeable !== false)) ||
      this.blocks[state];
    if (definition && (state !== this.state || itemType !== this.itemType)) {
      this.block.geometry.dispose();
      this.block.geometry = item ? itemGeometry(item, this.blocks) : geometryFor(definition);
      this.state = this.stats.state = state;
      this.itemType = this.stats.itemType = itemType;
      this.block.material.uniforms.uColor.value.set(
        ...(item?.color ?? (item?.model === 'apple' ? [1.5, 0.15, 0.1] : [1, 1, 1])),
      );
      this.block.material.uniforms.uCutout.value = definition.layer === 1 ? 1 : 0;
      this.block.material.uniforms.uTint.value = definition.tint
        ? definition.layer === 1
          ? 2
          : 1
        : 0;
      this.block.material.uniforms.uAlpha.value = definition.layer === 2 ? 0.65 : 1;
      this.block.material.transparent = definition.layer === 2;
      this.block.material.needsUpdate = true;
    }
    this.block.visible = !!item || (!!definition && definition.shape !== 'air');
    this.block.material.uniforms.uLight.value = 0.2 + light * 0.8;
    const t = Math.max(0, (now - this.swingAt) / 260),
      swing = t < 1 ? Math.sin(t * Math.PI) : 0;
    const bob = Math.min(1, speed / 4) * Math.sin(now / 95);
    const bucket = item?.model === 'bucket';
    // The fixed vertical FOV gives portrait viewports less horizontal room.
    // Keep the hand beside the reticle instead of cropping the item off-screen.
    const widthScale = Math.min(1, aspect / (4 / 3));
    this.grip.scale.setScalar(Math.max(0.65, widthScale));
    this.grip.position.set(
      (0.34 - swing * 0.1) * widthScale - (1 - widthScale) * 0.1,
      -0.29 + bob * 0.012 - swing * 0.07,
      -0.7 + swing * (bucket ? 0.06 : 0.18),
    );
    // Show the contents above the near rim even while the bucket is at rest.
    const tilt = bucket ? 0.4 + swing * 0.15 : -0.15 + swing * 0.8;
    this.grip.rotation.set(tilt, 0.35 - swing * 0.2, -0.1);
    this.hand.material.color.setRGB(0.76, 0.54, 0.35).multiplyScalar(0.2 + light * 0.8);
    this.sleeve.material.color.setRGB(0.15, 0.33, 0.4).multiplyScalar(0.2 + light * 0.8);
    if (this.camera.aspect !== aspect) {
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }
    const clear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.autoClear = clear;
    return true;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const mesh of [this.hand, this.sleeve, this.block]) {
      mesh.geometry.dispose();
      for (const name of Object.keys(mesh.geometry.attributes)) mesh.geometry.deleteAttribute(name);
      mesh.geometry.setIndex(null);
      mesh.material.dispose();
    }
    this.grip.clear();
    this.scene.clear();
    this.stats.visible = false;
    this.stats.state = -1;
  }
}
