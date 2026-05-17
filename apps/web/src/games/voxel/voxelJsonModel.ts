import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Vector3, Vector4 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Scene } from "@babylonjs/core/scene";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";

/** Bedrock / voxelsrv-style model JSON (geometry subset only). */
export type VoxelModelBoneJson = {
  name: string;
  pivot?: [number, number, number];
  cubes: Array<{
    origin: [number, number, number];
    size: [number, number, number];
    uv: [number, number];
    inflate?: number;
  }>;
};

export type VoxelModelGeometryJson = {
  texturewidth: number;
  textureheight: number;
  bones: VoxelModelBoneJson[];
};

export type VoxelModelFileJson = {
  geometry: VoxelModelGeometryJson;
};

const MODEL_SCALE = 0.06;

/** Child merged meshes are named `${PREFIX}${boneName}` — used when applying skins (stable vs voxelsrv name.substr). */
const VOXEL_BONE_NAME_PREFIX = "voxelbone:";

const templateRoots = new Map<string, Mesh>();

function assertGeometry(model: unknown): VoxelModelGeometryJson {
  const m = model as VoxelModelFileJson;
  if (!m?.geometry?.bones || !Array.isArray(m.geometry.bones)) {
    throw new Error("voxel model: missing geometry.bones");
  }
  const tw = m.geometry.texturewidth;
  const th = m.geometry.textureheight;
  if (!Number.isFinite(tw) || !Number.isFinite(th) || tw <= 0 || th <= 0) {
    throw new Error("voxel model: invalid texture size");
  }
  return m.geometry;
}

/**
 * Builds a disposable template root (not added to the scene). Cached by `modelId`.
 * Hierarchical like voxelsrv `createTemplateModel`: empty root + per-bone merged meshes
 * parented under it with pivot matrices (no baking) so limbs can animate later.
 *
 * Callers must register bone meshes with `noa.rendering.addMeshToScene` — see
 * `registerVoxelChildMeshesInNoa` — because noa only renders meshes in its octree list.
 */
export function buildTemplateFromJson(
  scene: Scene,
  modelId: string,
  modelJson: unknown
): Mesh {
  const existing = templateRoots.get(modelId);
  if (existing) {
    if (!existing.isDisposed()) return existing;
    templateRoots.delete(modelId);
  }

  const geom = assertGeometry(modelJson);
  const txtSize: [number, number] = [geom.texturewidth, geom.textureheight];

  const placeholderMat = new StandardMaterial(`${modelId}-tpl-ph`, scene);
  placeholderMat.specularColor = Color3.Black();
  placeholderMat.diffuseColor = new Color3(1, 1, 1);

  const main = new Mesh(`${modelId}-template-root`, scene);

  for (const mdata of geom.bones) {
    const box = mdata.cubes;
    const part: Mesh[] = [];
    const pivot = mdata.pivot ?? [0, 0, 0];

    for (let y = 0; y < box.length; y++) {
      const add = box[y].inflate ?? 0;

      const faceUV: Vector4[] = new Array(6);
      const size = box[y].size;
      const pos = box[y].origin;
      const off = box[y].uv;

      faceUV[0] = new Vector4(
        (off[0] + size[2]) / txtSize[0],
        (txtSize[1] - size[1] - size[2] - off[1]) / txtSize[1],
        (size[2] + size[0] + off[0]) / txtSize[0],
        (txtSize[1] - size[2] - off[1]) / txtSize[1]
      );
      faceUV[1] = new Vector4(
        (off[0] + size[2] * 2 + size[0]) / txtSize[0],
        (txtSize[1] - size[1] - size[2] - off[1]) / txtSize[1],
        (size[2] * 2 + size[0] * 2 + off[0]) / txtSize[0],
        (txtSize[1] - size[2] - off[1]) / txtSize[1]
      );
      faceUV[2] = new Vector4(
        off[0] / txtSize[0],
        (txtSize[1] - size[1] - size[2] - off[1]) / txtSize[1],
        (off[0] + size[2]) / txtSize[0],
        (txtSize[1] - size[2] - off[1]) / txtSize[1]
      );
      faceUV[3] = new Vector4(
        (off[0] + size[2] + size[0]) / txtSize[0],
        (txtSize[1] - size[1] - size[2] - off[1]) / txtSize[1],
        (size[2] + size[0] * 2 + off[0]) / txtSize[0],
        (txtSize[1] - size[2] - off[1]) / txtSize[1]
      );
      faceUV[4] = new Vector4(
        (size[0] + size[2] + off[0]) / txtSize[0],
        (txtSize[1] - size[2] - off[1]) / txtSize[1],
        (off[0] + size[2]) / txtSize[0],
        (txtSize[1] - off[1]) / txtSize[1]
      );
      faceUV[5] = new Vector4(
        (size[0] * 2 + size[2] + off[0]) / txtSize[0],
        (txtSize[1] - size[2] - off[1]) / txtSize[1],
        (off[0] + size[2] + size[0]) / txtSize[0],
        (txtSize[1] - off[1]) / txtSize[1]
      );

      const brick = MeshBuilder.CreateBox(
        `part-${mdata.name}-${y}`,
        {
          height: (size[1] + add) * MODEL_SCALE,
          width: (size[0] + add) * MODEL_SCALE,
          depth: (size[2] + add) * MODEL_SCALE,
          faceUV,
          wrap: true
        },
        scene
      );

      brick.position = new Vector3(
        -(pos[0] + (size[0] - add / 2) / 2) * MODEL_SCALE,
        (pos[1] + (size[1] - add / 2) / 2) * MODEL_SCALE,
        (pos[2] + (size[2] - add / 2) / 2) * MODEL_SCALE
      );
      brick.material = placeholderMat;
      part.push(brick);
    }

    if (part.length === 0) continue;
    const merged = Mesh.MergeMeshes(part, true, true, undefined, true, true);
    if (!merged) continue;
    merged.name = `${VOXEL_BONE_NAME_PREFIX}${mdata.name}`;
    merged.setParent(main);
    merged.setPivotMatrix(
      Matrix.Translation(-pivot[0] * MODEL_SCALE, -pivot[1] * MODEL_SCALE, -pivot[2] * MODEL_SCALE)
    );
  }

  main.setEnabled(false);
  templateRoots.set(modelId, main);
  return main;
}

export async function preloadVoxelTemplate(
  scene: Scene,
  modelId: string,
  modelUrl: string
): Promise<void> {
  const res = await fetch(modelUrl);
  if (!res.ok) throw new Error(`voxel model fetch failed: ${modelUrl} ${res.status}`);
  const json: unknown = await res.json();
  buildTemplateFromJson(scene, modelId, json);
}

/** `doNotCloneChildren` must be false so bone meshes are duplicated. */
export function cloneVoxelTemplate(modelId: string, instanceName: string): Mesh {
  const tpl = templateRoots.get(modelId);
  if (!tpl || tpl.isDisposed()) {
    throw new Error(`voxel model: no template for ${modelId}`);
  }
  const clone = tpl.clone(instanceName, null, false);
  if (!clone) throw new Error("voxel model: clone failed");
  clone.setEnabled(true);
  return clone;
}

export function applyTextureToVoxelRoot(scene: Scene, root: Mesh, textureUrl: string): void {
  const tex = new Texture(textureUrl, scene, true, true, Texture.NEAREST_SAMPLINGMODE);
  tex.hasAlpha = true;
  const mat = new StandardMaterial(`voxel-skin-${root.name}`, scene);
  mat.diffuseTexture = tex;
  mat.specularColor = Color3.Black();
  mat.ambientColor = new Color3(1, 1, 1);

  const stacks: Mesh[] = [root];
  while (stacks.length) {
    const m = stacks.pop()!;
    const children = m.getChildMeshes(false);
    for (const c of children) stacks.push(c as Mesh);
    if (m.geometry && m.getTotalVertices() > 0) {
      m.material = mat;
    }
  }
}

export async function loadVoxelJsonModelInstance(args: {
  scene: Scene;
  modelId: string;
  modelUrl: string;
  textureUrl: string;
  instanceName: string;
}): Promise<Mesh> {
  await preloadVoxelTemplate(args.scene, args.modelId, args.modelUrl);
  const inst = cloneVoxelTemplate(args.modelId, args.instanceName);
  applyTextureToVoxelRoot(args.scene, inst, args.textureUrl);
  return inst;
}

export function discardVoxelTemplateCache(modelId?: string): void {
  if (modelId === undefined) {
    for (const m of templateRoots.values()) {
      if (!m.isDisposed()) m.dispose(true, true);
    }
    templateRoots.clear();
    return;
  }
  const root = templateRoots.get(modelId);
  if (root && !root.isDisposed()) root.dispose(true, true);
  templateRoots.delete(modelId);
}
