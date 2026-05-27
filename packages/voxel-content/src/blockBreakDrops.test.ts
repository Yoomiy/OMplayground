import {
  GRASS_FORAGING_TOTAL_CHANCE,
  rollGrassForagingDrop,
  rollLeavesBonusDrop,
  melonSliceDropCount,
  rollGravelDrop,
  GRAVEL_FLINT_CHANCE
} from "./blockBreakDrops";
import { ITEM_REGISTRY } from "./items";
import { BLOCK_REGISTRY } from "./blocks";

describe("blockBreakDrops", () => {
  it("gravel drop returns flint when random roll is below GRAVEL_FLINT_CHANCE", () => {
    // Currently GRAVEL_FLINT_CHANCE is 1.0 (for testing), so it should always drop flint
    const roll = rollGravelDrop(0.5);
    expect(roll.kind).toBe("item");
    expect(roll.id).toBe(ITEM_REGISTRY.FLINT);
    expect(roll.count).toBe(1);
  });
  it("grass foraging returns null above total chance", () => {
    expect(rollGrassForagingDrop(GRASS_FORAGING_TOTAL_CHANCE)).toBeNull();
    expect(rollGrassForagingDrop(0.2)).toBeNull();
  });

  it("grass foraging uses single weighted roll", () => {
    expect(rollGrassForagingDrop(0.01)?.kind).toBe("item");
    expect(rollGrassForagingDrop(0.01)?.id).toBe(ITEM_REGISTRY.WHEAT);
    expect(rollGrassForagingDrop(0.052)?.id).toBe(ITEM_REGISTRY.CARROT);
  });

  it("leaves bonus drops apple or egg in bands", () => {
    expect(rollLeavesBonusDrop(0.04)?.id).toBe(ITEM_REGISTRY.APPLE);
    expect(rollLeavesBonusDrop(0.06)?.id).toBe(ITEM_REGISTRY.EGG);
    expect(rollLeavesBonusDrop(0.5)).toBeNull();
  });

  it("melon slice count is between 3 and 7", () => {
    expect(melonSliceDropCount(0)).toBe(3);
    expect(melonSliceDropCount(0.99)).toBe(7);
  });
});
