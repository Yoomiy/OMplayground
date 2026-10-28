import { describe, expect, it } from "vitest";
import { VOXEL_MOVEMENT, resolveVoxelMovement, estimatePeakJumpBlocks } from "./movementConfig";
import { ITEM_REGISTRY } from "@playground/voxel-content";

describe("voxel movement config", () => {
  it("keeps base movement constants in one place", () => {
    expect(VOXEL_MOVEMENT.baseMaxSpeed).toBe(4.3);
    expect(VOXEL_MOVEMENT.baseJumpForce).toBe(6);
    expect(VOXEL_MOVEMENT.baseJumpImpulse).toBe(6.5);
    expect(VOXEL_MOVEMENT.baseJumpTimeMs).toBe(180);
    expect(VOXEL_MOVEMENT.sprintSpeedMultiplier).toBe(1.3);
    expect(VOXEL_MOVEMENT.walkStrideMs).toBeGreaterThan(
      VOXEL_MOVEMENT.fastStrideMs
    );
  });

  it("combines equipment and eating movement modifiers", () => {
    const movement = resolveVoxelMovement({
      equipmentSlots: [
        { itemId: 0, count: 0 },
        { itemId: ITEM_REGISTRY.HEAVY_SHIELD, count: 1 },
        { itemId: 0, count: 0 },
        { itemId: ITEM_REGISTRY.HELIUM_BOOTS, count: 1 }
      ],
      eating: true,
      sprintRequested: false,
      health: 20,
      gameMode: "survival"
    });
    expect(movement.jumpForce).toBeCloseTo(9.6);
    expect(movement.jumpImpulse).toBeCloseTo(10.4);
    expect(movement.maxSpeed).toBeCloseTo(1.032);
    expect(movement.canSprint).toBe(false);
  });

  it("applies health slowdown and sprint gates", () => {
    const healthy = resolveVoxelMovement({
      equipmentSlots: [],
      eating: false,
      sprintRequested: true,
      health: 15,
      gameMode: "survival"
    });
    expect(healthy.maxSpeed).toBe(4.3);
    expect(healthy.canSprint).toBe(true);

    const injured = resolveVoxelMovement({
      equipmentSlots: [],
      eating: false,
      sprintRequested: true,
      health: 9,
      gameMode: "survival"
    });
    expect(injured.maxSpeed).toBeCloseTo(3.01);
    expect(injured.canSprint).toBe(false);
  });

  it("creative mode bypasses all survival limitations", () => {
    const creative = resolveVoxelMovement({
      equipmentSlots: [
        { itemId: ITEM_REGISTRY.HEAVY_SHIELD, count: 1 },
        { itemId: 0, count: 0 },
        { itemId: 0, count: 0 },
        { itemId: 0, count: 0 }
      ],
      eating: true,
      sprintRequested: true,
      health: 2,
      gameMode: "creative"
    });

    expect(creative.maxSpeed).toBe(4.3);
    expect(creative.jumpForce).toBe(6);
    expect(creative.jumpImpulse).toBe(6.5);
    expect(creative.canSprint).toBe(true);
  });

  it("base jump height targets ~1.25 MC blocks in noa physics", () => {
    const blocks = estimatePeakJumpBlocks(
      VOXEL_MOVEMENT.baseJumpImpulse,
      VOXEL_MOVEMENT.baseJumpForce,
      VOXEL_MOVEMENT.baseJumpTimeMs
    );
    expect(blocks).toBeCloseTo(1.25, 1);
    expect(estimatePeakJumpBlocks(6, 6, 180)).toBeCloseTo(1.08, 1);
  });
});
