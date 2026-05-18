import {
  BLOCK_DEFS,
  BLOCK_REGISTRY,
  PLACEABLE_BLOCK_IDS,
  REGISTERED_BLOCK_IDS,
  blockBreakable,
  blockDef,
  blockDropId,
  blockDropsPickable,
  blockHardness
} from "./blocks";
import { isInstantBreak } from "./mining";

describe("@playground/voxel-content blocks", () => {
  it("lists ids 0..n contiguously", () => {
    expect(BLOCK_DEFS.length).toBe(43);
    for (let i = 0; i < BLOCK_DEFS.length; i++) {
      expect(BLOCK_DEFS[i]!.id).toBe(i);
    }
  });

  it("exposes BLOCK_REGISTRY keys matching defs", () => {
    expect(BLOCK_REGISTRY.AIR).toBe(0);
    expect(BLOCK_REGISTRY.STONE).toBe(3);
    expect(BLOCK_REGISTRY.COBBLESTONE).toBe(9);
    expect(BLOCK_REGISTRY.BEDROCK).toBe(42);
  });

  it("computes PLACEABLE_BLOCK_IDS ascending and omitting fluids/bedrock", () => {
    const placeable = BLOCK_DEFS.filter((d) => d.placeable).map((d) => d.id);
    expect([...PLACEABLE_BLOCK_IDS]).toEqual(placeable);
    expect(PLACEABLE_BLOCK_IDS.includes(BLOCK_REGISTRY.WATER)).toBe(false);
    expect(PLACEABLE_BLOCK_IDS.includes(BLOCK_REGISTRY.BEDROCK)).toBe(false);
  });

  it("REGISTERED_BLOCK_IDS covers every def", () => {
    for (const d of BLOCK_DEFS) {
      expect(REGISTERED_BLOCK_IDS.has(d.id)).toBe(true);
    }
  });

  it("implements legacy break/drop rules", () => {
    expect(blockBreakable(BLOCK_REGISTRY.AIR)).toBe(false);
    expect(blockBreakable(BLOCK_REGISTRY.WATER)).toBe(false);
    expect(blockBreakable(BLOCK_REGISTRY.BEDROCK)).toBe(false);
    expect(blockBreakable(BLOCK_REGISTRY.GRASS)).toBe(true);

    expect(blockDropId(BLOCK_REGISTRY.STONE)).toBe(BLOCK_REGISTRY.COBBLESTONE);
    expect(blockDropId(BLOCK_REGISTRY.GRASS)).toBe(BLOCK_REGISTRY.GRASS);
    expect(blockDropId(BLOCK_REGISTRY.WATER)).toBe(null);
    expect(blockDropId(BLOCK_REGISTRY.AIR)).toBe(null);

    expect(blockDropsPickable(BLOCK_REGISTRY.WATER)).toBe(false);
    expect(blockDropsPickable(BLOCK_REGISTRY.GRASS)).toBe(true);
  });

  it("stone drop stays aligned with BLOCK_DEF meta", () => {
    const stone = blockDef(BLOCK_REGISTRY.STONE);
    expect(stone?.dropHotbarBlockId).toBe(BLOCK_REGISTRY.COBBLESTONE);
  });

  it("exposes mining hardness on defs", () => {
    expect(blockHardness(BLOCK_REGISTRY.STONE)).toBe(1.5);
    expect(blockDef(BLOCK_REGISTRY.OBSIDIAN)?.requiredTool).toBe("pickaxe");
    expect(isInstantBreak(BLOCK_REGISTRY.SAPLING)).toBe(true);
    expect(isInstantBreak(BLOCK_REGISTRY.DIRT)).toBe(false);
  });
});
