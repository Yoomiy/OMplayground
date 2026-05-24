import { BLOCK_REGISTRY, blockBreakable } from "@playground/voxel-content";
import { applyPlayerDamage } from "./perks";
import type { PlayerRuntime, VoxelRoom } from "./room";
import {
  applyDelta,
  getVoxelID,
  replacementBlockAfterBreak,
  type WorldState
} from "./world";
import type { Vec3 } from "./protocol";

export const TNT_FUSE_MS = 4000;
export const TNT_EXPLOSION_RADIUS = 4;
export const TNT_DAMAGE_RADIUS = 6;
export const TNT_MAX_DAMAGE = 18;
export const TNT_MAX_KNOCKBACK = 15;

export interface ActiveTnt {
  id: string;
  pos: Vec3;
  primedAt: number;
  explodeAt: number;
  by: string;
}

export interface TntExplosionResult {
  blockDeltas: { pos: Vec3; blockId: number; destroyedBlockId: number }[];
  playerDamage: { player: PlayerRuntime; amount: number; impulse: Vec3 }[];
}

export function tntKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

export function createActiveTnts(): Map<string, ActiveTnt> {
  return new Map();
}

export function primeTnt(
  room: VoxelRoom,
  pos: Vec3,
  userId: string,
  now = Date.now()
): ActiveTnt | null {
  const [x, y, z] = pos.map((n) => Math.floor(n)) as Vec3;
  if (getVoxelID(room.world, x, y, z) !== BLOCK_REGISTRY.TNT) return null;
  const key = tntKey(x, y, z);
  const existing = room.activeTnts.get(key);
  if (existing) return existing;
  const tnt: ActiveTnt = {
    id: key,
    pos: [x, y, z],
    primedAt: now,
    explodeAt: now + TNT_FUSE_MS,
    by: userId
  };
  room.activeTnts.set(key, tnt);
  applyDelta(room.world, x, y, z, replacementBlockAfterBreak(room.world, x, y, z));
  room.dirty = true;
  return tnt;
}

export function applyTntExplosion(
  room: VoxelRoom,
  tnt: ActiveTnt
): TntExplosionResult {
  const [cx, cy, cz] = tnt.pos;
  const blockDeltas: TntExplosionResult["blockDeltas"] = [];
  for (let x = cx - TNT_EXPLOSION_RADIUS; x <= cx + TNT_EXPLOSION_RADIUS; x++) {
    for (let y = cy - TNT_EXPLOSION_RADIUS; y <= cy + TNT_EXPLOSION_RADIUS; y++) {
      for (let z = cz - TNT_EXPLOSION_RADIUS; z <= cz + TNT_EXPLOSION_RADIUS; z++) {
        const dx = x + 0.5 - (cx + 0.5);
        const dy = y + 0.5 - (cy + 0.5);
        const dz = z + 0.5 - (cz + 0.5);
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist > TNT_EXPLOSION_RADIUS) continue;
        const blockId = getVoxelID(room.world, x, y, z);
        if (!tntBreaksBlock(room.world, x, y, z, blockId)) continue;
        const replacement = replacementBlockAfterBreak(room.world, x, y, z);
        applyDelta(room.world, x, y, z, replacement);
        blockDeltas.push({
          pos: [x, y, z],
          blockId: replacement,
          destroyedBlockId: blockId
        });
      }
    }
  }

  const playerDamage: TntExplosionResult["playerDamage"] = [];
  for (const player of room.players.values()) {
    const dx = player.pos[0] - (cx + 0.5);
    const dy = player.pos[1] + 0.9 - (cy + 0.5);
    const dz = player.pos[2] - (cz + 0.5);
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist > TNT_DAMAGE_RADIUS) continue;
    const exposure = Math.max(0, 1 - dist / TNT_DAMAGE_RADIUS);
    const raw = Math.floor(TNT_MAX_DAMAGE * exposure);
    const amount = applyPlayerDamage(player, Math.max(1, raw), "explosion");
    if (amount > 0) {
      const safeDist = Math.max(dist, 0.35);
      const knockback = exposure * TNT_MAX_KNOCKBACK;
      playerDamage.push({
        player,
        amount,
        impulse: [
          (dx / safeDist) * knockback,
          (dy / safeDist) * knockback,
          (dz / safeDist) * knockback
        ]
      });
    }
  }

  room.activeTnts.delete(tnt.id);
  if (blockDeltas.length > 0 || playerDamage.length > 0) room.dirty = true;
  return { blockDeltas, playerDamage };
}

function tntBreaksBlock(
  world: WorldState,
  x: number,
  y: number,
  z: number,
  blockId: number
): boolean {
  if (blockId === BLOCK_REGISTRY.AIR || blockId === BLOCK_REGISTRY.WATER) return false;
  if (
    blockId === BLOCK_REGISTRY.BEDROCK ||
    blockId === BLOCK_REGISTRY.BARRIER ||
    blockId === BLOCK_REGISTRY.OBSIDIAN
  ) {
    return false;
  }
  if (!blockBreakable(blockId) && blockId !== BLOCK_REGISTRY.TNT) return false;
  return getVoxelID(world, x, y, z) === blockId;
}
