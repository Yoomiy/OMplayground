import { describe, expect, it } from "vitest";
import { resolveHeldItemSpec } from "./heldItemView";

const blockIconById = {
  1: "/block/grass.png",
  2: "/block/dirt.png"
};
const itemIconById = {
  100: "/item/stick.png",
  101: "/item/pickaxe.png"
};

describe("resolveHeldItemSpec", () => {
  it("uses the selected creative block", () => {
    expect(
      resolveHeldItemSpec({
        gameMode: "creative",
        selectedBlockId: 2,
        survivalSlotIndex: 0,
        survivalSlots: [],
        blockIconById,
        itemIconById,
        airBlockId: 0
      })
    ).toEqual({ kind: "block", id: 2, textureUrl: "/block/dirt.png" });
  });

  it("prefers item icons over block ids in survival hotbar cells", () => {
    expect(
      resolveHeldItemSpec({
        gameMode: "survival",
        selectedBlockId: 1,
        survivalSlotIndex: 0,
        survivalSlots: [{ blockId: 1, itemId: 101, count: 1 }],
        blockIconById,
        itemIconById,
        airBlockId: 0
      })
    ).toEqual({ kind: "item", id: 101, textureUrl: "/item/pickaxe.png" });
  });

  it("renders plant-style blocks as flat held sprites", () => {
    expect(
      resolveHeldItemSpec({
        gameMode: "creative",
        selectedBlockId: 2,
        survivalSlotIndex: 0,
        survivalSlots: [],
        blockIconById,
        itemIconById,
        flatBlockIds: new Set([2]),
        airBlockId: 0
      })
    ).toEqual({ kind: "flatBlock", id: 2, textureUrl: "/block/dirt.png" });

    expect(
      resolveHeldItemSpec({
        gameMode: "survival",
        selectedBlockId: 1,
        survivalSlotIndex: 0,
        survivalSlots: [{ blockId: 2, itemId: 0, count: 1 }],
        blockIconById,
        itemIconById,
        flatBlockIds: new Set([2]),
        airBlockId: 0
      })
    ).toEqual({ kind: "flatBlock", id: 2, textureUrl: "/block/dirt.png" });
  });

  it("falls back to an empty hand for empty or missing icons", () => {
    expect(
      resolveHeldItemSpec({
        gameMode: "survival",
        selectedBlockId: 1,
        survivalSlotIndex: 0,
        survivalSlots: [{ blockId: 2, itemId: 999, count: 1 }],
        blockIconById,
        itemIconById,
        airBlockId: 0
      })
    ).toEqual({ kind: "empty" });

    expect(
      resolveHeldItemSpec({
        gameMode: "survival",
        selectedBlockId: 1,
        survivalSlotIndex: 1,
        survivalSlots: [{ blockId: 2, itemId: 0, count: 1 }],
        blockIconById,
        itemIconById,
        airBlockId: 0
      })
    ).toEqual({ kind: "empty" });
  });
});
