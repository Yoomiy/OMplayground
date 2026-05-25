import {
  ITEM_REGISTRY,
  itemFoodSpec,
  itemMaxDurability,
  itemPerkSpec,
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

  it("registers expansion materials, foods, tools, and perk items", () => {
    expect(ITEM_REGISTRY.IRON_INGOT).toBe(111);
    expect(ITEM_REGISTRY.DIAMOND).toBe(112);
    expect(ITEM_REGISTRY.COAL).toBe(113);
    expect(ITEM_REGISTRY.BREAD).toBe(116);
    expect(ITEM_REGISTRY.GLOW_TALISMAN).toBe(126);
    expect(ITEM_REGISTRY.GOLD_INGOT).toBe(127);

    expect(itemFoodSpec(ITEM_REGISTRY.BREAD)).toEqual({
      nutrition: 5,
      saturationModifier: 6.0
    });
    expect(itemToolSpec(ITEM_REGISTRY.DIAMOND_PICKAXE)?.tier).toBe(3);
    expect(itemToolSpec(ITEM_REGISTRY.SWIFT_PICKAXE)?.speed).toBe(12);
    expect(itemPerkSpec(ITEM_REGISTRY.HELIUM_BOOTS)?.equipSlot).toBe("feet");
    expect(itemPerkSpec(ITEM_REGISTRY.HEAVY_SHIELD)?.damageReduction).toBe(0.5);

    expect(ITEM_REGISTRY.COOKED_MEAT).toBe(133);
    expect(itemFoodSpec(ITEM_REGISTRY.COOKED_MEAT)?.nutrition).toBe(8);
    expect(itemFoodSpec(ITEM_REGISTRY.POISONOUS_POTATO)?.nutrition).toBe(-2);
    expect(itemFoodSpec(ITEM_REGISTRY.GOLDEN_CARROT)?.nutrition).toBe(6);
  });
});
