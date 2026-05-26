import { ITEM_REGISTRY } from "./items";
import { BLOCK_REGISTRY } from "./blocks";
import {
  breakDurationForBlock,
  breakDurationMs,
  resolveBreakTool,
  resolveBreakToolSpeed
} from "./mining";

describe("mining break durations", () => {
  it("uses MC tick formula with divisor 100 only for raw stone hand mining", () => {
    expect(breakDurationMs(1.5, 1, false, true)).toBe(7500);
    expect(breakDurationMs(1.5, 1, false, false)).toBe(2300);
  });

  it("stone hand vs pickaxe matches vanilla timings", () => {
    expect(breakDurationForBlock(BLOCK_REGISTRY.STONE, null)).toBe(7500);

    const pick = resolveBreakTool(BLOCK_REGISTRY.STONE, [
      { region: "hotbar", index: 0, itemId: ITEM_REGISTRY.WOODEN_PICKAXE }
    ]);
    expect(breakDurationForBlock(BLOCK_REGISTRY.STONE, pick)).toBe(1150);
  });

  it("cobblestone and gold block hand mining use divisor 30", () => {
    expect(breakDurationForBlock(BLOCK_REGISTRY.COBBLESTONE, null)).toBe(2300);
    expect(breakDurationForBlock(BLOCK_REGISTRY.GOLD_BLOCK, null)).toBe(3000);
  });

  it("swift pickaxe bonus only when held item matches resolved tool", () => {
    const swiftPick = resolveBreakTool(BLOCK_REGISTRY.STONE, [
      { region: "hotbar", index: 0, itemId: ITEM_REGISTRY.SWIFT_PICKAXE }
    ])!;

    expect(
      breakDurationForBlock(BLOCK_REGISTRY.STONE, swiftPick, ITEM_REGISTRY.SWIFT_PICKAXE)
    ).toBe(150);
    expect(breakDurationForBlock(BLOCK_REGISTRY.STONE, swiftPick)).toBe(200);

    const noTool = resolveBreakTool(BLOCK_REGISTRY.DIRT, [
      { region: "hotbar", index: 0, itemId: ITEM_REGISTRY.SWIFT_PICKAXE }
    ]);
    expect(noTool).toBeNull();
    expect(
      resolveBreakToolSpeed(null, ITEM_REGISTRY.SWIFT_PICKAXE)
    ).toBe(1);
    expect(
      breakDurationForBlock(
        BLOCK_REGISTRY.DIRT,
        null,
        ITEM_REGISTRY.SWIFT_PICKAXE
      )
    ).toBe(750);
  });
});
