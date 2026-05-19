import { BLOCK_REGISTRY } from "./blocks";
import { ITEM_REGISTRY } from "./items";
import {
  CRAFTING_GRID_SIZE,
  findMatchingRecipe,
  RECIPES,
  type GridCellSnapshot,
  type GridSnapshot
} from "./recipes";

function emptyGrid(): GridCellSnapshot[] {
  return Array.from({ length: CRAFTING_GRID_SIZE }, () => ({
    blockId: BLOCK_REGISTRY.AIR,
    itemId: 0,
    count: 0
  }));
}

function gridWith(cells: Partial<GridCellSnapshot>[]): GridSnapshot {
  const g = emptyGrid();
  for (let i = 0; i < cells.length; i++) {
    g[i] = { ...g[i]!, ...cells[i]! };
  }
  return g;
}

describe("@playground/voxel-content recipes", () => {
  it("declares the four wood-family recipes", () => {
    expect(RECIPES.map((r) => r.key)).toEqual([
      "oak_log_to_planks",
      "birch_log_to_planks",
      "spruce_log_to_planks",
      "planks_to_sticks"
    ]);
  });

  it("oak_log_to_planks: one oak log alone → four oak planks", () => {
    const matched = findMatchingRecipe(
      gridWith([{ blockId: BLOCK_REGISTRY.WOOD, count: 1 }])
    );
    expect(matched?.recipe.key).toBe("oak_log_to_planks");
    expect(matched?.recipe.output).toEqual({
      kind: "block",
      id: BLOCK_REGISTRY.OAK_PLANKS,
      count: 4
    });
    expect(matched?.consumeAt).toEqual([0]);
  });

  it("birch_log_to_planks: one birch log → four birch planks", () => {
    const matched = findMatchingRecipe(
      gridWith([{}, { blockId: BLOCK_REGISTRY.BIRCH_LOG, count: 1 }])
    );
    expect(matched?.recipe.key).toBe("birch_log_to_planks");
    expect(matched?.recipe.output.id).toBe(BLOCK_REGISTRY.BIRCH_PLANKS);
  });

  it("spruce_log_to_planks: one spruce log → four spruce planks", () => {
    const matched = findMatchingRecipe(
      gridWith([{ blockId: BLOCK_REGISTRY.SPRUCE_LOG, count: 1 }])
    );
    expect(matched?.recipe.key).toBe("spruce_log_to_planks");
    expect(matched?.recipe.output.id).toBe(BLOCK_REGISTRY.SPRUCE_PLANKS);
  });

  it("planks_to_sticks: two planks anywhere → four sticks", () => {
    const matched = findMatchingRecipe(
      gridWith([
        { blockId: BLOCK_REGISTRY.OAK_PLANKS, count: 1 },
        {},
        {},
        { blockId: BLOCK_REGISTRY.BIRCH_PLANKS, count: 1 }
      ])
    );
    expect(matched?.recipe.key).toBe("planks_to_sticks");
    expect(matched?.recipe.output).toEqual({
      kind: "item",
      id: ITEM_REGISTRY.STICK,
      count: 4
    });
    expect([...(matched?.consumeAt ?? [])].sort()).toEqual([0, 3]);
  });

  it("planks_to_sticks accepts legacy item planks", () => {
    const matched = findMatchingRecipe(
      gridWith([
        { itemId: ITEM_REGISTRY.PLANKS, count: 1 },
        { itemId: ITEM_REGISTRY.PLANKS, count: 1 }
      ])
    );
    expect(matched?.recipe.key).toBe("planks_to_sticks");
  });

  it("planks_to_sticks accepts mixed plank block types", () => {
    const matched = findMatchingRecipe(
      gridWith([
        { blockId: BLOCK_REGISTRY.SPRUCE_PLANKS, count: 1 },
        { itemId: ITEM_REGISTRY.PLANKS, count: 1 }
      ])
    );
    expect(matched?.recipe.key).toBe("planks_to_sticks");
  });

  it("shapeless recipes match regardless of empty-cell placement", () => {
    const topLeft = findMatchingRecipe(
      gridWith([{ blockId: BLOCK_REGISTRY.WOOD, count: 1 }])
    );
    const bottomRight = findMatchingRecipe(
      gridWith([{}, {}, {}, { blockId: BLOCK_REGISTRY.WOOD, count: 1 }])
    );
    expect(topLeft?.recipe.key).toBe("oak_log_to_planks");
    expect(bottomRight?.recipe.key).toBe("oak_log_to_planks");
  });

  it("rejects non-matching grids", () => {
    expect(
      findMatchingRecipe(gridWith([{ blockId: BLOCK_REGISTRY.WOOD, count: 1 }, { blockId: BLOCK_REGISTRY.DIRT, count: 1 }]))
    ).toBeNull();
    expect(
      findMatchingRecipe(
        gridWith([
          { itemId: ITEM_REGISTRY.PLANKS, count: 1 },
          { itemId: ITEM_REGISTRY.PLANKS, count: 1 },
          { itemId: ITEM_REGISTRY.PLANKS, count: 1 }
        ])
      )
    ).toBeNull();
    expect(findMatchingRecipe(emptyGrid())).toBeNull();
  });

  it("rejects wrong grid length", () => {
    expect(findMatchingRecipe([])).toBeNull();
  });
});
