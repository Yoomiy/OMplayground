import {
  createEmptyCraftingGrid,
  createEmptyEquipmentSlots,
  createEmptyHotbar,
  createEmptyItemInventory
} from "./inventory";
import type { WorldDrop } from "./protocol";
import { BLOCK_REGISTRY } from "./protocol";
import type { PlayerRuntime, VoxelRoom } from "./room";
import { spawnFor } from "./room";
import {
  scatterImpulseBreakDrop,
  spawnBlockDropAt,
  spawnItemDropAt
} from "./drops";
import { assignVitals, createDefaultVitals } from "./vitals";
import { getVoxelID, type WorldState } from "./world";
import { applyPlayerDamage } from "./perks";

export const SUFFOCATION_INTERVAL_MS = 500;

const NON_SUFFOCATING_BLOCKS = new Set<number>([
  BLOCK_REGISTRY.AIR,
  BLOCK_REGISTRY.WATER,
  BLOCK_REGISTRY.SAPLING,
  BLOCK_REGISTRY.DANDELION,
  BLOCK_REGISTRY.ROSE,
  BLOCK_REGISTRY.BROWN_MUSHROOM,
  BLOCK_REGISTRY.RED_MUSHROOM,
  BLOCK_REGISTRY.DEADBUSH,
  BLOCK_REGISTRY.GRASS_PLANT_YELLOW,
  BLOCK_REGISTRY.GRASS_PLANT,
  BLOCK_REGISTRY.LADDER,
  BLOCK_REGISTRY.TORCH
]);

export interface PlayerDeathResult {
  deathPos: [number, number, number];
  respawnPos: [number, number, number];
  drops: WorldDrop[];
}

export function isSuffocatingBlockId(blockId: number): boolean {
  return !NON_SUFFOCATING_BLOCKS.has(blockId);
}

export function applySuffocationDamage(
  world: WorldState,
  player: PlayerRuntime,
  now: number
): number {
  if (player.health === undefined) return 0;
  const last = Number.isFinite(player.lastSuffocationAt)
    ? player.lastSuffocationAt!
    : 0;
  if (now - last < SUFFOCATION_INTERVAL_MS) return 0;
  const x = Math.floor(player.pos[0]);
  const y = Math.floor(player.pos[1] + 1.5);
  const z = Math.floor(player.pos[2]);
  if (!isSuffocatingBlockId(getVoxelID(world, x, y, z))) return 0;
  player.lastSuffocationAt = now;
  return applyPlayerDamage(player, 1, "suffocation");
}

export function handlePlayerDeath(
  room: VoxelRoom,
  player: PlayerRuntime,
  now = Date.now()
): PlayerDeathResult {
  const deathPos = [...player.pos] as [number, number, number];
  const drops: WorldDrop[] = [];

  const spawnBlock = (blockId: number, count: number): void => {
    if (blockId === BLOCK_REGISTRY.AIR || count <= 0) return;
    const spawned = spawnBlockDropAt(room, deathDropPos(deathPos), blockId, count, {
      ...scatterImpulseBreakDrop()
    });
    if (spawned) drops.push(spawned);
  };
  const spawnItem = (itemId: number, count: number): void => {
    if (itemId <= 0 || count <= 0) return;
    const spawned = spawnItemDropAt(room, deathDropPos(deathPos), itemId, count, {
      ...scatterImpulseBreakDrop()
    });
    if (spawned) drops.push(spawned);
  };

  for (const cell of player.inventory ?? []) {
    if (!cell || cell.count <= 0) continue;
    if ((cell.itemId ?? 0) > 0) spawnItem(cell.itemId, cell.count);
    else spawnBlock(cell.blockId, cell.count);
  }
  for (const cell of player.itemInventory ?? []) {
    if (!cell || cell.count <= 0) continue;
    spawnItem(cell.itemId, cell.count);
  }
  for (const cell of player.equipmentSlots ?? []) {
    if (!cell || cell.count <= 0) continue;
    spawnItem(cell.itemId, cell.count);
  }
  for (const cell of player.craftingGrid ?? []) {
    if (!cell || cell.count <= 0) continue;
    if ((cell.itemId ?? 0) > 0) spawnItem(cell.itemId, cell.count);
    else spawnBlock(cell.blockId, cell.count);
  }

  player.inventory = createEmptyHotbar();
  player.itemInventory = createEmptyItemInventory();
  player.equipmentSlots = createEmptyEquipmentSlots();
  player.craftingGrid = createEmptyCraftingGrid();
  player.craftingGridWidth = 2;
  player.activeBreak = undefined;
  player.activeEating = undefined;
  assignVitals(player, createDefaultVitals(now));
  player.pos = spawnFor(room, player.userId);
  player.heading = 0;
  player.pitch = 0;
  player.jumping = false;
  player.t = now;
  player.lastInputAt = now;
  player.lastSuffocationAt = now;
  player.lastDeathAt = now;
  room.dirty = true;

  return {
    deathPos,
    respawnPos: [...player.pos] as [number, number, number],
    drops
  };
}

function deathDropPos(pos: [number, number, number]): [number, number, number] {
  const theta = Math.random() * Math.PI * 2;
  const radius = 0.25 + Math.random() * 0.55;
  return [
    pos[0] + Math.sin(theta) * radius,
    pos[1] + 0.45,
    pos[2] + Math.cos(theta) * radius
  ];
}
