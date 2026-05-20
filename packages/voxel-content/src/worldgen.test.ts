import { BIOME_DEFS } from "./biomes";
import { BLOCK_REGISTRY } from "./blocks";
import {
  MultiBiomeGenerator,
  SEA_LEVEL,
  findSurfaceY,
  proceduralVoxelID,
  sampleBiomeColumn
} from "./worldgen";

describe("@playground/voxel-content biomes", () => {
  it("defines every expansion biome with render and audio metadata", () => {
    const ids = Object.keys(BIOME_DEFS).sort();
    expect(ids).toEqual([
      "beach",
      "desert",
      "forest",
      "ice_mountains",
      "iceplains",
      "mountains",
      "ocean",
      "plains",
      "savanna"
    ]);
    expect(BIOME_DEFS.desert.temperature).toBeGreaterThan(1.5);
    expect(BIOME_DEFS.iceplains.temperature).toBe(0);
    expect(BIOME_DEFS.ocean.ambientSoundUrl).toContain("ocean");
  });
});

describe("@playground/voxel-content MultiBiomeGenerator", () => {
  const seed = 1234567;

  it("is deterministic for biome columns and block ids", () => {
    const a = sampleBiomeColumn(25, -90, seed);
    const b = sampleBiomeColumn(25, -90, seed);
    expect(a).toEqual(b);
    expect(proceduralVoxelID(25, 64, -90, seed)).toBe(
      proceduralVoxelID(25, 64, -90, seed)
    );
  });

  it("finds multiple biome families in a modest deterministic scan", () => {
    const gen = new MultiBiomeGenerator(seed);
    const seen = new Set<string>();
    for (let x = -2200; x <= 2200; x += 220) {
      for (let z = -2200; z <= 2200; z += 220) {
        seen.add(gen.sampleColumn(x, z).biomeId);
      }
    }
    expect(seen.has("ocean")).toBe(true);
    expect(seen.has("beach") || seen.has("plains")).toBe(true);
    expect(seen.has("desert") || seen.has("savanna") || seen.has("forest")).toBe(true);
  });

  it("keeps surfaces solid and the next dry air cell empty", () => {
    const gen = new MultiBiomeGenerator(seed);
    let checked = 0;
    for (let x = -180; x <= 180 && checked < 8; x += 30) {
      for (let z = -180; z <= 180 && checked < 8; z += 30) {
        const column = gen.sampleColumn(x, z);
        if (column.height < SEA_LEVEL || column.biomeId === "ocean") continue;
        expect(gen.blockAt(x, column.height, z)).not.toBe(BLOCK_REGISTRY.AIR);
        expect(gen.blockAt(x, column.height + 1, z)).toBe(BLOCK_REGISTRY.AIR);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("fills ocean-like columns with water up to sea level", () => {
    const gen = new MultiBiomeGenerator(seed);
    let oceanColumn: ReturnType<typeof gen.sampleColumn> | null = null;
    for (let x = -2500; x <= 2500 && !oceanColumn; x += 100) {
      for (let z = -2500; z <= 2500 && !oceanColumn; z += 100) {
        const column = gen.sampleColumn(x, z);
        if (column.biomeId === "ocean" && column.height < SEA_LEVEL - 2) {
          oceanColumn = column;
        }
      }
    }
    expect(oceanColumn).not.toBeNull();
    const column = oceanColumn!;
    expect(gen.blockAt(column.x, column.height, column.z)).not.toBe(BLOCK_REGISTRY.AIR);
    expect(gen.blockAt(column.x, SEA_LEVEL, column.z)).toBe(BLOCK_REGISTRY.WATER);
  });

  it("exports surface lookup helpers for server spawn logic", () => {
    const y = findSurfaceY(0, 0, seed);
    expect(y).toBe(sampleBiomeColumn(0, 0, seed).height);
  });
});
