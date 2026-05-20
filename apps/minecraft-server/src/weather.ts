import {
  BLOCK_REGISTRY,
  SEA_LEVEL,
  precipitationKindForColumn,
  sampleBiomeColumn
} from "@playground/voxel-content";
import type { Vec3 } from "./protocol";
import type { VoxelRoom } from "./room";
import { applyDelta, getVoxelID, type WorldState } from "./world";

export const WEATHER_FREEZE_INTERVAL_MS = 8000;
export const WEATHER_FREEZE_ATTEMPTS_PER_PLAYER = 8;
export const WEATHER_FREEZE_RADIUS = 18;

const SKY_TRANSPARENT_BLOCKS = new Set<number>([
  BLOCK_REGISTRY.AIR,
  BLOCK_REGISTRY.LEAVES,
  BLOCK_REGISTRY.BIRCH_LEAVES,
  BLOCK_REGISTRY.SPRUCE_LEAVES,
  BLOCK_REGISTRY.LEAVES_YELLOW,
  BLOCK_REGISTRY.GLASS,
  BLOCK_REGISTRY.WHITE_STAINED_GLASS,
  BLOCK_REGISTRY.YELLOW_STAINED_GLASS,
  BLOCK_REGISTRY.RED_STAINED_GLASS,
  BLOCK_REGISTRY.PURPLE_STAINED_GLASS,
  BLOCK_REGISTRY.PINK_STAINED_GLASS,
  BLOCK_REGISTRY.ORANGE_STAINED_GLASS,
  BLOCK_REGISTRY.MAGENTA_STAINED_GLASS,
  BLOCK_REGISTRY.LIME_STAINED_GLASS,
  BLOCK_REGISTRY.LIGHT_BLUE_STAINED_GLASS,
  BLOCK_REGISTRY.GREEN_STAINED_GLASS,
  BLOCK_REGISTRY.GRAY_STAINED_GLASS,
  BLOCK_REGISTRY.CYAN_STAINED_GLASS,
  BLOCK_REGISTRY.BROWN_STAINED_GLASS,
  BLOCK_REGISTRY.BLUE_STAINED_GLASS,
  BLOCK_REGISTRY.BLACK_STAINED_GLASS,
  BLOCK_REGISTRY.ICE
]);

export interface WeatherFreezeDelta {
  pos: Vec3;
  blockId: number;
}

export function hasOpenSkyAt(world: WorldState, x: number, startY: number, z: number): boolean {
  for (let y = startY; y <= 256; y++) {
    if (!SKY_TRANSPARENT_BLOCKS.has(getVoxelID(world, x, y, z))) return false;
  }
  return true;
}

export function freezeSurfaceWaterIfCold(world: WorldState, x: number, z: number): boolean {
  const column = sampleBiomeColumn(x, z, world.seed);
  if (precipitationKindForColumn(column) !== "snow") return false;
  if (getVoxelID(world, x, SEA_LEVEL, z) !== BLOCK_REGISTRY.WATER) return false;
  if (!hasOpenSkyAt(world, x, SEA_LEVEL + 1, z)) return false;
  applyDelta(world, x, SEA_LEVEL, z, BLOCK_REGISTRY.ICE);
  return true;
}

export function tickWeatherFreezing(
  room: VoxelRoom,
  now: number,
  random: () => number = Math.random
): WeatherFreezeDelta[] {
  if (now - (room.lastWeatherAt ?? 0) < WEATHER_FREEZE_INTERVAL_MS) return [];
  room.lastWeatherAt = now;
  const deltas: WeatherFreezeDelta[] = [];
  for (const player of room.players.values()) {
    const baseX = Math.floor(player.pos[0]);
    const baseZ = Math.floor(player.pos[2]);
    for (let i = 0; i < WEATHER_FREEZE_ATTEMPTS_PER_PLAYER; i++) {
      const x = baseX + Math.floor(random() * (WEATHER_FREEZE_RADIUS * 2 + 1)) -
        WEATHER_FREEZE_RADIUS;
      const z = baseZ + Math.floor(random() * (WEATHER_FREEZE_RADIUS * 2 + 1)) -
        WEATHER_FREEZE_RADIUS;
      if (!freezeSurfaceWaterIfCold(room.world, x, z)) continue;
      deltas.push({ pos: [x, SEA_LEVEL, z], blockId: BLOCK_REGISTRY.ICE });
    }
  }
  if (deltas.length > 0) room.dirty = true;
  return deltas;
}
