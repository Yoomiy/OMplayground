import { BIOME_DEFS, type BiomeDef, type BiomeId } from "./biomes";
import { BLOCK_REGISTRY } from "./blocks";
import { clamp, hash3, noise2D, smoothstep } from "./worldgenNoise";

export const SEA_LEVEL = 65;
export const WORLD_MIN_Y = 0;
export const SPAWN_SCAN_MAX_Y = 170;

const WATER_SEED = 0x57415445;
const HEAT_SEED = 0x48454154;
const WEIRD_SEED = 0x57454952;
const CONTINENTAL_SEED = 0x434f4e54;
const SEABED_SEED_1 = 0x53454131;
const SEABED_SEED_2 = 0x53454132;
const HEIGHT_SEED_1 = 0x48473131;
const HEIGHT_SEED_2 = 0x48473232;
const HEIGHT_SEED_3 = 0x48473333;
const MOUNTAIN_SEED = 0x4d544e31;
const RELIEF_SEED = 0x52454c46;

export interface BiomeFactors {
  readonly weirdness: number;
  readonly heat: number;
  readonly water: number;
  readonly continental: number;
}

export interface BiomeColumn {
  readonly x: number;
  readonly z: number;
  readonly seed: number;
  readonly biomeId: BiomeId;
  readonly biome: BiomeDef;
  readonly factors: BiomeFactors;
  readonly height: number;
  readonly seaFloorHeight: number;
  readonly landHeight: number;
}

type TreeKind = "oak" | "birch" | "spruce" | "savanna";

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function isColdBiome(biomeId: BiomeId): boolean {
  return biomeId === "iceplains" || biomeId === "ice_mountains";
}

function isOceanLike(biomeId: BiomeId): boolean {
  return biomeId === "ocean";
}

function treeKindForBiome(biomeId: BiomeId, roll: number): TreeKind | null {
  if (biomeId === "forest") return roll < 0.25 ? "birch" : "oak";
  if (biomeId === "plains") return roll < 0.08 ? "birch" : "oak";
  if (biomeId === "savanna") return "savanna";
  if (biomeId === "iceplains" || biomeId === "ice_mountains") return "spruce";
  if (biomeId === "mountains") return "spruce";
  return null;
}

function treeThresholdForBiome(biomeId: BiomeId): number {
  switch (biomeId) {
    case "forest":
      return 0.0035;
    case "plains":
      return 0.0006;
    case "savanna":
      return 0.0011;
    case "iceplains":
      return 0.0008;
    case "ice_mountains":
    case "mountains":
      return 0.0005;
    default:
      return 0;
  }
}

function dist2(x: number, z: number): number {
  return Math.sqrt(x * x + z * z);
}

function treeBlockAt(
  x: number,
  y: number,
  z: number,
  trunkX: number,
  trunkZ: number,
  trunkBaseY: number,
  kind: TreeKind,
  treeSeed: number
): number {
  const lx = x - trunkX;
  const lz = z - trunkZ;
  if (Math.abs(lx) > 5 || Math.abs(lz) > 5 || y <= trunkBaseY) {
    return BLOCK_REGISTRY.AIR;
  }

  const size = Math.floor(hash3(trunkX, 9, trunkZ, treeSeed) * 3);
  const trunkHeight =
    kind === "spruce"
      ? 8 + size * 2
      : kind === "savanna"
        ? 5 + size
        : 6 + size;
  const canopyY = trunkBaseY + trunkHeight;
  const logId =
    kind === "birch"
      ? BLOCK_REGISTRY.BIRCH_LOG
      : kind === "spruce"
        ? BLOCK_REGISTRY.SPRUCE_LOG
        : BLOCK_REGISTRY.WOOD;
  const leavesId =
    kind === "birch"
      ? BLOCK_REGISTRY.BIRCH_LEAVES
      : kind === "spruce"
        ? BLOCK_REGISTRY.SPRUCE_LEAVES
        : kind === "savanna"
          ? BLOCK_REGISTRY.LEAVES_YELLOW
          : BLOCK_REGISTRY.LEAVES;

  if (lx === 0 && lz === 0 && y <= canopyY) return logId;

  if (kind === "spruce") {
    const relY = y - canopyY;
    const radius = (canopyY - y) % 2 === 0 ? 2.4 : 1.4;
    if (relY >= -7 && relY <= 0 && dist2(lx, lz) <= radius) return leavesId;
    return BLOCK_REGISTRY.AIR;
  }

  if (kind === "savanna") {
    const relY = Math.abs(y - canopyY);
    if (relY <= 1 && dist2(lx, lz) <= 2.2) return leavesId;
    return BLOCK_REGISTRY.AIR;
  }

  const ly = y - canopyY;
  const d = Math.sqrt(lx * lx + ly * ly + lz * lz);
  if (d <= 3.1 + size * 0.25 && hash3(lx, ly, lz, treeSeed ^ 0x4c4541) > 0.22) {
    return leavesId;
  }
  return BLOCK_REGISTRY.AIR;
}

export class MultiBiomeGenerator {
  constructor(readonly seed: number) {}

  sampleFactors(x: number, z: number): BiomeFactors {
    const jitter = hash3(x, 200, z, this.seed) / 90.0;
    return {
      weirdness: noise2D(x / 600, z / 600, this.seed ^ WEIRD_SEED) + 1.0 + jitter,
      heat: noise2D(x / 300, z / 300, this.seed ^ HEAT_SEED) + 1.0 + jitter,
      water: noise2D(x / 400, z / 400, this.seed ^ WATER_SEED) + 1.0 + jitter,
      continental: noise2D(x / 2500, z / 2500, this.seed ^ CONTINENTAL_SEED)
    };
  }

  selectLandBiome(factors: BiomeFactors): BiomeId {
    const { heat, water, weirdness } = factors;
    if (water > 1.3) return "ocean";
    if (water > 1.15 && weirdness > 1.5) return "mountains";
    if (water > 1.15) return "beach";
    if (heat > 1.4) return "desert";
    if (water < 1.0 && heat > 1.15) return "savanna";
    if (heat > 0.5 && weirdness > 1.5) return "mountains";
    if (heat > 0.5 && weirdness > 1.3) return "forest";
    if (heat > 0.5) return "plains";
    if (weirdness > 1.5) return "ice_mountains";
    return "iceplains";
  }

  heightForBiome(biomeId: BiomeId, x: number, z: number): number {
    const low = noise2D(x / 120, z / 120, this.seed ^ HEIGHT_SEED_1);
    const detail = noise2D(x / 40, z / 40, this.seed ^ HEIGHT_SEED_2);
    const micro = noise2D(x / 15, z / 15, this.seed ^ HEIGHT_SEED_3);
    const ridge = noise2D(x / 80, z / 80, this.seed ^ MOUNTAIN_SEED);
    const h = smoothstep(-1, 1, low * 0.75 + detail * 0.25);
    const relief = 0.5 + 0.5 * noise2D(x / 180, z / 180, this.seed ^ RELIEF_SEED);

    switch (biomeId) {
      case "ocean":
        return Math.round(
          50 + low * 5 + detail * 1.5
        );
      case "beach":
        return Math.round(63 + low * 2);
      case "forest":
        return Math.round(66 + low * 7 + detail * 2);
      case "desert":
        return Math.round(
          clamp(65 + Math.abs(low * (1 - h) + (detail + 0.2) * h) * 7 + micro, 65, 76)
        );
      case "savanna":
        return Math.round(65 + low * 6 + detail * 2);
      case "mountains":
        return Math.round(clamp(78 + ridge * ridge * 45 * (0.75 + relief * 0.25) + low * 8, 72, 140));
      case "iceplains":
        return Math.round(63 + low * 4 + detail);
      case "ice_mountains":
        return Math.round(clamp(74 + ridge * ridge * 35 * (0.8 + relief * 0.2) + low * 6, 68, 120));
      case "plains":
      default:
        return Math.round(64 + low * 5 + detail * 1.5);
    }
  }

  seaFloorHeight(x: number, z: number): number {
    return Math.round(
      38 +
        noise2D(x / 120, z / 120, this.seed ^ SEABED_SEED_1) * 6 +
        noise2D(x / 15, z / 15, this.seed ^ SEABED_SEED_2) * 2.5
    );
  }

  sampleColumn(x: number, z: number): BiomeColumn {
    const factors = this.sampleFactors(x, z);
    const selected = this.selectLandBiome(factors);
    const landBiome = selected === "ocean" ? "beach" : selected;
    const seaHeight = this.seaFloorHeight(x, z);

    let landHeight = this.heightForBiome(landBiome, x, z);
    let biomeId = selected;

    if (factors.water >= 1.08 && factors.water <= 1.45) {
      const t = smoothstep(1.08, 1.45, factors.water);
      const coastalHeight = lerp(
        this.heightForBiome("beach", x, z),
        this.heightForBiome("ocean", x, z),
        t
      );
      if (factors.weirdness > 1.45) {
        const mountainT =
          smoothstep(1.45, 1.65, factors.weirdness) *
          (1 - smoothstep(1.3, 1.45, factors.water));
        landHeight = Math.round(
          lerp(coastalHeight, this.heightForBiome("mountains", x, z), mountainT)
        );
        biomeId = mountainT > 0.7 ? "mountains" : t > 0.55 ? "ocean" : "beach";
      } else {
        landHeight = Math.round(coastalHeight);
        biomeId = t > 0.55 ? "ocean" : "beach";
      }
    } else if (
      factors.water <= 1.08 &&
      factors.heat >= 0.42 &&
      factors.heat <= 0.58 &&
      factors.weirdness > 1.3
    ) {
      const t = smoothstep(0.42, 0.58, factors.heat);
      const coldBiome = factors.weirdness > 1.5 ? "ice_mountains" : "iceplains";
      const warmBiome = factors.weirdness > 1.5 ? "mountains" : "forest";
      landHeight = Math.round(
        lerp(this.heightForBiome(coldBiome, x, z), this.heightForBiome(warmBiome, x, z), t)
      );
      biomeId = t > 0.55 ? warmBiome : coldBiome;
    } else if (
      factors.water <= 1.15 &&
      factors.weirdness > 1.5 &&
      factors.heat >= 1.32 &&
      factors.heat <= 1.48
    ) {
      const t = smoothstep(1.32, 1.48, factors.heat);
      landHeight = Math.round(
        lerp(this.heightForBiome("mountains", x, z), this.heightForBiome("desert", x, z), t)
      );
      biomeId = t > 0.55 ? "desert" : "mountains";
    } else if (
      factors.water < 1.0 &&
      factors.heat > 1.15 &&
      factors.heat <= 1.4 &&
      factors.weirdness > 1.5
    ) {
      const t = smoothstep(1.5, 1.75, factors.weirdness);
      landHeight = Math.round(
        lerp(this.heightForBiome("savanna", x, z), this.heightForBiome("mountains", x, z), t)
      );
      biomeId = t > 0.6 ? "mountains" : "savanna";
    } else if (factors.water <= 1.15 && factors.weirdness >= 1.3 && factors.weirdness <= 1.5 && factors.heat > 0.5) {
      const t = smoothstep(1.3, 1.5, factors.weirdness);
      landHeight = Math.round(lerp(this.heightForBiome("forest", x, z), this.heightForBiome("mountains", x, z), t));
      biomeId = t > 0.45 ? "mountains" : "forest";
    } else if (factors.water <= 1.15 && factors.weirdness >= 1.15 && factors.weirdness <= 1.3 && factors.heat > 0.5) {
      const t = smoothstep(1.15, 1.3, factors.weirdness);
      landHeight = Math.round(lerp(this.heightForBiome("plains", x, z), this.heightForBiome("forest", x, z), t));
      biomeId = t > 0.5 ? "forest" : "plains";
    }

    if (factors.continental <= 0.16) {
      const t = smoothstep(0, 0.16, Math.max(0, factors.continental));
      landHeight = Math.round(lerp(this.heightForBiome("beach", x, z), landHeight, t));
      if (t < 0.5 && biomeId !== "ocean") biomeId = "beach";
    }

    let height = landHeight;
    if (factors.continental < -0.2) {
      height = seaHeight;
      biomeId = "ocean";
    } else if (factors.continental <= 0) {
      const t = smoothstep(-0.2, 0, factors.continental);
      height = Math.round(lerp(seaHeight, landHeight, t));
      if (t < 0.45) biomeId = "ocean";
      else if (height < SEA_LEVEL + 2) biomeId = "beach";
    }

    return {
      x,
      z,
      seed: this.seed,
      biomeId,
      biome: BIOME_DEFS[biomeId],
      factors,
      height,
      seaFloorHeight: seaHeight,
      landHeight
    };
  }

  surfaceBlock(column: BiomeColumn): number {
    if (column.height < SEA_LEVEL) {
      if (column.biomeId === "desert" || column.biomeId === "beach") {
        return BLOCK_REGISTRY.SAND;
      }
      return BLOCK_REGISTRY.GRAVEL;
    }
    switch (column.biomeId) {
      case "beach":
      case "desert":
        return BLOCK_REGISTRY.SAND;
      case "savanna":
        return BLOCK_REGISTRY.GRASS_YELLOW;
      case "iceplains":
        return BLOCK_REGISTRY.GRASS_SNOW;
      case "ice_mountains":
        return column.height > 92 ? BLOCK_REGISTRY.SNOW : BLOCK_REGISTRY.GRASS_SNOW;
      case "mountains":
        if (column.height > 118) return BLOCK_REGISTRY.SNOW;
        if (column.height > 92) return BLOCK_REGISTRY.STONE;
        return BLOCK_REGISTRY.GRASS;
      case "forest":
      case "plains":
      default:
        return BLOCK_REGISTRY.GRASS;
    }
  }

  subsurfaceBlock(column: BiomeColumn, surfaceBlock: number): number {
    if (surfaceBlock === BLOCK_REGISTRY.SAND && column.biomeId === "desert") {
      return BLOCK_REGISTRY.SANDSTONE;
    }
    if (surfaceBlock === BLOCK_REGISTRY.SAND) return BLOCK_REGISTRY.SAND;
    if (surfaceBlock === BLOCK_REGISTRY.GRAVEL) return BLOCK_REGISTRY.GRAVEL;
    if (surfaceBlock === BLOCK_REGISTRY.SNOW || surfaceBlock === BLOCK_REGISTRY.STONE) {
      return BLOCK_REGISTRY.STONE;
    }
    return BLOCK_REGISTRY.DIRT;
  }

  undergroundBlock(x: number, y: number, z: number): number {
    if (hash3(x, y, z, this.seed ^ 0x434f414c) < 0.012) return BLOCK_REGISTRY.COAL_ORE;
    if (y < 52 && hash3(x, y, z, this.seed ^ 0x49524f4e) < 0.007) return BLOCK_REGISTRY.IRON_ORE;
    if (y < 36 && hash3(x, y, z, this.seed ^ 0x474f4c44) < 0.004) return BLOCK_REGISTRY.GOLD_ORE;
    if (y < 28 && hash3(x, y, z, this.seed ^ 0x4449414d) < 0.002) return BLOCK_REGISTRY.DIAMOND_ORE;
    return BLOCK_REGISTRY.STONE;
  }

  waterBlock(column: BiomeColumn, y: number): number {
    if (isColdBiome(column.biomeId) && y === SEA_LEVEL) return BLOCK_REGISTRY.ICE;
    return BLOCK_REGISTRY.WATER;
  }

  decorationBlock(column: BiomeColumn, y: number): number {
    if (y !== column.height + 1 || column.height < SEA_LEVEL) return BLOCK_REGISTRY.AIR;
    const n = hash3(column.x, 2, column.z, this.seed ^ 0x464c5752);
    switch (column.biomeId) {
      case "desert":
        if (n < 0.01) return BLOCK_REGISTRY.DEADBUSH;
        return BLOCK_REGISTRY.AIR;
      case "savanna":
        if (n < 0.06) return BLOCK_REGISTRY.GRASS_PLANT_YELLOW;
        if (n < 0.075) return BLOCK_REGISTRY.DANDELION;
        return BLOCK_REGISTRY.AIR;
      case "forest":
        if (n < 0.035) return BLOCK_REGISTRY.GRASS_PLANT;
        if (n < 0.045) return BLOCK_REGISTRY.BROWN_MUSHROOM;
        if (n < 0.055) return BLOCK_REGISTRY.RED_MUSHROOM;
        return BLOCK_REGISTRY.AIR;
      case "plains":
        if (n < 0.045) return BLOCK_REGISTRY.GRASS_PLANT;
        if (n < 0.055) return BLOCK_REGISTRY.DANDELION;
        if (n < 0.065) return BLOCK_REGISTRY.ROSE;
        return BLOCK_REGISTRY.AIR;
      case "iceplains":
        if (n < 0.01) return BLOCK_REGISTRY.GRASS_PLANT;
        return BLOCK_REGISTRY.AIR;
      default:
        return BLOCK_REGISTRY.AIR;
    }
  }

  structureBlock(x: number, y: number, z: number, column: BiomeColumn): number {
    if (column.biomeId === "desert" && column.height >= SEA_LEVEL) {
      const n = hash3(x, 4, z, this.seed ^ 0x43414354);
      const cactusHeight = 2 + Math.floor(hash3(x, 5, z, this.seed ^ 0x43414354) * 3);
      if (n < 0.004 && y > column.height && y <= column.height + cactusHeight) {
        return BLOCK_REGISTRY.CACTUS;
      }
    }

    for (let dx = -5; dx <= 5; dx++) {
      for (let dz = -5; dz <= 5; dz++) {
        const tx = x + dx;
        const tz = z + dz;
        const trunkColumn = this.sampleColumn(tx, tz);
        if (trunkColumn.height < SEA_LEVEL || isOceanLike(trunkColumn.biomeId)) continue;
        const threshold = treeThresholdForBiome(trunkColumn.biomeId);
        if (threshold <= 0) continue;
        if (hash3(tx, 0, tz, this.seed ^ 0xbeef) >= threshold) continue;
        const kind = treeKindForBiome(
          trunkColumn.biomeId,
          hash3(tx, 7, tz, this.seed ^ 0xcafe)
        );
        if (!kind) continue;
        const block = treeBlockAt(
          x,
          y,
          z,
          tx,
          tz,
          trunkColumn.height,
          kind,
          Math.floor(hash3(tx, 1, tz, this.seed ^ 0xcafe) * 0xffffffff)
        );
        if (block !== BLOCK_REGISTRY.AIR) return block;
      }
    }
    return BLOCK_REGISTRY.AIR;
  }

  blockAt(x: number, y: number, z: number): number {
    if (y <= WORLD_MIN_Y) return BLOCK_REGISTRY.BEDROCK;

    const column = this.sampleColumn(x, z);
    if (y <= column.height) {
      const surface = this.surfaceBlock(column);
      if (y === column.height) return surface;
      if (y > column.height - 4) return this.subsurfaceBlock(column, surface);
      return this.undergroundBlock(x, y, z);
    }

    if (y <= SEA_LEVEL) return this.waterBlock(column, y);

    const structure = this.structureBlock(x, y, z, column);
    if (structure !== BLOCK_REGISTRY.AIR) return structure;

    return this.decorationBlock(column, y);
  }

  findSurfaceY(x: number, z: number): number {
    return this.sampleColumn(x, z).height;
  }

  isSpawnLocationSafe(x: number, z: number): boolean {
    const column = this.sampleColumn(x, z);
    if (column.height < SEA_LEVEL || isOceanLike(column.biomeId)) return false;
    const feet = column.height + 1;
    for (let y = feet; y <= feet + 3; y++) {
      if (this.blockAt(x, y, z) !== BLOCK_REGISTRY.AIR) return false;
    }
    return true;
  }
}

const GENERATORS = new Map<number, MultiBiomeGenerator>();

export function multiBiomeGenerator(seed: number): MultiBiomeGenerator {
  let generator = GENERATORS.get(seed);
  if (!generator) {
    generator = new MultiBiomeGenerator(seed);
    GENERATORS.set(seed, generator);
  }
  return generator;
}

/** Deterministic procedural block at (x,y,z). Shared by server and client. */
export function proceduralVoxelID(x: number, y: number, z: number, seed: number): number {
  return multiBiomeGenerator(seed).blockAt(x, y, z);
}

export function sampleBiomeColumn(x: number, z: number, seed: number): BiomeColumn {
  return multiBiomeGenerator(seed).sampleColumn(x, z);
}

export function findSurfaceY(x: number, z: number, seed: number): number {
  return multiBiomeGenerator(seed).findSurfaceY(x, z);
}

export function isSpawnLocationSafe(x: number, z: number, seed: number): boolean {
  return multiBiomeGenerator(seed).isSpawnLocationSafe(x, z);
}
