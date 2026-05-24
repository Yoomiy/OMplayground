import { describe, expect, it } from "vitest";
import { VOXEL_MOVEMENT, resolveVoxelMovement } from "./movementConfig";

describe("voxel movement config", () => {
  it("keeps base movement constants in one place", () => {
    expect(VOXEL_MOVEMENT.baseMaxSpeed).toBe(10);
    expect(VOXEL_MOVEMENT.baseJumpForce).toBe(12);
    expect(VOXEL_MOVEMENT.walkStrideMs).toBeGreaterThan(
      VOXEL_MOVEMENT.fastStrideMs
    );
  });

  it("combines equipment and eating movement modifiers", () => {
    const movement = resolveVoxelMovement({
      heliumBoots: true,
      heavyShield: true,
      eating: true
    });
    expect(movement.jumpForce).toBeCloseTo(19.2);
    expect(movement.maxSpeed).toBeCloseTo(2.4);
  });
});
