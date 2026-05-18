import { BLOCK_REGISTRY, ITEM_REGISTRY, PLACEABLE_BLOCK_IDS } from "./protocol";
import {
  addPickUp,
  applyInventoryMove,
  blockBreakable,
  blockDropId,
  blockDropsPickable,
  consumeOneIfPresent,
  cloneCraftingGrid,
  createEmptyCraftingGrid,
  createEmptyHotbar,
  createEmptyItemInventory,
  hotbarFromPersisted,
  MAX_STACK,
  spillExcessFromCraftingGrid,
  tryCraftFromGrid
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
    expect(blockDropsPickable(BLOCK_REGISTRY.BEDROCK)).toBe(false);
    expect(blockDropsPickable(BLOCK_REGISTRY.GRASS)).toBe(true);
    expect(blockBreakable(BLOCK_REGISTRY.BEDROCK)).toBe(false);
    expect(blockDropId(BLOCK_REGISTRY.STONE)).toBe(BLOCK_REGISTRY.COBBLESTONE);
  });

  it("hotbarFromPersisted tolerates bad cells", () => {
    const empty = createEmptyHotbar();
    const raw = [
      { blockId: BLOCK_REGISTRY.GLASS, count: 2 },
      ...Array.from({ length: 8 }, () => ({ blockId: 999, count: 1 }))
    ];
    const h = hotbarFromPersisted(raw, empty);
    expect(h[0]).toEqual({ blockId: BLOCK_REGISTRY.GLASS, itemId: 0, count: 2 });
    expect(PLACEABLE_BLOCK_IDS.includes(h[1].blockId) || h[1].count === 0).toBe(
      true
    );
  });

  it("tryCraftFromGrid planks: one log in grid → four placeable planks in hotbar", () => {
    const hotbar = createEmptyHotbar();
    const items = createEmptyItemInventory();
    const grid = createEmptyCraftingGrid();
    grid[0] = { blockId: BLOCK_REGISTRY.WOOD, itemId: 0, count: 1 };
    expect(tryCraftFromGrid(hotbar, items, grid)).toBe(true);
    expect(grid.every((s) => s.count === 0 || s.blockId === BLOCK_REGISTRY.AIR)).toBe(
      true
    );
    const plankTotal = hotbar
      .filter((s) => s.blockId === BLOCK_REGISTRY.OAK_PLANKS)
      .reduce((a, s) => a + s.count, 0);
    expect(plankTotal).toBe(4);
  });

  it("tryCraftFromGrid sticks: two planks anywhere in grid → four sticks", () => {
    const hotbar = createEmptyHotbar();
    const items = createEmptyItemInventory();
    const grid = createEmptyCraftingGrid();
    grid[1] = { blockId: BLOCK_REGISTRY.AIR, itemId: ITEM_REGISTRY.PLANKS, count: 1 };
    grid[3] = { blockId: BLOCK_REGISTRY.AIR, itemId: ITEM_REGISTRY.PLANKS, count: 1 };
    expect(tryCraftFromGrid(hotbar, items, grid)).toBe(true);
    const sticks = items
      .filter((s) => s.itemId === ITEM_REGISTRY.STICK)
      .reduce((a, s) => a + s.count, 0);
    expect(sticks).toBe(4);
  });

  it("tryCraftFromGrid sticks accepts placeable plank blocks", () => {
    const hotbar = createEmptyHotbar();
    const items = createEmptyItemInventory();
    const grid = createEmptyCraftingGrid();
    grid[0] = { blockId: BLOCK_REGISTRY.OAK_PLANKS, itemId: 0, count: 1 };
    grid[1] = { blockId: BLOCK_REGISTRY.OAK_PLANKS, itemId: 0, count: 1 };
    expect(tryCraftFromGrid(hotbar, items, grid)).toBe(true);
    const sticks = items
      .filter((s) => s.itemId === ITEM_REGISTRY.STICK)
      .reduce((a, s) => a + s.count, 0);
    expect(sticks).toBe(4);
  });

  it("tryCraftFromGrid sticks fails: three planks do not form sticks", () => {
    const hotbar = createEmptyHotbar();
    const items = createEmptyItemInventory();
    const grid = createEmptyCraftingGrid();
    grid[0] = { blockId: BLOCK_REGISTRY.AIR, itemId: ITEM_REGISTRY.PLANKS, count: 1 };
    grid[1] = { blockId: BLOCK_REGISTRY.AIR, itemId: ITEM_REGISTRY.PLANKS, count: 1 };
    grid[2] = { blockId: BLOCK_REGISTRY.AIR, itemId: ITEM_REGISTRY.PLANKS, count: 1 };
    expect(tryCraftFromGrid(hotbar, items, grid)).toBe(false);
  });

  it("applyInventoryMove places only one unit into an empty crafting cell", () => {
    const hotbar = createEmptyHotbar();
    const items = createEmptyItemInventory();
    items[0] = { itemId: ITEM_REGISTRY.PLANKS, count: 5 };
    const grid = createEmptyCraftingGrid();
    expect(
      applyInventoryMove(hotbar, items, grid, {
        from: "storage",
        fromIndex: 0,
        to: "craft",
        toIndex: 0
      })
    ).toBe(true);
    expect(grid[0]).toMatchObject({
      itemId: ITEM_REGISTRY.PLANKS,
      count: 1
    });
    expect(items[0]).toMatchObject({ itemId: ITEM_REGISTRY.PLANKS, count: 4 });
  });

  it("spillExcessFromCraftingGrid returns extras to item storage", () => {
    const hotbar = createEmptyHotbar();
    const items = createEmptyItemInventory();
    const grid = createEmptyCraftingGrid();
    grid[0] = { blockId: BLOCK_REGISTRY.AIR, itemId: ITEM_REGISTRY.PLANKS, count: 3 };
    spillExcessFromCraftingGrid(grid, hotbar, items);
    expect(grid[0]!.count).toBe(1);
    expect(items.some((s) => s.itemId === ITEM_REGISTRY.PLANKS && s.count === 2)).toBe(
      true
    );
  });

  it("tryCraftFromGrid planks fails without free space for four planks", () => {
    const hotbar = createEmptyHotbar();
    const items = createEmptyItemInventory();
    const grid = createEmptyCraftingGrid();
    grid[1] = { blockId: BLOCK_REGISTRY.WOOD, itemId: 0, count: 1 };
    for (let i = 0; i < hotbar.length; i++) {
      hotbar[i] = { blockId: BLOCK_REGISTRY.STONE, itemId: 0, count: MAX_STACK };
    }
    expect(tryCraftFromGrid(hotbar, items, grid)).toBe(false);
    expect(grid.some((s) => s.blockId === BLOCK_REGISTRY.WOOD && s.count > 0)).toBe(
      true
    );
  });

  it("applyInventoryMove preserves tool durability into crafting grid", () => {
    const hotbar = createEmptyHotbar();
    const items = createEmptyItemInventory();
    const grid = createEmptyCraftingGrid();
    hotbar[0] = {
      blockId: BLOCK_REGISTRY.AIR,
      itemId: ITEM_REGISTRY.WOODEN_PICKAXE,
      count: 1,
      durability: 42
    };
    expect(
      applyInventoryMove(hotbar, items, grid, {
        from: "hotbar",
        fromIndex: 0,
        to: "craft",
        toIndex: 0
      })
    ).toBe(true);
    expect(grid[0]).toMatchObject({
      itemId: ITEM_REGISTRY.WOODEN_PICKAXE,
      count: 1,
      durability: 42
    });
    expect(hotbar[0]!.itemId).toBe(0);
  });

  it("cloneCraftingGrid copies durability", () => {
    const grid = createEmptyCraftingGrid();
    grid[0] = {
      blockId: BLOCK_REGISTRY.AIR,
      itemId: ITEM_REGISTRY.STONE_PICKAXE,
      count: 1,
      durability: 99
    };
    const cloned = cloneCraftingGrid(grid);
    expect(cloned[0]!.durability).toBe(99);
  });

  it("applyInventoryMove moves wood from hotbar into crafting grid", () => {
    const hotbar = createEmptyHotbar();
    const items = createEmptyItemInventory();
    const grid = createEmptyCraftingGrid();
    addPickUp(hotbar, BLOCK_REGISTRY.WOOD);
    expect(
      applyInventoryMove(hotbar, items, grid, {
        from: "hotbar",
        fromIndex: 0,
        to: "craft",
        toIndex: 0
      })
    ).toBe(true);
    expect(grid[0]!.blockId).toBe(BLOCK_REGISTRY.WOOD);
    expect(grid[0]!.count).toBe(1);
    expect(hotbar[0]!.count === 0 || hotbar[0]!.blockId === BLOCK_REGISTRY.AIR).toBe(
      true
    );
  });
});
