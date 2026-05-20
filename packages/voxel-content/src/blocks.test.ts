import {
  BLOCK_DEFS,
  BLOCK_REGISTRY,
  PLACEABLE_BLOCK_IDS,
  REPLACEABLE_BLOCK_IDS,
  REGISTERED_BLOCK_IDS,
  blockBreakable,
  blockDef,
  blockDropId,
  blockDropsPickable,
  blockHardness,
  blockReplaceable
} from "./blocks";
import { blockSoundGroup, blockSoundUrl } from "./blockAudio";
import { isInstantBreak } from "./mining";

describe("@playground/voxel-content blocks", () => {
  it("lists ids 0..n contiguously", () => {
    expect(BLOCK_DEFS.length).toBe(103);
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

  it("marks air and surface plants as replaceable placement targets", () => {
    expect(REPLACEABLE_BLOCK_IDS.has(BLOCK_REGISTRY.AIR)).toBe(true);
    expect(blockReplaceable(BLOCK_REGISTRY.WATER)).toBe(true);
    expect(blockReplaceable(BLOCK_REGISTRY.GRASS_PLANT)).toBe(true);
    expect(blockReplaceable(BLOCK_REGISTRY.DANDELION)).toBe(true);
    expect(blockReplaceable(BLOCK_REGISTRY.STONE)).toBe(false);
    expect(blockReplaceable(BLOCK_REGISTRY.TORCH)).toBe(false);
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

  it("registers birch and spruce wood family blocks (43-48)", () => {
    const woodKeys = [
      "BIRCH_LOG",
      "BIRCH_PLANKS",
      "BIRCH_LEAVES",
      "SPRUCE_LOG",
      "SPRUCE_PLANKS",
      "SPRUCE_LEAVES"
    ] as const;

    for (let i = 0; i < woodKeys.length; i++) {
      const key = woodKeys[i]!;
      expect(BLOCK_REGISTRY[key]).toBe(43 + i);
      const def = blockDef(BLOCK_REGISTRY[key]);
      expect(def?.placeable).toBe(true);
      expect(def?.breakable).toBe(true);
      expect(def?.dropHotbarBlockId).toBe(BLOCK_REGISTRY[key]);
    }

    expect(blockDef(BLOCK_REGISTRY.BIRCH_LOG)?.speedTool).toBe("axe");
    expect(blockDef(BLOCK_REGISTRY.BIRCH_PLANKS)?.speedTool).toBe("axe");
    expect(blockDef(BLOCK_REGISTRY.SPRUCE_LOG)?.speedTool).toBe("axe");
    expect(blockDef(BLOCK_REGISTRY.SPRUCE_PLANKS)?.speedTool).toBe("axe");
    expect(blockDef(BLOCK_REGISTRY.BIRCH_LEAVES)?.speedTool).toBe(null);
    expect(blockDef(BLOCK_REGISTRY.SPRUCE_LEAVES)?.requiredTool).toBe(null);
    expect(blockHardness(BLOCK_REGISTRY.BIRCH_LOG)).toBe(blockHardness(BLOCK_REGISTRY.WOOD));
    expect(blockHardness(BLOCK_REGISTRY.BIRCH_PLANKS)).toBe(
      blockHardness(BLOCK_REGISTRY.OAK_PLANKS)
    );
    expect(blockHardness(BLOCK_REGISTRY.BIRCH_LEAVES)).toBe(
      blockHardness(BLOCK_REGISTRY.LEAVES)
    );
  });

  it("registers mechanical utility blocks at ids 100-102", () => {
    expect(BLOCK_REGISTRY.LADDER).toBe(100);
    expect(BLOCK_REGISTRY.TORCH).toBe(101);
    expect(BLOCK_REGISTRY.CHEST).toBe(102);
    expect(blockDef(BLOCK_REGISTRY.LADDER)?.speedTool).toBe("axe");
    expect(isInstantBreak(BLOCK_REGISTRY.TORCH)).toBe(true);
    expect(blockDef(BLOCK_REGISTRY.CHEST)?.placeable).toBe(true);
  });

  it("maps block ids to material sound groups and URL conventions", () => {
    expect(blockSoundGroup(BLOCK_REGISTRY.GRASS)).toBe("grass");
    expect(blockSoundGroup(BLOCK_REGISTRY.GRASS_SNOW)).toBe("grass");
    expect(blockSoundGroup(BLOCK_REGISTRY.STONE)).toBe("stone");
    expect(blockSoundGroup(BLOCK_REGISTRY.DIAMOND_ORE)).toBe("stone");
    expect(blockSoundGroup(BLOCK_REGISTRY.SANDSTONE)).toBe("sand");
    expect(blockSoundGroup(BLOCK_REGISTRY.BIRCH_LOG)).toBe("wood");
    expect(blockSoundGroup(BLOCK_REGISTRY.BIRCH_LEAVES)).toBe("leaves");
    expect(blockSoundGroup(BLOCK_REGISTRY.WHITE_WOOL)).toBe("cloth");
    expect(blockSoundGroup(BLOCK_REGISTRY.AIR)).toBe("silent");
    expect(blockSoundUrl("step", "grass")).toBe("/sounds/step/grass.mp3");
    expect(blockSoundUrl("break", "silent")).toBeNull();
  });
});
