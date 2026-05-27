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
    expect(handMs).toBe(7500); // 1.0 toolSpeed on 1.5 hardness block with divisor 100: Math.ceil(1 / (1 / 1.5 / 100)) * 50 = 7500 ms

    const woodenPick = resolveBreakTool(BLOCK_REGISTRY.STONE, [
      { region: "storage", index: 0, itemId: ITEM_REGISTRY.WOODEN_PICKAXE }
    ]);
    const woodenPickMs = breakDurationForBlock(BLOCK_REGISTRY.STONE, woodenPick);
    expect(woodenPickMs).toBe(1150); // 2.0 toolSpeed on 1.5 hardness block with divisor 30: Math.ceil(1 / (2 / 1.5 / 30)) * 50 = 1150 ms

    const diamondPick = resolveBreakTool(BLOCK_REGISTRY.STONE, [
      { region: "storage", index: 0, itemId: ITEM_REGISTRY.DIAMOND_PICKAXE }
    ]);
    const diamondPickMs = breakDurationForBlock(BLOCK_REGISTRY.STONE, diamondPick);
    expect(diamondPickMs).toBe(300); // 8.0 toolSpeed on 1.5 hardness block with divisor 30: Math.ceil(1 / (8 / 1.5 / 30)) * 50 = 300 ms

    const swiftPick = resolveBreakTool(BLOCK_REGISTRY.STONE, [
      { region: "storage", index: 0, itemId: ITEM_REGISTRY.SWIFT_PICKAXE }
    ]);
    // Without heldItemId
    const swiftPickNoHeldMs = breakDurationForBlock(BLOCK_REGISTRY.STONE, swiftPick);
    expect(swiftPickNoHeldMs).toBe(200); // 12.0 toolSpeed on 1.5 hardness block with divisor 30: Math.ceil(1 / (12 / 1.5 / 30)) * 50 = 200 ms

    // With heldItemId (swift pickaxe held in hotbar)
    const swiftPickHeldMs = breakDurationForBlock(BLOCK_REGISTRY.STONE, swiftPick, ITEM_REGISTRY.SWIFT_PICKAXE);
    expect(swiftPickHeldMs).toBe(150); // 18.0 toolSpeed (12.0 * 1.5) on 1.5 hardness block with divisor 30: Math.ceil(1 / (18 / 1.5 / 30)) * 50 = 150 ms
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
    expect(ITEM_REGISTRY.GUNPOWDER).toBe(143);
    expect(itemFoodSpec(ITEM_REGISTRY.COOKED_MEAT)?.nutrition).toBe(8);
    expect(itemFoodSpec(ITEM_REGISTRY.POISONOUS_POTATO)?.nutrition).toBe(-2);
    expect(itemFoodSpec(ITEM_REGISTRY.GOLDEN_CARROT)?.nutrition).toBe(6);
  });
});
