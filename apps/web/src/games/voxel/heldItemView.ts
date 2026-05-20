import type { Camera } from "@babylonjs/core/Cameras/camera";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";

export type HeldItemSpec =
  | { readonly kind: "empty" }
  | {
      readonly kind: "block";
      readonly id: number;
      readonly textureUrl: string;
    }
  | {
      readonly kind: "flatBlock";
      readonly id: number;
      readonly textureUrl: string;
    }
  | {
      readonly kind: "item";
      readonly id: number;
      readonly textureUrl: string;
    };

export interface HeldVisualSlot {
  readonly blockId: number;
  readonly itemId?: number;
  readonly count: number;
}

export function resolveHeldItemSpec(args: {
  readonly gameMode: "creative" | "survival";
  readonly selectedBlockId: number;
  readonly survivalSlotIndex: number;
  readonly survivalSlots: readonly HeldVisualSlot[];
  readonly blockIconById: Partial<Record<number, string>>;
  readonly itemIconById: Partial<Record<number, string>>;
  readonly flatBlockIds?: ReadonlySet<number>;
  readonly airBlockId: number;
}): HeldItemSpec {
  if (args.gameMode === "creative") {
    const textureUrl = args.blockIconById[args.selectedBlockId];
    if (!textureUrl) return { kind: "empty" };
    return {
      kind: args.flatBlockIds?.has(args.selectedBlockId) ? "flatBlock" : "block",
      id: args.selectedBlockId,
      textureUrl
    };
  }

  const slot = args.survivalSlots[args.survivalSlotIndex];
  if (!slot || slot.count <= 0) return { kind: "empty" };

  const itemId = slot.itemId ?? 0;
  if (itemId > 0) {
    const textureUrl = args.itemIconById[itemId];
    return textureUrl ? { kind: "item", id: itemId, textureUrl } : { kind: "empty" };
  }

  if (slot.blockId !== args.airBlockId) {
    const textureUrl = args.blockIconById[slot.blockId];
    if (!textureUrl) return { kind: "empty" };
    return {
      kind: args.flatBlockIds?.has(slot.blockId) ? "flatBlock" : "block",
      id: slot.blockId,
      textureUrl
    };
  }

  return { kind: "empty" };
}

function visualKey(spec: HeldItemSpec): string {
  return spec.kind === "empty" ? "empty" : `${spec.kind}:${spec.id}`;
}

export class FirstPersonHeldItemView {
  private readonly root: TransformNode;
  private readonly meshes = new Map<string, Mesh>();
  private currentKey = "empty";
  private bobPhase = 0;
  private swingProgress = 1;
  private swinging = false;
  private lastUpdateAt = performance.now();

  constructor(
    private readonly args: {
      readonly scene: Scene;
      readonly camera: Camera;
      readonly addMeshToScene: (mesh: Mesh) => void;
    }
  ) {
    this.root = new TransformNode("held-item-root", args.scene);
    this.root.parent = args.camera;
    this.root.position.set(0.34, -0.31, 0.52);
    this.root.rotation.set(0.12, -0.4, 0);

    this.createArmMesh("held-arm-sleeve", 0.16, 0.32, 0.15, new Color3(0.18, 0.28, 0.48), {
      x: 0.09,
      y: -0.08,
      z: -0.02,
      rx: 0.48,
      ry: -0.1,
      rz: -0.26
    });
    this.createArmMesh("held-arm-hand", 0.14, 0.14, 0.14, new Color3(0.72, 0.5, 0.34), {
      x: 0.06,
      y: 0.12,
      z: 0.08,
      rx: 0.48,
      ry: -0.1,
      rz: -0.26
    });

    this.root.setEnabled(false);
  }

  setActiveVisual(spec: HeldItemSpec): void {
    const key = visualKey(spec);
    if (key === this.currentKey) return;

    const previous = this.meshes.get(this.currentKey);
    if (previous) previous.setEnabled(false);

    this.currentKey = key;
    if (spec.kind === "empty") return;

    const next = this.meshes.get(key) ?? this.createHeldMesh(spec);
    next.setEnabled(true);
  }

  triggerSwing(): void {
    this.swinging = true;
    this.swingProgress = 0;
  }

  setVisible(visible: boolean): void {
    this.root.setEnabled(visible);
  }

  update(args: {
    readonly now: number;
    readonly moving: boolean;
    readonly visible: boolean;
  }): void {
    this.setVisible(args.visible);

    const dt = Math.min(0.05, Math.max(0, (args.now - this.lastUpdateAt) / 1000));
    this.lastUpdateAt = args.now;
    this.bobPhase += dt * (args.moving ? 8.8 : 2.4);

    if (this.swinging) {
      this.swingProgress = Math.min(1, this.swingProgress + dt * 4.8);
      if (this.swingProgress >= 1) {
        this.swinging = false;
      }
    }

    const bobX = Math.sin(this.bobPhase * 2) * (args.moving ? 0.015 : 0.004);
    const bobY = Math.abs(Math.cos(this.bobPhase * 2)) * (args.moving ? 0.015 : 0.004);
    const t = this.swinging ? this.swingProgress : 1;
    const theta = this.swinging ? Math.sin(Math.PI * Math.pow(t, 1.4)) * 1.1 : 0;
    const pushZ = this.swinging ? Math.sin(Math.PI * t) * 0.15 : 0;

    this.root.position.set(0.34 + bobX, -0.31 - bobY, 0.52 + pushZ);
    this.root.rotation.set(0.12 - theta * 0.58, -0.4 - theta * 0.22, theta * 0.2);
  }

  dispose(): void {
    this.root.dispose(false, true);
    this.meshes.clear();
  }

  private createArmMesh(
    name: string,
    width: number,
    height: number,
    depth: number,
    color: Color3,
    transform: { x: number; y: number; z: number; rx: number; ry: number; rz: number }
  ): Mesh {
    const mesh = MeshBuilder.CreateBox(name, { width, height, depth }, this.args.scene);
    const mat = new StandardMaterial(`${name}-mat`, this.args.scene);
    mat.diffuseColor = color;
    mat.emissiveColor = color.scale(0.22);
    mat.specularColor = Color3.Black();
    mat.disableLighting = true;
    mesh.material = mat;
    mesh.parent = this.root;
    mesh.position.set(transform.x, transform.y, transform.z);
    mesh.rotation.set(transform.rx, transform.ry, transform.rz);
    mesh.isPickable = false;
    mesh.renderingGroupId = 2;
    this.args.addMeshToScene(mesh);
    return mesh;
  }

  private createHeldMesh(spec: Exclude<HeldItemSpec, { kind: "empty" }>): Mesh {
    const mesh =
      spec.kind === "block"
        ? MeshBuilder.CreateBox(`held-${visualKey(spec)}`, { size: 0.18 }, this.args.scene)
        : MeshBuilder.CreatePlane(`held-${visualKey(spec)}`, { size: 0.36 }, this.args.scene);

    const texture = new Texture(
      spec.textureUrl,
      this.args.scene,
      true,
      false,
      Texture.NEAREST_SAMPLINGMODE
    );
    texture.hasAlpha = true;
    const mat = new StandardMaterial(`held-${visualKey(spec)}-mat`, this.args.scene);
    mat.diffuseTexture = texture;
    mat.useAlphaFromDiffuseTexture = true;
    mat.emissiveColor = new Color3(0.55, 0.55, 0.55);
    mat.specularColor = Color3.Black();
    mat.backFaceCulling = false;
    mat.disableLighting = true;
    mesh.material = mat;
    mesh.parent = this.root;
    mesh.position.set(-0.02, 0.14, 0.15);
    mesh.rotation.set(0.28, -0.48, spec.kind === "block" ? 0.34 : -0.18);
    mesh.isPickable = false;
    mesh.renderingGroupId = 2;
    mesh.setEnabled(false);
    this.args.addMeshToScene(mesh);
    this.meshes.set(visualKey(spec), mesh);
    return mesh;
  }
}
