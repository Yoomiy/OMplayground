import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";

/**
 * Thin noa-facing helpers. Callers own `noa.entities.add` / lifecycle.
 * Mesh `onRemove` disposes the Babylon mesh when the entity is deleted.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NoaEngineLike = any;

/**
 * noa replaces Babylon scene picking/render lists with an octree: only meshes
 * passed to `noa.rendering.addMeshToScene` draw. Child meshes under the entity
 * root are not included automatically (voxelsrv registers each bone the same way).
 */
export function registerVoxelChildMeshesInNoa(noa: NoaEngineLike, root: Mesh): void {
  for (const child of root.getChildMeshes(false)) {
    noa.rendering.addMeshToScene(child as Mesh, false);
  }
}

export function attachVoxelVisualToEntity(
  noa: NoaEngineLike,
  eid: number,
  clonedRoot: Mesh,
  options: { meshOffset?: [number, number, number] }
): void {
  const meshName: string = noa.entities.names.mesh;
  const off = options.meshOffset ?? [0, 0.9, 0];
  noa.entities.addComponentAgain(eid, meshName, {
    mesh: clonedRoot,
    offset: off
  });
  registerVoxelChildMeshesInNoa(noa, clonedRoot);
}

/** Parent to local player rig when a parent mesh exists; else use `attachVoxelVisualToEntity` on the player id (noa default player has no mesh until you add one). */
export function attachVoxelVisualToPlayer(
  noa: NoaEngineLike,
  playerEntityId: number,
  clonedRoot: Mesh,
  options: { meshOffset?: [number, number, number] }
): void {
  if (noa.entities.hasMesh(playerEntityId)) {
    const parent = noa.entities.getMeshData(playerEntityId).mesh as Mesh;
    const h = noa.entities.getPositionData(playerEntityId).height;
    noa.rendering.addMeshToScene(clonedRoot, false);
    clonedRoot.setParent(parent);
    clonedRoot.position.copyFromFloats(0, -h / 2, 0);
    registerVoxelChildMeshesInNoa(noa, clonedRoot);
    return;
  }
  attachVoxelVisualToEntity(noa, playerEntityId, clonedRoot, options);
}

/** Keep rotation tuning in one place (flip sign here if avatars face backward). */
export function setVisualYaw(root: TransformNode, headingRad: number): void {
  root.rotation.y = headingRad;
}

export function setVisualVisible(root: TransformNode, visible: boolean): void {
  root.setEnabled(visible);
}

/** Use when not managed by a noa mesh component (orphan preview meshes). Entity-bound meshes are disposed by noa. */
export function disposeVisualRoot(root: Mesh | null | undefined): void {
  if (root && !root.isDisposed()) root.dispose(false, true);
}
