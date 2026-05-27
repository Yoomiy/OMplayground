import { BLOCK_REGISTRY } from "./blocks";
import { ITEM_REGISTRY } from "./items";
import {
  CRAFTING_GRID_WIDTH_2,
  CRAFTING_GRID_WIDTH_3,
  CRAFTING_TABLE_GRID_SIZE,
  PERSONAL_CRAFTING_GRID_SIZE,
  RECIPES,
  findMatchingRecipe,
  getBoundingBox,
  type GridCellSnapshot,
  type GridSnapshot
} from "./recipes";

function emptyGrid(size: number): GridCellSnapshot[] {
  return Array.from({ length: size }, () => ({
    blockId: BLOCK_REGISTRY.AIR,
    itemId: 0,
    count: 0
  }));
}

function gridWith(size: number, cells: Record<number, Partial<GridCellSnapshot>>): GridSnapshot {
  const g = emptyGrid(size);
  for (const [rawIndex, cell] of Object.entries(cells)) {
    const index = Number(rawIndex);
    g[index] = { ...g[index]!, ...cell };
  }
  return g;
}

describe("@playground/voxel-content recipes", () => {
  it("declares the expansion recipe table", () => {
    expect(RECIPES.map((r) => r.key)).toEqual([
      "oak_log_to_planks",
      "birch_log_to_planks",
      "spruce_log_to_planks",
      "crafting_table",
      "planks_to_sticks",
      "wooden_pickaxe",
      "stone_pickaxe",
      "iron_pickaxe",
      "diamond_pickaxe",
      "wooden_axe",
      "stone_axe",
      "iron_axe",
      "diamond_axe",
      "wooden_shovel",
      "stone_shovel",
      "bread",
      "helium_boots",
      "swift_pickaxe",
      "coal_ore_to_coal",
      "iron_ore_to_ingot",
      "gold_ore_to_ingot",
      "diamond_ore_to_diamond",
      "bucket",
      "flint_and_steel",
      "ladder",
      "torch",
      "chest",
      "heavy_shield",
      "feather_falling_talisman",
      "helios_medallion",
      "glow_talisman",
      "sugar_from_cane",
      "cookie",
      "melon_block_to_slices",
      "melon_slices_to_block",
      "cake",
      "golden_carrot",
      "cook_meat",
      "cook_beef",
      "bake_potato",
      "gunpowder",
      "tnt"
    ]);
  });

  it("matches cookie and cake recipes", () => {
    const cookie = findMatchingRecipe(
      gridWith(CRAFTING_TABLE_GRID_SIZE, {
        0: { itemId: ITEM_REGISTRY.WHEAT, count: 1 },
        1: { itemId: ITEM_REGISTRY.COCOA_BEANS, count: 1 },
        2: { itemId: ITEM_REGISTRY.WHEAT, count: 1 }
      }),
      CRAFTING_GRID_WIDTH_3
    );
    expect(cookie?.recipe.key).toBe("cookie");
    expect(cookie?.recipe.output).toEqual({
      kind: "item",
      id: ITEM_REGISTRY.COOKIE,
      count: 8
    });

    const cake = findMatchingRecipe(
      gridWith(CRAFTING_TABLE_GRID_SIZE, {
        0: { itemId: ITEM_REGISTRY.SUGAR, count: 1 },
        1: { itemId: ITEM_REGISTRY.EGG, count: 1 },
        2: { itemId: ITEM_REGISTRY.SUGAR, count: 1 },
        3: { itemId: ITEM_REGISTRY.WHEAT, count: 1 },
        4: { itemId: ITEM_REGISTRY.WHEAT, count: 1 },
        5: { itemId: ITEM_REGISTRY.WHEAT, count: 1 }
      }),
      CRAFTING_GRID_WIDTH_3
    );
    expect(cake?.recipe.key).toBe("cake");
    expect(cake?.recipe.output.id).toBe(BLOCK_REGISTRY.CAKE);
  });

  it("matches shapeless log recipes regardless of placement", () => {
    const matched = findMatchingRecipe(
      gridWith(PERSONAL_CRAFTING_GRID_SIZE, {
        3: { blockId: BLOCK_REGISTRY.WOOD, count: 1 }
      }),
      CRAFTING_GRID_WIDTH_2
    );
    expect(matched?.recipe.key).toBe("oak_log_to_planks");
    expect(matched?.recipe.output).toEqual({
      kind: "block",
      id: BLOCK_REGISTRY.OAK_PLANKS,
      count: 4
    });
    expect(matched?.consumeAt).toEqual([3]);
  });

  it("matches shaped 2x2 crafting table recipe in the personal grid", () => {
    const matched = findMatchingRecipe(
      gridWith(PERSONAL_CRAFTING_GRID_SIZE, {
        0: { blockId: BLOCK_REGISTRY.OAK_PLANKS, count: 1 },
        1: { blockId: BLOCK_REGISTRY.BIRCH_PLANKS, count: 1 },
        2: { blockId: BLOCK_REGISTRY.SPRUCE_PLANKS, count: 1 },
        3: { itemId: ITEM_REGISTRY.PLANKS, count: 1 }
      }),
      CRAFTING_GRID_WIDTH_2
    );
    expect(matched?.recipe.key).toBe("crafting_table");
    expect(matched?.recipe.output.id).toBe(BLOCK_REGISTRY.CRAFTING);
  });

  it("matches a shaped 1x2 stick recipe anywhere in a 3x3 grid", () => {
    const matched = findMatchingRecipe(
      gridWith(CRAFTING_TABLE_GRID_SIZE, {
        2: { blockId: BLOCK_REGISTRY.OAK_PLANKS, count: 1 },
        5: { blockId: BLOCK_REGISTRY.BIRCH_PLANKS, count: 1 }
      }),
      CRAFTING_GRID_WIDTH_3
    );
    expect(matched?.recipe.key).toBe("planks_to_sticks");
    expect(matched?.consumeAt).toEqual([2, 5]);
  });

  it("gates 3x3 tool recipes out of the personal 2x2 grid", () => {
    const twoByTwo = gridWith(PERSONAL_CRAFTING_GRID_SIZE, {
      0: { blockId: BLOCK_REGISTRY.OAK_PLANKS, count: 1 },
      1: { blockId: BLOCK_REGISTRY.OAK_PLANKS, count: 1 },
      2: { itemId: ITEM_REGISTRY.STICK, count: 1 },
      3: { itemId: ITEM_REGISTRY.STICK, count: 1 }
    });
    expect(findMatchingRecipe(twoByTwo, CRAFTING_GRID_WIDTH_2)?.recipe.key).not.toBe(
      "wooden_pickaxe"
    );
  });

  it("matches pickaxe, ladder, torch, chest, food, and perk recipes", () => {
    const pickaxe = findMatchingRecipe(
      gridWith(CRAFTING_TABLE_GRID_SIZE, {
        0: { blockId: BLOCK_REGISTRY.COBBLESTONE, count: 1 },
        1: { blockId: BLOCK_REGISTRY.COBBLESTONE, count: 1 },
        2: { blockId: BLOCK_REGISTRY.COBBLESTONE, count: 1 },
        4: { itemId: ITEM_REGISTRY.STICK, count: 1 },
        7: { itemId: ITEM_REGISTRY.STICK, count: 1 }
      }),
      CRAFTING_GRID_WIDTH_3
    );
    expect(pickaxe?.recipe.output).toEqual({
      kind: "item",
      id: ITEM_REGISTRY.STONE_PICKAXE,
      count: 1
    });

    expect(
      findMatchingRecipe(
        gridWith(CRAFTING_TABLE_GRID_SIZE, {
          0: { itemId: ITEM_REGISTRY.STICK, count: 1 },
          2: { itemId: ITEM_REGISTRY.STICK, count: 1 },
          3: { itemId: ITEM_REGISTRY.STICK, count: 1 },
          4: { itemId: ITEM_REGISTRY.STICK, count: 1 },
          5: { itemId: ITEM_REGISTRY.STICK, count: 1 },
          6: { itemId: ITEM_REGISTRY.STICK, count: 1 },
          8: { itemId: ITEM_REGISTRY.STICK, count: 1 }
        }),
        CRAFTING_GRID_WIDTH_3
      )?.recipe.key
    ).toBe("ladder");

    expect(
      findMatchingRecipe(
        gridWith(CRAFTING_TABLE_GRID_SIZE, {
          1: { itemId: ITEM_REGISTRY.COAL, count: 1 },
          4: { itemId: ITEM_REGISTRY.STICK, count: 1 }
        }),
        CRAFTING_GRID_WIDTH_3
      )?.recipe.key
    ).toBe("torch");

    expect(
      findMatchingRecipe(
        gridWith(CRAFTING_TABLE_GRID_SIZE, {
          0: { blockId: BLOCK_REGISTRY.OAK_PLANKS, count: 1 },
          1: { blockId: BLOCK_REGISTRY.OAK_PLANKS, count: 1 },
          2: { blockId: BLOCK_REGISTRY.OAK_PLANKS, count: 1 },
          3: { blockId: BLOCK_REGISTRY.OAK_PLANKS, count: 1 },
          5: { blockId: BLOCK_REGISTRY.OAK_PLANKS, count: 1 },
          6: { blockId: BLOCK_REGISTRY.OAK_PLANKS, count: 1 },
          7: { blockId: BLOCK_REGISTRY.OAK_PLANKS, count: 1 },
          8: { blockId: BLOCK_REGISTRY.OAK_PLANKS, count: 1 }
        }),
        CRAFTING_GRID_WIDTH_3
      )?.recipe.key
    ).toBe("chest");

    expect(
      findMatchingRecipe(
        gridWith(CRAFTING_TABLE_GRID_SIZE, {
          3: { itemId: ITEM_REGISTRY.WHEAT, count: 1 },
          4: { itemId: ITEM_REGISTRY.WHEAT, count: 1 },
          5: { itemId: ITEM_REGISTRY.WHEAT, count: 1 }
        }),
        CRAFTING_GRID_WIDTH_3
      )?.recipe.output.id
    ).toBe(ITEM_REGISTRY.BREAD);

    expect(
      findMatchingRecipe(
        gridWith(CRAFTING_TABLE_GRID_SIZE, {
          1: { blockId: BLOCK_REGISTRY.LEAVES, count: 1 },
          3: { blockId: BLOCK_REGISTRY.BIRCH_LEAVES, count: 1 },
          4: { itemId: ITEM_REGISTRY.DIAMOND, count: 1 },
          5: { blockId: BLOCK_REGISTRY.SPRUCE_LEAVES, count: 1 },
          7: { blockId: BLOCK_REGISTRY.LEAVES_YELLOW, count: 1 }
        }),
        CRAFTING_GRID_WIDTH_3
      )?.recipe.output.id
    ).toBe(ITEM_REGISTRY.FEATHER_FALLING_TALISMAN);
  });

  it("matches utility item recipes for shovels, bucket, flint and steel, and glow talisman", () => {
    expect(
      findMatchingRecipe(
        gridWith(CRAFTING_TABLE_GRID_SIZE, {
          1: { blockId: BLOCK_REGISTRY.OAK_PLANKS, count: 1 },
          4: { itemId: ITEM_REGISTRY.STICK, count: 1 },
          7: { itemId: ITEM_REGISTRY.STICK, count: 1 }
        }),
        CRAFTING_GRID_WIDTH_3
      )?.recipe.output.id
    ).toBe(ITEM_REGISTRY.WOODEN_SHOVEL);

    expect(
      findMatchingRecipe(
        gridWith(CRAFTING_TABLE_GRID_SIZE, {
          0: { itemId: ITEM_REGISTRY.IRON_INGOT, count: 1 },
          2: { itemId: ITEM_REGISTRY.IRON_INGOT, count: 1 },
          4: { itemId: ITEM_REGISTRY.IRON_INGOT, count: 1 }
        }),
        CRAFTING_GRID_WIDTH_3
      )?.recipe.output.id
    ).toBe(ITEM_REGISTRY.BUCKET);

    expect(
      findMatchingRecipe(
        gridWith(PERSONAL_CRAFTING_GRID_SIZE, {
          0: { itemId: ITEM_REGISTRY.FLINT, count: 1 },
          3: { itemId: ITEM_REGISTRY.IRON_INGOT, count: 1 }
        }),
        CRAFTING_GRID_WIDTH_2
      )?.recipe.output.id
    ).toBe(ITEM_REGISTRY.FLINT_AND_STEEL);

    expect(
      findMatchingRecipe(
        gridWith(CRAFTING_TABLE_GRID_SIZE, {
          1: { itemId: ITEM_REGISTRY.COAL, count: 1 },
          3: { itemId: ITEM_REGISTRY.COAL, count: 1 },
          4: { blockId: BLOCK_REGISTRY.TORCH, count: 1 },
          5: { itemId: ITEM_REGISTRY.COAL, count: 1 },
          7: { itemId: ITEM_REGISTRY.COAL, count: 1 }
        }),
        CRAFTING_GRID_WIDTH_3
      )?.recipe.output.id
    ).toBe(ITEM_REGISTRY.GLOW_TALISMAN);
  });

  it("supports shapeless cold-smelting resource conversions", () => {
    expect(
      findMatchingRecipe(
        gridWith(PERSONAL_CRAFTING_GRID_SIZE, {
          1: { blockId: BLOCK_REGISTRY.IRON_ORE, count: 1 }
        }),
        CRAFTING_GRID_WIDTH_2
      )?.recipe.output.id
    ).toBe(ITEM_REGISTRY.IRON_INGOT);
    expect(
      findMatchingRecipe(
        gridWith(PERSONAL_CRAFTING_GRID_SIZE, {
          0: { blockId: BLOCK_REGISTRY.DIAMOND_ORE, count: 1 }
        }),
        CRAFTING_GRID_WIDTH_2
      )?.recipe.output.id
    ).toBe(ITEM_REGISTRY.DIAMOND);
  });

  it("supports crafting gunpowder and tnt in 3x3, but gates them from 2x2 grid", () => {
    // Gunpowder recipe is: 1x Iron Ingot + 2x Coal + 2x Flint (shapeless, 5 ingredients)
    // First, verify gunpowder crafting on 3x3 works
    const gunpowderMatched = findMatchingRecipe(
      gridWith(CRAFTING_TABLE_GRID_SIZE, {
        0: { itemId: ITEM_REGISTRY.IRON_INGOT, count: 1 },
        1: { itemId: ITEM_REGISTRY.COAL, count: 1 },
        2: { itemId: ITEM_REGISTRY.COAL, count: 1 },
        3: { itemId: ITEM_REGISTRY.FLINT, count: 1 },
        4: { itemId: ITEM_REGISTRY.FLINT, count: 1 }
      }),
      CRAFTING_GRID_WIDTH_3
    );
    expect(gunpowderMatched?.recipe.key).toBe("gunpowder");
    expect(gunpowderMatched?.recipe.output).toEqual({
      kind: "item",
      id: ITEM_REGISTRY.GUNPOWDER,
      count: 3
    });

    // Verify it fails on a 2x2 grid (since we need 5 distinct slots)
    const gunpowderOn2x2 = findMatchingRecipe(
      gridWith(PERSONAL_CRAFTING_GRID_SIZE, {
        0: { itemId: ITEM_REGISTRY.IRON_INGOT, count: 1 },
        1: { itemId: ITEM_REGISTRY.COAL, count: 1 },
        2: { itemId: ITEM_REGISTRY.COAL, count: 1 },
        3: { itemId: ITEM_REGISTRY.FLINT, count: 1 } // missing 1 flint, but even with 5 we couldn't fit it in a 4-slot grid
      }),
      CRAFTING_GRID_WIDTH_2
    );
    expect(gunpowderOn2x2).toBeNull();

    // TNT recipe is: checkered pattern of gunpowder (item 143) and sand (block 6)
    // Row 1: Gunpowder Sand Gunpowder
    // Row 2: Sand Gunpowder Sand
    // Row 3: Gunpowder Sand Gunpowder
    const tntMatched = findMatchingRecipe(
      gridWith(CRAFTING_TABLE_GRID_SIZE, {
        0: { itemId: ITEM_REGISTRY.GUNPOWDER, count: 1 },
        1: { blockId: BLOCK_REGISTRY.SAND, count: 1 },
        2: { itemId: ITEM_REGISTRY.GUNPOWDER, count: 1 },
        3: { blockId: BLOCK_REGISTRY.SAND, count: 1 },
        4: { itemId: ITEM_REGISTRY.GUNPOWDER, count: 1 },
        5: { blockId: BLOCK_REGISTRY.SAND, count: 1 },
        6: { itemId: ITEM_REGISTRY.GUNPOWDER, count: 1 },
        7: { blockId: BLOCK_REGISTRY.SAND, count: 1 },
        8: { itemId: ITEM_REGISTRY.GUNPOWDER, count: 1 }
      }),
      CRAFTING_GRID_WIDTH_3
    );
    expect(tntMatched?.recipe.key).toBe("tnt");
    expect(tntMatched?.recipe.output).toEqual({
      kind: "block",
      id: BLOCK_REGISTRY.TNT,
      count: 1
    });

    // TNT requires 3x3 layout, should fail on 2x2
    const tntOn2x2 = findMatchingRecipe(
      gridWith(PERSONAL_CRAFTING_GRID_SIZE, {
        0: { itemId: ITEM_REGISTRY.GUNPOWDER, count: 1 },
        1: { blockId: BLOCK_REGISTRY.SAND, count: 1 },
        2: { itemId: ITEM_REGISTRY.GUNPOWDER, count: 1 },
        3: { blockId: BLOCK_REGISTRY.SAND, count: 1 }
      }),
      CRAFTING_GRID_WIDTH_2
    );
    expect(tntOn2x2).toBeNull();
  });

  it("exposes bounding-box shrinking for shaped recipe alignment", () => {
    const box = getBoundingBox(
      gridWith(CRAFTING_TABLE_GRID_SIZE, {
        4: { itemId: ITEM_REGISTRY.COAL, count: 1 },
        7: { itemId: ITEM_REGISTRY.STICK, count: 1 }
      }),
      CRAFTING_GRID_WIDTH_3,
      (cell) => cell.count <= 0
    );
    expect(box.width).toBe(1);
    expect(box.height).toBe(2);
  });

  it("rejects non-matching grids and wrong widths", () => {
    expect(
      findMatchingRecipe(
        gridWith(PERSONAL_CRAFTING_GRID_SIZE, {
          0: { blockId: BLOCK_REGISTRY.WOOD, count: 1 },
          1: { blockId: BLOCK_REGISTRY.DIRT, count: 1 }
        }),
        CRAFTING_GRID_WIDTH_2
      )
    ).toBeNull();
    expect(findMatchingRecipe([], CRAFTING_GRID_WIDTH_2)).toBeNull();
    expect(findMatchingRecipe(emptyGrid(PERSONAL_CRAFTING_GRID_SIZE), 3)).toBeNull();
  });
});
