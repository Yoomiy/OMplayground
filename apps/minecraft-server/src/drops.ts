import { randomUUID } from "node:crypto";
import type { Server } from "socket.io";
import {
  PLACEABLE_BLOCK_IDS,
  REGISTERED_ITEM_IDS,
  type Vec3,
  type WorldDrop
} from "./protocol";
import {
  addBlockCount,
  addItemCount,
  maxAddableBlockCount,
  maxAddableItemCount
} from "./inventory";
import type { PlayerRuntime, VoxelRoom } from "./room";

/** Squared radius — player anchor is ~torso height (see `pickupAnchor`). */
export const MAGNET_RADIUS_SQ = 2.25 * 2.25;

function distSq(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  const dz = az - bz;
  return dx * dx + dy * dy + dz * dz;
}

function pickupAnchor(pos: Vec3): [number, number, number] {
  return [pos[0], pos[1] + 0.9, pos[2]];
}

export function listDropsWire(room: VoxelRoom): WorldDrop[] {
  return Array.from(room.drops.values());
}

export function spawnBlockDropAt(
  room: VoxelRoom,
  pos: Vec3,
  blockId: number,
  count: number
): WorldDrop | null {
  if (!PLACEABLE_BLOCK_IDS.includes(blockId) || count < 1) return null;
  const drop: WorldDrop = {
    id: randomUUID(),
    kind: "block",
    pos,
    blockId,
    count
  };
  room.drops.set(drop.id, drop);
  return drop;
}

export function spawnItemDropAt(
  room: VoxelRoom,
  pos: Vec3,
  itemId: number,
  count: number
): WorldDrop | null {
  if (!REGISTERED_ITEM_IDS.has(itemId) || count < 1) return null;
  const drop: WorldDrop = {
    id: randomUUID(),
    kind: "item",
    pos,
    itemId,
    count
  };
  room.drops.set(drop.id, drop);
  return drop;
}

export function clearDropsBroadcast(io: Server, room: VoxelRoom): void {
  if (room.drops.size === 0) return;
  const sessionId = room.sessionId;
  for (const id of room.drops.keys()) {
    io.to(`voxel:${sessionId}`).emit("ROOM_EVENT", {
      sessionId,
      kind: "WORLD_DROP_REMOVED",
      id
    });
  }
  room.drops.clear();
}

function emitInventorySyncToPlayer(
  io: Server,
  sessionId: string,
  userId: string,
  player: PlayerRuntime
): void {
  void (async () => {
    const inv = player.inventory;
    const items = player.itemInventory;
    const craft = player.craftingGrid;
    if (!inv || !items || !craft) return;
    const socks = await io.in(`voxel:${sessionId}`).fetchSockets();
    for (const s of socks) {
      if (s.data.userId === userId) {
        s.emit("INVENTORY_SYNC", {
          slots: inv,
          itemSlots: items,
          craftingSlots: craft
        });
        return;
      }
    }
  })();
}

function tryPickupDropForPlayer(
  io: Server,
  room: VoxelRoom,
  player: PlayerRuntime,
  dropId: string,
  drop: WorldDrop
): boolean {
  const sessionId = room.sessionId;
  const inv = player.inventory;
  const items = player.itemInventory;
  const craft = player.craftingGrid;
  if (!inv || !items || !craft) return false;

  if (drop.kind === "block") {
    if (!PLACEABLE_BLOCK_IDS.includes(drop.blockId)) return false;
    if (maxAddableBlockCount(inv, drop.blockId) < drop.count) return false;
    addBlockCount(inv, drop.blockId, drop.count);
  } else {
    if (!REGISTERED_ITEM_IDS.has(drop.itemId)) return false;
    if (maxAddableItemCount(items, drop.itemId) < drop.count) return false;
    addItemCount(items, drop.itemId, drop.count);
  }

  room.drops.delete(dropId);
  io.to(`voxel:${sessionId}`).emit("ROOM_EVENT", {
    sessionId,
    kind: "WORLD_DROP_REMOVED",
    id: dropId
  });
  emitInventorySyncToPlayer(io, sessionId, player.userId, player);
  return true;
}

export function tickMagnetPickups(io: Server, room: VoxelRoom): void {
  if ((room.gameMode ?? "creative") !== "survival") return;
  if (room.drops.size === 0) return;

  const pickedDropIds = new Set<string>();
  for (const player of room.players.values()) {
    const a = pickupAnchor(player.pos);
    for (const [id, drop] of room.drops) {
      if (pickedDropIds.has(id)) continue;
      if (
        distSq(a[0], a[1], a[2], drop.pos[0], drop.pos[1], drop.pos[2]) >
        MAGNET_RADIUS_SQ
      ) {
        continue;
      }
      if (tryPickupDropForPlayer(io, room, player, id, drop)) {
        pickedDropIds.add(id);
        break;
      }
    }
  }
}

export function dropPositionInFrontOfPlayer(player: PlayerRuntime): Vec3 {
  const h = player.heading;
  const dx = Math.sin(h) * 0.65;
  const dz = Math.cos(h) * 0.65;
  return [player.pos[0] + dx, player.pos[1] + 0.2, player.pos[2] + dz];
}

export function breakBlockDropPosition(x: number, y: number, z: number): Vec3 {
  return [x + 0.5, y + 0.2, z + 0.5];
}
