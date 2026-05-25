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
    expect(BIOME_DEFS.ocean.ambientSoundUrl).toBe("");
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

  it("biases the central play window toward dry land", () => {
    const gen = new MultiBiomeGenerator(seed);
    let land = 0;
    let water = 0;
    for (let x = -1000; x <= 1000; x += 20) {
      for (let z = -1000; z <= 1000; z += 20) {
        const column = gen.sampleColumn(x, z);
        if (column.height >= SEA_LEVEL && column.biomeId !== "ocean") land += 1;
        else water += 1;
      }
    }
    const landPct = land / (land + water);
    expect(landPct).toBeGreaterThanOrEqual(0.5);
    expect(landPct).toBeLessThanOrEqual(0.8);
  });

  it("keeps most ocean pressure on the outer rim", () => {
    const gen = new MultiBiomeGenerator(seed);
    let ocean = 0;
    let sampled = 0;
    for (let x = -5200; x <= 5200; x += 400) {
      for (let z = -5200; z <= 5200; z += 400) {
        if (Math.hypot(x, z) < 3200) continue;
        sampled += 1;
        const column = gen.sampleColumn(x, z);
        if (column.height < SEA_LEVEL || column.biomeId === "ocean") ocean += 1;
      }
    }
    expect(ocean / sampled).toBeGreaterThan(0.65);
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

  it("places cacti in dry desert columns", () => {
    const gen = new MultiBiomeGenerator(seed);
    const column = gen.sampleColumn(-2390, 1990);
    expect(column.biomeId).toBe("desert");
    expect(gen.blockAt(-2390, column.height + 1, 1990)).toBe(BLOCK_REGISTRY.CACTUS);
  });

  it("exports surface lookup helpers for server spawn logic", () => {
    const y = findSurfaceY(0, 0, seed);
    expect(y).toBe(sampleBiomeColumn(0, 0, seed).height);
  });

  it("produces deterministic block types matching regression baselines", () => {
    const gen = new MultiBiomeGenerator(seed);
    
    const h0 = gen.findSurfaceY(0, 0);
    const h50 = gen.findSurfaceY(-50, 50);
    const hDesert = gen.findSurfaceY(-2390, 1990);

    const testPoints = [
      { x: 0, y: 30, z: 0, name: "Underground stone" },
      { x: 0, y: h0, z: 0, name: "Surface at 0,0" },
      { x: 0, y: h0 - 2, z: 0, name: "Subsurface at 0,0" },
      { x: -50, y: h50, z: 50, name: "Surface at -50,50" },
      { x: -2390, y: hDesert, z: 1990, name: "Desert surface" },
      { x: -2390, y: hDesert + 1, z: 1990, name: "Desert cactus" },
      { x: 0, y: 150, z: 0, name: "High air" }
    ];

    const results = testPoints.map(p => ({
      ...p,
      blockId: gen.blockAt(p.x, p.y, p.z)
    }));

    expect(results[0].blockId).toBe(BLOCK_REGISTRY.STONE);
    expect(results[1].blockId).toBe(BLOCK_REGISTRY.GRASS);
    expect(results[2].blockId).toBe(BLOCK_REGISTRY.DIRT);
    expect(results[3].blockId).toBe(BLOCK_REGISTRY.GRASS);
    expect(results[4].blockId).toBe(BLOCK_REGISTRY.SAND);
    expect(results[5].blockId).toBe(BLOCK_REGISTRY.CACTUS);
    expect(results[6].blockId).toBe(BLOCK_REGISTRY.AIR);
  });

  it("truncates fractional column coordinates before sampling and caching", () => {
    const gen = new MultiBiomeGenerator(seed);
    const whole = gen.sampleColumn(25, -90);
    const fractional = gen.sampleColumn(25.7, -90.3);
    expect(fractional).toEqual(whole);
    expect(gen.blockAt(25.7, 64, -90.3)).toBe(gen.blockAt(25, 64, -90));
  });

  it("places tree trunks and neighbor canopy blocks for every tree kind", () => {
    const gen = new MultiBiomeGenerator(seed);
    const cases = [
      {
        kind: "oak",
        trunkX: -2997,
        trunkZ: 2796,
        trunkBlock: BLOCK_REGISTRY.WOOD,
        canopyBlock: BLOCK_REGISTRY.LEAVES,
        canopyX: -2999,
        canopyY: 70,
        canopyZ: 2794
      },
      {
        kind: "birch",
        trunkX: -2931,
        trunkZ: 2829,
        trunkBlock: BLOCK_REGISTRY.BIRCH_LOG,
        canopyBlock: BLOCK_REGISTRY.BIRCH_LEAVES,
        canopyX: -2933,
        canopyY: 72,
        canopyZ: 2828
      },
      {
        kind: "spruce",
        trunkX: -2898,
        trunkZ: 2592,
        trunkBlock: BLOCK_REGISTRY.SPRUCE_LOG,
        canopyBlock: BLOCK_REGISTRY.SPRUCE_LEAVES,
        canopyX: -2899,
        canopyY: 80,
        canopyZ: 2591
      },
      {
        kind: "savanna",
        trunkX: -2352,
        trunkZ: 2961,
        trunkBlock: BLOCK_REGISTRY.WOOD,
        canopyBlock: BLOCK_REGISTRY.LEAVES_YELLOW,
        canopyX: -2353,
        canopyY: 72,
        canopyZ: 2960
      }
    ] as const;

    for (const treeCase of cases) {
      const column = gen.sampleColumn(treeCase.trunkX, treeCase.trunkZ);
      const tree = gen.getTreeAt(treeCase.trunkX, treeCase.trunkZ);
      expect(tree?.kind).toBe(treeCase.kind);
      expect(gen.blockAt(treeCase.trunkX, column.height + 1, treeCase.trunkZ)).toBe(
        treeCase.trunkBlock
      );
      expect(
        gen.blockAt(treeCase.canopyX, treeCase.canopyY, treeCase.canopyZ)
      ).toBe(treeCase.canopyBlock);
    }
  });

  it("finds nearby trees through the cached neighborhood lookup", () => {
    const gen = new MultiBiomeGenerator(seed);
    const trunkX = -2931;
    const trunkZ = 2829;
    const canopyX = -2933;
    const canopyY = 72;
    const canopyZ = 2828;

    const nearby = gen.getNearbyTrees(canopyX, canopyZ);
    expect(nearby.some((tree) => tree.trunkX === trunkX && tree.trunkZ === trunkZ)).toBe(
      true
    );
    expect(gen.blockAt(canopyX, canopyY, canopyZ)).toBe(BLOCK_REGISTRY.BIRCH_LEAVES);

    const warm = gen.blockAt(canopyX, canopyY, canopyZ);
    const cold = new MultiBiomeGenerator(seed).blockAt(canopyX, canopyY, canopyZ);
    expect(warm).toBe(cold);
  });
});
