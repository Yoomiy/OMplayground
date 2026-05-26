import { resolveMovementPerks, healthWalkMultiplier } from "@playground/voxel-content";

export const VOXEL_MOVEMENT = {
  /** MC walk ~4.3 m/s in noa units (default noa maxSpeed 10 is far too fast). */
  baseMaxSpeed: 4.3,
  /** MC sprint uses ~1.3× walk; applied via maxSpeed multiplier while sprint key held. */
  sprintSpeedMultiplier: 1.3,
  /** MC standard jump ~1.25 blocks (noa player: mass 1, g=-10, gravityMultiplier 2 → g_eff=20). */
  baseJumpForce: 6,
  /** impulse 6 ≈ 1.08 blocks; 6.5 ≈ 1.25 blocks with 180ms hold at force 6 */
  baseJumpImpulse: 6.5,
  /** Shorter hold window — MC is mostly a single impulse, not a long boost. */
  baseJumpTimeMs: 180,
  sprintMinHealth: 10,
  eatingSpeedMultiplier: 0.3,
  ladderClimbSpeed: 3.1,
  ladderSlideSpeed: -0.35,
  walkStrideMs: 380,
  fastStrideMs: 260,
  /** ~90% of healthy sprint horizontal speed (4.3 * 1.3 * 0.9). */
  fastStrideSpeed: 5.0
} as const;

export interface VoxelMovementState {
  readonly equipmentSlots: readonly { itemId: number; count: number }[];
  readonly eating: boolean;
  readonly sprintRequested: boolean;
  readonly health: number;
  readonly gameMode: "creative" | "survival";
}

export interface ResolvedVoxelMovement {
  readonly maxSpeed: number;
  readonly jumpForce: number;
  readonly jumpImpulse: number;
  readonly jumpTimeMs: number;
  readonly canSprint: boolean;
}

/** Peak jump height (blocks) for noa player defaults: mass 1, |g|×gravityMultiplier = 20. */
export function estimatePeakJumpBlocks(
  jumpImpulse: number,
  jumpForce: number,
  jumpTimeMs: number,
  tickRate = 30
): number {
  const g = 20;
  const dt = 1 / tickRate;
  let v = 0;
  let y = 0;
  let maxY = 0;
  let holdRemaining = jumpTimeMs;
  for (let frame = 0; frame < 120; frame++) {
    const holding = holdRemaining > 0;
    const accelY = (holding ? jumpForce : 0) - g;
    v += (frame === 0 ? jumpImpulse : 0) + accelY * dt;
    y += v * dt;
    if (holding) holdRemaining -= 1000 * dt;
    if (y > maxY) maxY = y;
    if (y <= 0 && frame > 2) break;
  }
  return maxY;
}

export function resolveVoxelMovement(
  state: VoxelMovementState
): ResolvedVoxelMovement {
  if (state.gameMode === "creative") {
    return {
      maxSpeed: VOXEL_MOVEMENT.baseMaxSpeed,
      jumpForce: VOXEL_MOVEMENT.baseJumpForce,
      jumpImpulse: VOXEL_MOVEMENT.baseJumpImpulse,
      jumpTimeMs: VOXEL_MOVEMENT.baseJumpTimeMs,
      canSprint: state.sprintRequested
    };
  }

  const perks = resolveMovementPerks(state.equipmentSlots);
  const healthMult = healthWalkMultiplier(state.health);
  const eatMult = state.eating ? VOXEL_MOVEMENT.eatingSpeedMultiplier : 1.0;

  const maxSpeed = VOXEL_MOVEMENT.baseMaxSpeed * perks.speedMult * healthMult * eatMult;
  const jumpForce = VOXEL_MOVEMENT.baseJumpForce * perks.jumpMult;
  const jumpImpulse = VOXEL_MOVEMENT.baseJumpImpulse * perks.jumpMult;
  const canSprint = state.health >= VOXEL_MOVEMENT.sprintMinHealth && !state.eating;

  return {
    maxSpeed,
    jumpForce,
    jumpImpulse,
    jumpTimeMs: VOXEL_MOVEMENT.baseJumpTimeMs,
    canSprint
  };
}
