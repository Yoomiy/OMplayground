export const VOXEL_MOVEMENT = {
  baseJumpForce: 12,
  heliumJumpMultiplier: 1.6,
  baseMaxSpeed: 10,
  heavyShieldSpeedMultiplier: 0.8,
  eatingSpeedMultiplier: 0.3,
  ladderClimbSpeed: 3.1,
  ladderSlideSpeed: -0.35,
  walkStrideMs: 350,
  fastStrideMs: 240,
  fastStrideSpeed: 7.5
} as const;

export interface VoxelMovementState {
  readonly heliumBoots: boolean;
  readonly heavyShield: boolean;
  readonly eating: boolean;
}

export interface ResolvedVoxelMovement {
  readonly jumpForce: number;
  readonly maxSpeed: number;
}

export function resolveVoxelMovement(
  state: VoxelMovementState
): ResolvedVoxelMovement {
  const jumpForce = state.heliumBoots
    ? VOXEL_MOVEMENT.baseJumpForce * VOXEL_MOVEMENT.heliumJumpMultiplier
    : VOXEL_MOVEMENT.baseJumpForce;
  const shieldSpeedMult = state.heavyShield
    ? VOXEL_MOVEMENT.heavyShieldSpeedMultiplier
    : 1;
  const eatingSpeedMult = state.eating ? VOXEL_MOVEMENT.eatingSpeedMultiplier : 1;
  return {
    jumpForce,
    maxSpeed: VOXEL_MOVEMENT.baseMaxSpeed * shieldSpeedMult * eatingSpeedMult
  };
}
