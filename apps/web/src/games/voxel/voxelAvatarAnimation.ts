import type { Mesh } from "@babylonjs/core/Meshes/mesh";

/**
 * Walk / head-pitch / yaw-smoothing helpers, ported from voxelsrv
 * `updateAnimationOfModel` in src/lib/gameplay/connect.ts.
 *
 * Pure Babylon-side state — does not know about `noa` or sockets. Callers
 * (e.g. MinecraftClient) own when to feed positions / pitch / yaw.
 */

/** Voxel JSON bone names are namespaced with this prefix (see voxelJsonModel). */
const BONE_PREFIX = "voxelbone:";

/** Bones this animator drives. Unknown bones in the model are simply ignored. */
const BONE_NAMES = {
  head: "head",
  headwear: "headwear",
  leftArm: "left_arm",
  rightArm: "right_arm",
  leftLeg: "left_leg",
  rightLeg: "right_leg"
} as const;

export interface AvatarRig {
  root: Mesh;
  bones: Partial<Record<keyof typeof BONE_NAMES, Mesh>>;
  /** voxelsrv `model.x` — walk-cycle phase. */
  phase: number;
  /** voxelsrv `model.y` — last step delta used for phase decay sign. */
  stepSize: number;
  /** voxelsrv `model.z` — direction the phase should decay toward zero. */
  decayDir: boolean;
  prevX: number;
  prevZ: number;
  hasPrev: boolean;
  /** Smoothed yaw last applied to `root.rotation.y`. */
  smoothedYaw: number;
}

function findBone(root: Mesh, boneName: string): Mesh | undefined {
  const fullName = `${BONE_PREFIX}${boneName}`;
  for (const child of root.getChildMeshes(false)) {
    if (child.name === fullName || child.name.endsWith(fullName)) {
      return child as Mesh;
    }
  }
  return undefined;
}

export function createAvatarRig(root: Mesh): AvatarRig {
  const bones: AvatarRig["bones"] = {};
  for (const key of Object.keys(BONE_NAMES) as Array<keyof typeof BONE_NAMES>) {
    const m = findBone(root, BONE_NAMES[key]);
    if (m) bones[key] = m;
  }
  return {
    root,
    bones,
    phase: 0,
    stepSize: 0,
    decayDir: false,
    prevX: 0,
    prevZ: 0,
    hasPrev: false,
    smoothedYaw: root.rotation?.y ?? 0
  };
}

/**
 * Advance walk-cycle phase from XZ position delta and apply arm/leg rotations.
 * Ported from voxelsrv (`updateAnimationOfModel`): phase grows with distance
 * while moving, decays to 0 while idle. Head pitch is NOT touched here —
 * call `setAvatarHeadPitch` after.
 *
 * `stepsPerMeter` controls cycle frequency. voxelsrv used `dist/5` (≈0.2 rad/m,
 * so a full step cycle took ~31 m of walking — far too slow). Default 2.5 rad/m
 * gives ~1 Hz sin cycle at MC sprint speed (~5.6 m/s), feeling lively without
 * looking like a blur. `idleDecayPerCall` is the per-update phase decay back to
 * 0; threshold is intentionally tiny so slow walks don't get stuck idle.
 */
export function updateAvatarWalk(
  rig: AvatarRig,
  x: number,
  z: number,
  movingThreshold = 0.001,
  stepsPerMeter = 2.5,
  idleDecayPerCall = 0.05
): void {
  if (!rig.hasPrev) {
    rig.prevX = x;
    rig.prevZ = z;
    rig.hasPrev = true;
  }
  const dx = x - rig.prevX;
  const dz = z - rig.prevZ;
  const dist = Math.sqrt(dx * dx + dz * dz);
  rig.prevX = x;
  rig.prevZ = z;

  let sin = Math.sin(rig.phase);
  if (dist > movingThreshold) {
    rig.stepSize = dist * stepsPerMeter;
    rig.phase += rig.stepSize;
    if (Math.abs(sin) > 0.95) rig.decayDir = true;
    else if (Math.abs(sin) < 0.05) rig.decayDir = false;
  } else {
    const sin1 = Number(sin.toFixed(1));
    if (sin1 !== 0 && !rig.decayDir) rig.phase -= idleDecayPerCall;
    if (sin1 !== 0 && rig.decayDir) rig.phase += idleDecayPerCall;
  }
  sin = Math.sin(rig.phase);

  if (rig.bones.leftArm) rig.bones.leftArm.rotation.x = -sin;
  if (rig.bones.rightArm) rig.bones.rightArm.rotation.x = sin;
  if (rig.bones.rightLeg) rig.bones.rightLeg.rotation.x = -sin;
  if (rig.bones.leftLeg) rig.bones.leftLeg.rotation.x = sin;
}

export function setAvatarHeadPitch(rig: AvatarRig, pitch: number): void {
  if (rig.bones.head) rig.bones.head.rotation.x = pitch;
  if (rig.bones.headwear) rig.bones.headwear.rotation.x = pitch;
}

/** Snap yaw with no smoothing. Use for local player (already smooth). */
export function setAvatarYaw(rig: AvatarRig, yaw: number): void {
  rig.root.rotation.y = yaw;
  rig.smoothedYaw = yaw;
}

/**
 * Smooth yaw toward target with PI-wrap awareness. Use for remote players
 * whose heading arrives at the snapshot rate (~15 Hz) so motion is fluid.
 */
export function setAvatarYawSmoothed(
  rig: AvatarRig,
  targetYaw: number,
  alpha = 0.5
): void {
  let delta = targetYaw - rig.smoothedYaw;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  rig.smoothedYaw += delta * alpha;
  rig.root.rotation.y = rig.smoothedYaw;
}
