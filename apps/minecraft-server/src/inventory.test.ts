import {
  BLOCK_REGISTRY,
  PLACEABLE_BLOCK_IDS
} from "./protocol";
import {
  addPickUp,
  blockDropsPickable,
  consumeOneIfPresent,
  createEmptyHotbar,
  hotbarFromPersisted,
  MAX_STACK
} from "./inventory";

describe("inventory helpers", () => {
  it("createEmptyHotbar has 9 empty slots", () => {
    const h = createEmptyHotbar();
    expect(h).toHaveLength(9);
    expect(h.every((s) => s.count === 0 && s.blockId === BLOCK_REGISTRY.AIR)).toBe(
      true
    );
  });

  it("addPickUp merges same block up to MAX_STACK then uses a second slot", () => {
    const h = createEmptyHotbar();
    for (let i = 0; i < MAX_STACK; i++) {
      addPickUp(h, BLOCK_REGISTRY.DIRT);
    }
    expect(h[0].count).toBe(MAX_STACK);
    addPickUp(h, BLOCK_REGISTRY.DIRT);
    const dirtTotal = h
      .filter((s) => s.blockId === BLOCK_REGISTRY.DIRT)
      .reduce((a, s) => a + s.count, 0);
    expect(dirtTotal).toBe(MAX_STACK + 1);
  });

  it("consumeOneIfPresent decrements when stack exists", () => {
    const h = createEmptyHotbar();
    addPickUp(h, BLOCK_REGISTRY.STONE);
    consumeOneIfPresent(h, BLOCK_REGISTRY.STONE);
    const stoneLeft = h.some(
      (s) => s.blockId === BLOCK_REGISTRY.STONE && s.count > 0
    );
    expect(stoneLeft).toBe(false);
  });

  it("consumeOneIfPresent is a no-op when missing (lenient sync)", () => {
    const h = createEmptyHotbar();
    consumeOneIfPresent(h, BLOCK_REGISTRY.GRASS);
    expect(h.every((s) => s.count === 0)).toBe(true);
  });

  it("blockDropsPickable skips air and water", () => {
    expect(blockDropsPickable(BLOCK_REGISTRY.AIR)).toBe(false);
    expect(blockDropsPickable(BLOCK_REGISTRY.WATER)).toBe(false);
    expect(blockDropsPickable(BLOCK_REGISTRY.GRASS)).toBe(true);
  });

  it("hotbarFromPersisted tolerates bad cells", () => {
    const empty = createEmptyHotbar();
    const raw = [
      { blockId: BLOCK_REGISTRY.GLASS, count: 2 },
      ...Array.from({ length: 8 }, () => ({ blockId: 999, count: 1 }))
    ];
    const h = hotbarFromPersisted(raw, empty);
    expect(h[0]).toEqual({ blockId: BLOCK_REGISTRY.GLASS, count: 2 });
    expect(PLACEABLE_BLOCK_IDS.includes(h[1].blockId) || h[1].count === 0).toBe(
      true
    );
  });
});
