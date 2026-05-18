import {
  ITEM_REGISTRY,
  itemMaxDurability,
  itemToolSpec,
  ITEM_DEFS
} from "./items";
import { breakDurationForBlock, resolveBreakTool } from "./mining";
import { BLOCK_REGISTRY } from "./blocks";

describe("@playground/voxel-content items", () => {
  it("registers survival tools with tiers", () => {
    expect(ITEM_DEFS.length).toBeGreaterThanOrEqual(9);
    expect(itemToolSpec(ITEM_REGISTRY.WOODEN_PICKAXE)?.tier).toBe(0);
    expect(itemToolSpec(ITEM_REGISTRY.IRON_PICKAXE)?.tier).toBe(2);
    expect(itemMaxDurability(ITEM_REGISTRY.STONE_AXE)).toBeGreaterThan(0);
  });

  it("resolveBreakTool rejects iron ore without stone pick", () => {
    const slots = [
      {
        region: "storage" as const,
        index: 0,
        itemId: ITEM_REGISTRY.WOODEN_PICKAXE
      }
    ];
    expect(resolveBreakTool(BLOCK_REGISTRY.IRON_ORE, slots)).toBeNull();
    slots[0]!.itemId = ITEM_REGISTRY.STONE_PICKAXE;
    expect(resolveBreakTool(BLOCK_REGISTRY.IRON_ORE, slots)?.spec.tier).toBe(1);
  });

  it("pickaxe speeds up stone vs hand", () => {
    const handMs = breakDurationForBlock(BLOCK_REGISTRY.STONE, null);
    const pick = resolveBreakTool(BLOCK_REGISTRY.STONE, [
      { region: "storage", index: 0, itemId: ITEM_REGISTRY.WOODEN_PICKAXE }
    ]);
    const pickMs = breakDurationForBlock(BLOCK_REGISTRY.STONE, pick);
    expect(pickMs).toBeLessThan(handMs);
  });
});
