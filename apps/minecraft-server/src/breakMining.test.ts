import { BLOCK_REGISTRY, ITEM_REGISTRY } from "./protocol";
import {
  beginBreak,
  cancelBreak,
  finishBreak,
  heldHotbarToolSlot,
  shouldUseTimedBreak
} from "./breakMining";
import {
  createEmptyCraftingGrid,
  createEmptyHotbar,
  createEmptyItemInventory
} from "./inventory";
import type { PlayerRuntime } from "./room";

function playerWithHotbarTool(
  hotbarIndex: number,
  itemId: number,
  durability?: number
): PlayerRuntime {
  const hotbar = createEmptyHotbar();
  hotbar[hotbarIndex] = {
    blockId: BLOCK_REGISTRY.AIR,
    itemId,
    count: 1,
    ...(durability !== undefined ? { durability } : {})
  };
  return {
    userId: "u1",
    displayName: "Test",
    pos: [0, 0, 0],
    heading: 0,
    pitch: 0,
    jumping: false,
    t: 0,
    lastInputAt: 0,
    inventory: hotbar,
    itemInventory: createEmptyItemInventory(),
    craftingGrid: createEmptyCraftingGrid(),
    selectedHotbarIndex: hotbarIndex
  };
}

describe("breakMining", () => {
  it("shouldUseTimedBreak only in survival for non-instant blocks", () => {
    expect(shouldUseTimedBreak(BLOCK_REGISTRY.DIRT, "survival")).toBe(true);
    expect(shouldUseTimedBreak(BLOCK_REGISTRY.SAPLING, "survival")).toBe(false);
    expect(shouldUseTimedBreak(BLOCK_REGISTRY.DIRT, "creative")).toBe(false);
  });

  it("rejects iron ore when held hotbar tool is under-tier", () => {
    const p = playerWithHotbarTool(0, ITEM_REGISTRY.WOODEN_PICKAXE);
    const r = beginBreak(p, [1, 2, 3], BLOCK_REGISTRY.IRON_ORE, 1000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("WRONG_TOOL");
  });

  it("ignores tools in storage when not held in selected hotbar slot", () => {
    const p = playerWithHotbarTool(0, 0);
    p.itemInventory![0] = { itemId: ITEM_REGISTRY.IRON_PICKAXE, count: 1 };
    p.selectedHotbarIndex = 0;
    const r = beginBreak(p, [1, 2, 3], BLOCK_REGISTRY.IRON_ORE, 1000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("WRONG_TOOL");
  });

  it("stone break is faster with pickaxe held in hotbar", () => {
    const hand = playerWithHotbarTool(0, 0);
    const pick = playerWithHotbarTool(0, ITEM_REGISTRY.WOODEN_PICKAXE);
    const handMs = beginBreak(hand, [0, 0, 0], BLOCK_REGISTRY.STONE, 0);
    const pickMs = beginBreak(pick, [0, 0, 0], BLOCK_REGISTRY.STONE, 0);
    expect(handMs.ok && pickMs.ok).toBe(true);
    if (handMs.ok && pickMs.ok) {
      expect(handMs.durationMs).toBe(7500);
      expect(pickMs.durationMs).toBe(1150);
    }
  });

  it("swift pickaxe breaks stone faster than diamond when held", () => {
    const swift = playerWithHotbarTool(0, ITEM_REGISTRY.SWIFT_PICKAXE);
    const diamond = playerWithHotbarTool(0, ITEM_REGISTRY.DIAMOND_PICKAXE);
    const swiftMs = beginBreak(swift, [0, 0, 0], BLOCK_REGISTRY.STONE, 0);
    const diamondMs = beginBreak(diamond, [0, 0, 0], BLOCK_REGISTRY.STONE, 0);
    expect(swiftMs.ok && diamondMs.ok).toBe(true);
    if (swiftMs.ok && diamondMs.ok) {
      expect(swiftMs.durationMs).toBe(150);
      expect(diamondMs.durationMs).toBe(300);
      expect(swiftMs.durationMs).toBeLessThan(diamondMs.durationMs);
    }
  });

  it("finishBreak enforces duration and applies durability to hotbar tool", () => {
    const p = playerWithHotbarTool(2, ITEM_REGISTRY.WOODEN_PICKAXE);
    const start = beginBreak(p, [5, 5, 5], BLOCK_REGISTRY.COAL_ORE, 1000);
    expect(start.ok).toBe(true);
    if (!start.ok) return;
    const early = finishBreak(p, [5, 5, 5], BLOCK_REGISTRY.COAL_ORE, 1100);
    expect(early.ok).toBe(false);
    const done = finishBreak(
      p,
      [5, 5, 5],
      BLOCK_REGISTRY.COAL_ORE,
      1000 + start.durationMs
    );
    expect(done.ok).toBe(true);
    expect(p.inventory![2]!.durability).toBeDefined();
    cancelBreak(p);
    expect(p.activeBreak).toBeUndefined();
  });

  it("heldHotbarToolSlot only returns the selected cell", () => {
    const hotbar = createEmptyHotbar();
    hotbar[1] = {
      blockId: BLOCK_REGISTRY.AIR,
      itemId: ITEM_REGISTRY.STONE_PICKAXE,
      count: 1
    };
    expect(heldHotbarToolSlot(hotbar, 0)).toHaveLength(0);
    expect(heldHotbarToolSlot(hotbar, 1)[0]?.itemId).toBe(ITEM_REGISTRY.STONE_PICKAXE);
  });
});
