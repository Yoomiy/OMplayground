import {
  BLOCK_REGISTRY,
  ITEM_REGISTRY,
  itemPerkSpec
} from "@playground/voxel-content";
import { hasEquipped } from "./inventory";
import type { PlayerRuntime } from "./room";
import { getVoxelID, type WorldState } from "./world";
import { MAX_HEALTH } from "./vitals";

export const HELIOS_REGEN_INTERVAL_MS = 3000;
export const VOXEL_DAY_LENGTH_MS = 20 * 60 * 1000;

const TRANSPARENT_SKY_BLOCKS = new Set<number>([
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

export type DamageSource = "generic" | "fall" | "combat" | "explosion" | "suffocation";

export function isVoxelDaytime(nowMs: number): boolean {
  const phase =
    ((Math.floor(nowMs) % VOXEL_DAY_LENGTH_MS) + VOXEL_DAY_LENGTH_MS) %
    VOXEL_DAY_LENGTH_MS;
  return phase < VOXEL_DAY_LENGTH_MS * 0.55;
}

export function hasOpenSky(world: WorldState, player: PlayerRuntime): boolean {
  const x = Math.floor(player.pos[0]);
  const z = Math.floor(player.pos[2]);
  const startY = Math.max(-64, Math.floor(player.pos[1] + 1.7));
  for (let y = startY; y <= 256; y++) {
    if (!TRANSPARENT_SKY_BLOCKS.has(getVoxelID(world, x, y, z))) {
      return false;
    }
  }
  return true;
}

export function tickHeliosRegen(
  player: PlayerRuntime,
  world: WorldState,
  nowMs: number
): boolean {
  if (player.health === undefined) return false;
  if (
    !hasEquipped(player.equipmentSlots, ITEM_REGISTRY.HELIOS_MEDALLION) ||
    !isVoxelDaytime(nowMs) ||
    !hasOpenSky(world, player)
  ) {
    player.lastHeliosRegenAt = nowMs;
    return false;
  }
  if (player.health >= MAX_HEALTH) {
    player.lastHeliosRegenAt = nowMs;
    return false;
  }
  const last = Number.isFinite(player.lastHeliosRegenAt)
    ? player.lastHeliosRegenAt!
    : nowMs;
  if (nowMs - last < HELIOS_REGEN_INTERVAL_MS) return false;
  player.health = Math.min(MAX_HEALTH, player.health + 1);
  player.lastHeliosRegenAt = nowMs;
  return true;
}

export function applyPlayerDamage(
  player: PlayerRuntime,
  amount: number,
  source: DamageSource = "generic"
): number {
  if (player.health === undefined) return 0;
  let finalDamage = Math.max(0, amount);
  if (finalDamage <= 0) return 0;

  if (
    source === "fall" &&
    hasEquipped(player.equipmentSlots, ITEM_REGISTRY.FEATHER_FALLING_TALISMAN)
  ) {
    return 0;
  }

  if (hasEquipped(player.equipmentSlots, ITEM_REGISTRY.HEAVY_SHIELD)) {
    const reduction =
      itemPerkSpec(ITEM_REGISTRY.HEAVY_SHIELD)?.damageReduction ?? 0;
    finalDamage *= Math.max(0, 1 - reduction);
  }

  player.health = Math.max(0, player.health - finalDamage);
  return finalDamage;
}

export function applyFallDamage(player: PlayerRuntime, velocityY: number): number {
  const speed = Math.abs(Math.min(0, velocityY));
  if (speed <= 12) return 0;
  return applyPlayerDamage(player, Math.floor((speed - 12) * 1.5), "fall");
}
