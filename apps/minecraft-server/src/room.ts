import {
  createWorld,
  hydrateDeltas,
  seedFromSessionId,
  serializeDeltas,
  spawnPointFor,
  type DeltaTuple,
  type WorldState
} from "./world";
import {
  cloneHotbar,
  cloneCraftingGrid,
  cloneItemInventory,
  createEmptyCraftingGrid,
  createEmptyHotbar,
  createEmptyItemInventory,
  craftingGridFromPersisted,
  hotbarFromPersisted,
  itemInventoryFromPersisted,
  spillExcessFromCraftingGrid,
  type CraftingGridState,
  type HotbarState,
  type ItemInventoryState
} from "./inventory";
import type {
  CraftingGridSlot,
  GameMode,
  HotbarSlot,
  ItemSlot,
  Vec3,
  WorldDrop
} from "./protocol";

/**
 * In-memory voxel-room registry. Mirrors the structure of
 * apps/game-server/src/room.ts but the state is voxel-shaped (sparse
 * block map + per-player position) instead of a turn-based snapshot.
 *
 * Per-session isolation is structural: `rooms` keys by sessionId and
 * every emit goes through `voxel:${sessionId}` (see index.ts).
 */

export interface RoomPlayer {
  userId: string;
  displayName: string;
}

export interface PlayerRuntime extends RoomPlayer {
  pos: Vec3;
  heading: number;
  /** Camera pitch in radians. Used only for avatar head rendering. */
  pitch: number;
  jumping: boolean;
  /** Last client INPUT timestamp (ms). Forwarded in snapshots for client interp. */
  t: number;
  /** Server time of the last write — used by tick coalescing. */
  lastInputAt: number;
  /** Set only in survival mode — authoritative hotbar for pause/resume. */
  inventory?: HotbarState;
  /** Survival: main storage for non-placeable items. */
  itemInventory?: ItemInventoryState;
  /** Survival: 2×2 crafting grid (blocks + items). */
  craftingGrid?: CraftingGridState;
}

export interface VoxelRoom {
  sessionId: string;
  gameId: string;
  gender: "boy" | "girl";
  hostId: string;
  minPlayers: number;
  maxPlayers: number;
  world: WorldState;
  players: Map<string, PlayerRuntime>;
  /** Persisted participant roster for resumed/paused games. */
  roster: RoomPlayer[];
  spawnPoints: Map<string, Vec3>;
  paused: boolean;
  /** Defaults to creative when omitted (legacy in-memory rooms). */
  gameMode?: GameMode;
  /** Survival inventories for roster members not currently connected. */
  disconnectedInventories: Map<string, HotbarState>;
  disconnectedItemInventories: Map<string, ItemInventoryState>;
  disconnectedCraftingGrids: Map<string, CraftingGridState>;
  /** Set true when state changed since last tick emit. */
  dirty: boolean;
  /** ms timestamp of last emitted snapshot — used by coalescing in tick.ts. */
  lastTickAt: number;
  /** Survival: item stacks in the world (magnet pickup). */
  drops: Map<string, WorldDrop>;
}

const rooms = new Map<string, VoxelRoom>();

export interface CreateRoomMeta {
  gameId: string;
  gender: "boy" | "girl";
  hostId: string;
  minPlayers: number;
  maxPlayers: number;
  roster: RoomPlayer[];
  paused: boolean;
  /** game_sessions.game_state for paused rows; replays seed + deltas. */
  resumedState?: PersistedRoomState | null;
}

export interface PersistedRoomState {
  voxel: true;
  seed: number;
  deltas: DeltaTuple[];
  spawnPoints: Record<string, Vec3>;
  gameMode?: GameMode;
  inventories?: Record<string, HotbarSlot[]>;
  itemInventories?: Record<string, ItemSlot[]>;
  craftingGrids?: Record<string, CraftingGridSlot[]>;
  drops?: WorldDrop[];
}

export function getRoom(sessionId: string): VoxelRoom | undefined {
  return rooms.get(sessionId);
}

export function listRooms(): VoxelRoom[] {
  return Array.from(rooms.values());
}

export function deleteRoom(sessionId: string): void {
  rooms.delete(sessionId);
}

export function getOrCreateRoom(
  sessionId: string,
  meta: CreateRoomMeta
): VoxelRoom {
  const existing = rooms.get(sessionId);
  if (existing) {
    if (meta.paused) existing.paused = true;
    if (meta.roster.length > 0) existing.roster = meta.roster;
    if (!existing.disconnectedInventories) {
      existing.disconnectedInventories = new Map();
    }
    if (!existing.disconnectedItemInventories) {
      existing.disconnectedItemInventories = new Map();
    }
    if (!existing.disconnectedCraftingGrids) {
      existing.disconnectedCraftingGrids = new Map();
    }
    if (!existing.drops) {
      existing.drops = new Map();
    }
    return existing;
  }
  const seed = meta.resumedState?.seed ?? seedFromSessionId(sessionId);
  const world = createWorld(seed);
  if (meta.resumedState?.deltas?.length) {
    hydrateDeltas(world, meta.resumedState.deltas);
  }
  const spawnPoints = new Map<string, Vec3>();
  if (meta.resumedState?.spawnPoints) {
    for (const [uid, pt] of Object.entries(meta.resumedState.spawnPoints)) {
      spawnPoints.set(uid, pt);
    }
  }
  const disconnectedInventories = new Map<string, HotbarState>();
  const disconnectedItemInventories = new Map<string, ItemInventoryState>();
  const disconnectedCraftingGrids = new Map<string, CraftingGridState>();
  const emptyTemplate = createEmptyHotbar();
  const emptyItemsTemplate = createEmptyItemInventory();
  const emptyCraftTemplate = createEmptyCraftingGrid();
  if (meta.resumedState?.inventories) {
    for (const [uid, raw] of Object.entries(meta.resumedState.inventories)) {
      disconnectedInventories.set(
        uid,
        hotbarFromPersisted(raw, emptyTemplate)
      );
    }
  }
  if (meta.resumedState?.itemInventories) {
    for (const [uid, raw] of Object.entries(meta.resumedState.itemInventories)) {
      disconnectedItemInventories.set(
        uid,
        itemInventoryFromPersisted(raw, emptyItemsTemplate)
      );
    }
  }
  if (meta.resumedState?.craftingGrids) {
    for (const [uid, raw] of Object.entries(meta.resumedState.craftingGrids)) {
      disconnectedCraftingGrids.set(
        uid,
        craftingGridFromPersisted(raw, emptyCraftTemplate)
      );
    }
  }
  for (const [uid, grid] of disconnectedCraftingGrids) {
    if (!disconnectedInventories.has(uid)) {
      disconnectedInventories.set(uid, cloneHotbar(emptyTemplate));
    }
    if (!disconnectedItemInventories.has(uid)) {
      disconnectedItemInventories.set(uid, cloneItemInventory(emptyItemsTemplate));
    }
    spillExcessFromCraftingGrid(
      grid,
      disconnectedInventories.get(uid)!,
      disconnectedItemInventories.get(uid)!
    );
  }
  const created: VoxelRoom = {
    sessionId,
    gameId: meta.gameId,
    gender: meta.gender,
    hostId: meta.hostId,
    minPlayers: meta.minPlayers,
    maxPlayers: meta.maxPlayers,
    world,
    players: new Map(),
    roster: meta.roster,
    spawnPoints,
    paused: meta.paused,
    gameMode: meta.resumedState?.gameMode ?? "creative",
    disconnectedInventories,
    disconnectedItemInventories,
    disconnectedCraftingGrids,
    dirty: false,
    lastTickAt: 0,
    drops: hydrateDropsFromPersisted(meta.resumedState?.drops)
  };
  rooms.set(sessionId, created);
  return created;
}

function hydrateDropsFromPersisted(raw: WorldDrop[] | undefined): Map<string, WorldDrop> {
  const m = new Map<string, WorldDrop>();
  if (!raw?.length) return m;
  for (const d of raw) {
    if (!isPersistedWorldDrop(d)) continue;
    m.set(d.id, d);
  }
  return m;
}

function isPersistedWorldDrop(d: unknown): d is WorldDrop {
  if (!d || typeof d !== "object") return false;
  const o = d as Record<string, unknown>;
  if (typeof o.id !== "string" || (o.kind !== "block" && o.kind !== "item")) return false;
  if (!Array.isArray(o.pos) || o.pos.length !== 3) return false;
  for (const n of o.pos) {
    if (typeof n !== "number" || !Number.isFinite(n)) return false;
  }
  if (typeof o.count !== "number" || o.count < 1 || !Number.isFinite(o.count)) return false;
  if (o.kind === "block") {
    return typeof o.blockId === "number" && Number.isFinite(o.blockId);
  }
  return typeof o.itemId === "number" && Number.isFinite(o.itemId);
}

export function roomRoster(room: VoxelRoom): RoomPlayer[] {
  const merged = new Map<string, RoomPlayer>();
  for (const p of room.roster) merged.set(p.userId, p);
  for (const p of room.players.values()) {
    merged.set(p.userId, { userId: p.userId, displayName: p.displayName });
  }
  return Array.from(merged.values());
}

export function connectedPlayers(room: VoxelRoom): RoomPlayer[] {
  return Array.from(room.players.values()).map((p) => ({
    userId: p.userId,
    displayName: p.displayName
  }));
}

export function spawnFor(room: VoxelRoom, userId: string): Vec3 {
  const cached = room.spawnPoints.get(userId);
  if (cached) return cached;
  const pt = spawnPointFor(room.world.seed, userId);
  room.spawnPoints.set(userId, pt);
  return pt;
}

export function assignPlayer(
  room: VoxelRoom,
  userId: string,
  displayName: string
): { player: PlayerRuntime } | { error: { code: string; message: string } } {
  const existing = room.players.get(userId);
  if (existing) return { player: existing };
  if (room.players.size >= room.maxPlayers) {
    return {
      error: { code: "ROOM_FULL", message: "Session is full" }
    };
  }
  const spawn = spawnFor(room, userId);
  const now = Date.now();
  const player: PlayerRuntime = {
    userId,
    displayName,
    pos: spawn,
    heading: 0,
    pitch: 0,
    jumping: false,
    t: now,
    lastInputAt: now
  };
  if ((room.gameMode ?? "creative") === "survival") {
    const cached = room.disconnectedInventories.get(userId);
    player.inventory = cached
      ? cloneHotbar(cached)
      : createEmptyHotbar();
    room.disconnectedInventories.delete(userId);
    const cachedItems = room.disconnectedItemInventories.get(userId);
    player.itemInventory = cachedItems
      ? cloneItemInventory(cachedItems)
      : createEmptyItemInventory();
    room.disconnectedItemInventories.delete(userId);
    const cachedCraft = room.disconnectedCraftingGrids.get(userId);
    player.craftingGrid = cachedCraft
      ? cloneCraftingGrid(cachedCraft)
      : createEmptyCraftingGrid();
    room.disconnectedCraftingGrids.delete(userId);
    if (player.inventory && player.itemInventory && player.craftingGrid) {
      spillExcessFromCraftingGrid(
        player.craftingGrid,
        player.inventory,
        player.itemInventory
      );
    }
  }
  room.players.set(userId, player);
  if (!room.roster.some((p) => p.userId === userId)) {
    room.roster.push({ userId, displayName });
  }
  room.dirty = true;
  return { player };
}

export function removePlayerFromRoom(
  sessionId: string,
  userId: string
): { newHostId?: string; roomEmpty: boolean } {
  const r = rooms.get(sessionId);
  if (!r) return { roomEmpty: true };
  const wasHost = r.hostId === userId;
  const leaving = r.players.get(userId);
  if (leaving?.inventory) {
    r.disconnectedInventories.set(userId, cloneHotbar(leaving.inventory));
  }
  if (leaving?.itemInventory) {
    r.disconnectedItemInventories.set(
      userId,
      cloneItemInventory(leaving.itemInventory)
    );
  }
  if (leaving?.craftingGrid) {
    r.disconnectedCraftingGrids.set(
      userId,
      cloneCraftingGrid(leaving.craftingGrid)
    );
  }
  r.players.delete(userId);
  r.dirty = true;
  if (r.players.size === 0) {
    rooms.delete(sessionId);
    return { roomEmpty: true };
  }
  if (wasHost) {
    const nextHost = r.players.keys().next().value as string;
    r.hostId = nextHost;
    return { newHostId: nextHost, roomEmpty: false };
  }
  return { roomEmpty: false };
}

export function canStopGame(
  room: VoxelRoom,
  userId: string
): { ok: true } | { ok: false; error: { code: string; message: string } } {
  if (!room.players.has(userId)) {
    return {
      ok: false,
      error: { code: "NOT_IN_ROOM", message: "השחקן לא נמצא בחדר" }
    };
  }
  if (room.hostId !== userId) {
    return {
      ok: false,
      error: { code: "NOT_HOST", message: "רק המארח יכול לבצע את הפעולה" }
    };
  }
  return { ok: true };
}

export function snapshotPersistedState(room: VoxelRoom): PersistedRoomState {
  const spawnPoints: Record<string, Vec3> = {};
  for (const [uid, pt] of room.spawnPoints) spawnPoints[uid] = pt;
  const inventories: Record<string, HotbarSlot[]> = {};
  const itemInventories: Record<string, ItemSlot[]> = {};
  const craftingGrids: Record<string, CraftingGridSlot[]> = {};
  if ((room.gameMode ?? "creative") === "survival") {
    for (const p of room.players.values()) {
      if (p.inventory) inventories[p.userId] = cloneHotbar(p.inventory);
      if (p.itemInventory) {
        itemInventories[p.userId] = cloneItemInventory(p.itemInventory);
      }
      if (p.craftingGrid) {
        craftingGrids[p.userId] = cloneCraftingGrid(p.craftingGrid);
      }
    }
    for (const [uid, hotbar] of room.disconnectedInventories) {
      if (!(uid in inventories)) inventories[uid] = cloneHotbar(hotbar);
    }
    for (const [uid, items] of room.disconnectedItemInventories) {
      if (!(uid in itemInventories)) {
        itemInventories[uid] = cloneItemInventory(items);
      }
    }
    for (const [uid, cg] of room.disconnectedCraftingGrids) {
      if (!(uid in craftingGrids)) {
        craftingGrids[uid] = cloneCraftingGrid(cg);
      }
    }
  }
  return {
    voxel: true,
    seed: room.world.seed,
    deltas: serializeDeltas(room.world),
    spawnPoints,
    gameMode: room.gameMode ?? "creative",
    ...(Object.keys(inventories).length > 0 ? { inventories } : {}),
    ...(Object.keys(itemInventories).length > 0 ? { itemInventories } : {}),
    ...(Object.keys(craftingGrids).length > 0 ? { craftingGrids } : {}),
    ...((room.gameMode ?? "creative") === "survival" && room.drops.size > 0
      ? { drops: Array.from(room.drops.values()) }
      : {})
  };
}

/** Test-only: drop every room from the in-memory map. */
export function __resetRoomsForTest(): void {
  rooms.clear();
}
