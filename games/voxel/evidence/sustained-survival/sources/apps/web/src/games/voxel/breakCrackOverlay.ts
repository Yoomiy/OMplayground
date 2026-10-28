import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type * as BabylonNamespace from "@babylonjs/core";
import type { Vec3 } from "@/lib/voxelProtocol";
import { BLOCK_REGISTRY } from "@playground/voxel-content";

const STAGE_COUNT = 11;
const STAGE_URLS = Array.from(
  { length: STAGE_COUNT },
  (_, i) => `/minecraft-assets/break/${i}.png`
);

export interface BreakCrackOverlay {
  setStage(pos: Vec3, stageIndex: number): void;
  clear(): void;
  dispose(): void;
}

/** In-world destroy_stage crack (10 frames) on the block being mined. */
export function createBreakCrackOverlay(
  Babylon: typeof BabylonNamespace,
  scene: Scene,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  noa: any
): BreakCrackOverlay {
  const textures: Texture[] = STAGE_URLS.map(
    (url) =>
      new Babylon.Texture(url, scene, false, true, Babylon.Texture.NEAREST_SAMPLINGMODE)
  );
  for (const t of textures) {
    t.hasAlpha = true;
  }

  let mesh: Mesh | null = null;
  let mat: StandardMaterial | null = null;
  let lastStage = -1;
  /** Scratch for `noa.globalToLocal` — mesh positions are in noa local space. */
  const localPos: [number, number, number] = [0, 0, 0];

  function setMeshLocalFromBlock(pos: Vec3): void {
    if (!mesh) return;
    const blockId = noa.getBlock(pos[0], pos[1], pos[2]);
    const isCake =
      blockId === BLOCK_REGISTRY.CAKE ||
      blockId === BLOCK_REGISTRY.CAKE_5 ||
      blockId === BLOCK_REGISTRY.CAKE_4 ||
      blockId === BLOCK_REGISTRY.CAKE_3 ||
      blockId === BLOCK_REGISTRY.CAKE_2 ||
      blockId === BLOCK_REGISTRY.CAKE_1;
    const heightOffset = isCake ? 0.25 : 0.5;

    let ratio = 1.0;
    if (blockId === BLOCK_REGISTRY.CAKE_5) ratio = 5 / 6;
    else if (blockId === BLOCK_REGISTRY.CAKE_4) ratio = 4 / 6;
    else if (blockId === BLOCK_REGISTRY.CAKE_3) ratio = 0.5;
    else if (blockId === BLOCK_REGISTRY.CAKE_2) ratio = 2 / 6;
    else if (blockId === BLOCK_REGISTRY.CAKE_1) ratio = 1 / 6;

    const xShift = isCake ? (ratio - 1) / 2 : 0;
    const globalCenter: [number, number, number] = [
      pos[0] + 0.5 + xShift,
      pos[1] + heightOffset,
      pos[2] + 0.5
    ];
    noa.globalToLocal(globalCenter, null, localPos);
    mesh.position.set(localPos[0], localPos[1], localPos[2]);
    if (isCake) {
      mesh.scaling.set(ratio, 0.5, 1);
    } else {
      mesh.scaling.set(1, 1, 1);
    }
  }

  function ensureMesh(): void {
    if (mesh) return;
    mesh = Babylon.MeshBuilder.CreateBox(
      "voxel-break-crack",
      { size: 1.002 },
      scene
    );
    mat = new Babylon.StandardMaterial("voxel-break-crack-mat", scene);
    mat.backFaceCulling = false;
    mat.alpha = 0.92;
    mat.disableLighting = true;
    mat.emissiveColor = new Babylon.Color3(1, 1, 1);
    mat.diffuseColor = new Babylon.Color3(1, 1, 1);
    mat.useAlphaFromDiffuseTexture = true;
    mesh.material = mat;
    mesh.isPickable = false;
    /** Dynamic — static octree meshes pin to the wrong chunk after world rebase. */
    noa.rendering.addMeshToScene(mesh, false);
  }

  return {
    setStage(pos: Vec3, stageIndex: number): void {
      const stage = Math.max(0, Math.min(STAGE_COUNT - 1, Math.floor(stageIndex)));
      ensureMesh();
      if (!mesh || !mat) return;
      setMeshLocalFromBlock(pos);
      if (stage !== lastStage) {
        mat.diffuseTexture = textures[stage]!;
        lastStage = stage;
      }
      mesh.setEnabled(true);
    },
    clear(): void {
      lastStage = -1;
      mesh?.setEnabled(false);
    },
    dispose(): void {
      for (const t of textures) t.dispose();
      mat?.dispose();
      mesh?.dispose();
      mesh = null;
      mat = null;
      lastStage = -1;
    }
  };
}

/** Map break progress 0..1 to destroy_stage index. */
export function destroyStageIndex(progress: number): number {
  if (progress >= 1) return STAGE_COUNT - 1;
  return Math.min(STAGE_COUNT - 1, Math.floor(progress * STAGE_COUNT));
}
