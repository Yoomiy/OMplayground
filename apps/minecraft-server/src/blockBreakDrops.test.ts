import {
  blockDropId,
  blockDropsPickable,
  melonSliceDropCount,
  rollGrassForagingDrop,
  usesCustomSurvivalBreakDrops
} from "@playground/voxel-content";
import { BLOCK_REGISTRY } from "./protocol";

describe("survival block break drops", () => {
  it("grass plants have no default block drop", () => {
    expect(blockDropId(BLOCK_REGISTRY.GRASS_PLANT)).toBeNull();
    expect(blockDropsPickable(BLOCK_REGISTRY.GRASS_PLANT)).toBe(false);
    expect(usesCustomSurvivalBreakDrops(BLOCK_REGISTRY.GRASS_PLANT)).toBe(true);
  });

  it("melon uses custom drops not block pickable", () => {
    expect(blockDropId(BLOCK_REGISTRY.MELON)).toBeNull();
    expect(usesCustomSurvivalBreakDrops(BLOCK_REGISTRY.MELON)).toBe(true);
  });

  it("melon slice count stays in 3..7", () => {
    for (let i = 0; i < 20; i++) {
      const n = melonSliceDropCount(Math.random());
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
    }
  });

  it("grass foraging roll never returns two items at once", () => {
    const drop = rollGrassForagingDrop(0.02);
    expect(drop === null || (drop.count === 1 && (drop.kind === "item" || drop.kind === "block"))).toBe(
      true
    );
  });
});
