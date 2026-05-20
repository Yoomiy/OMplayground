import {
  applyDelta,
  createWorld,
  hydrateDeltas,
  isSpawnPointSafe,
  seedFromSessionId,
  serializeDeltas,
  spawnPointFor,
  type DeltaTuple,
  type WorldState
} from "./world";
import {
  cloneHotbar,
  cloneChest,
  cloneCraftingGrid,
  cloneEquipmentSlots,
  cloneItemInventory,
  createEmptyChest,
  createEmptyCraftingGrid,
  createEmptyEquipmentSlots,
  createEmptyHotbar,
  createEmptyItemInventory,
  craftingGridFromPersisted,
  chestFromPersisted,
  equipmentSlotsFromPersisted,
  hotbarFromPersisted,
  itemInventoryFromPersisted,
  spillExcessFromCraftingGrid,
  type CraftingGridState,
  type ChestState,
  type EquipmentSlotState,
  type HotbarState,
  type ItemInventoryState
} from "./inventory";
import {
  BLOCK_REGISTRY,
  type CraftingGridSlot,
  type ChestSlot,
  type GameMode,
  type HotbarSlot,
  type ItemSlot,
  type Vec3,
  type WorldDrop
} from "./protocol";
import type { ActiveBreak } from "./breakMining";
import { createActiveTnts, type ActiveTnt } from "./tnt";
import {
  assignVitals,
  createDefaultVitals,
  vitalsFromPersisted,
  type ActiveEating,
  type VitalsRuntime
} from "./vitals";

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
  /** Survival: 3×3 backing grid; personal crafting uses top-left 2×2. */
  craftingGrid?: CraftingGridState;
  /** Survival: dedicated equipment slots [head, chest, legs, feet]. */
  equipmentSlots?: EquipmentSlotState;
  /** Survival: 2 personal grid, 3 crafting table grid. */
  craftingGridWidth?: 2 | 3;
  /** Survival: in-progress timed block break. */
  activeBreak?: ActiveBreak;
  /** Selected survival hotbar index 0..8 (from INPUT). */
  selectedHotbarIndex?: number;
  health?: number;
  hunger?: number;
  saturation?: number;
  exhaustion?: number;
  lastVitalsAt?: number;
  lastRegenAt?: number;
  lastStarveAt?: number;
  lastHeliosRegenAt?: number;
  activeEating?: ActiveEating;
  /** Survival: currently open chest coordinate key, if locked by this player. */
  activeChestKey?: string;
  /** Rate-limit multiplayer arm-swing broadcasts. */
  lastArmSwingAt?: number;
  /** Rate-limit server-authoritative combat swings. */
  lastAttackAt?: number;
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
  disconnectedEquipmentSlots: Map<string, EquipmentSlotState>;
  disconnectedVitals: Map<string, VitalsRuntime>;
  /** Survival: persistent chest inventories keyed by "x,y,z". */
  chests: Map<string, ChestState>;
  /** Chest open locks keyed by chest coordinate, value = userId. */
  chestLocks: Map<string, string>;
  /** Set true when state changed since last tick emit. */
  dirty: boolean;
  /** ms timestamp of last emitted snapshot — used by coalescing in tick.ts. */
  lastTickAt: number;
  /** Survival: item stacks in the world (magnet pickup). */
  drops: Map<string, WorldDrop>;
  /** Survival: primed TNT waiting for its fuse to complete. */
  activeTnts: Map<string, ActiveTnt>;
  /** Last server weather mutation tick, e.g. freezing exposed water. */
  lastWeatherAt: number;
  /** Drops whose pos/stack changed — flushed as WORLD_DROP_UPDATE (~5 Hz). */
  dropSyncIds: Set<string>;
  lastDropBroadcastAt: number;
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
  equipmentSlots?: Record<string, ItemSlot[]>;
  vitals?: Record<string, VitalsRuntime>;
  chests?: Record<string, ChestSlot[]>;
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
    if (!existing.disconnectedEquipmentSlots) {
      existing.disconnectedEquipmentSlots = new Map();
    }
    if (!existing.disconnectedVitals) {
      existing.disconnectedVitals = new Map();
    }
    if (!existing.chests) {
      existing.chests = new Map();
    }
    if (!existing.chestLocks) {
      existing.chestLocks = new Map();
    }
    if (!existing.drops) {
      existing.drops = new Map();
    }
    if (!existing.dropSyncIds) {
      existing.dropSyncIds = new Set();
      existing.lastDropBroadcastAt = 0;
    }
    if (!existing.activeTnts) {
      existing.activeTnts = createActiveTnts();
    }
    existing.lastWeatherAt ??= 0;
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
  const disconnectedEquipmentSlots = new Map<string, EquipmentSlotState>();
  const disconnectedVitals = new Map<string, VitalsRuntime>();
  const chests = new Map<string, ChestState>();
  const emptyTemplate = createEmptyHotbar();
  const emptyChestTemplate = createEmptyChest();
  const emptyItemsTemplate = createEmptyItemInventory();
  const emptyCraftTemplate = createEmptyCraftingGrid();
  const emptyEquipmentTemplate = createEmptyEquipmentSlots();
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
  if (meta.resumedState?.equipmentSlots) {
    for (const [uid, raw] of Object.entries(meta.resumedState.equipmentSlots)) {
      disconnectedEquipmentSlots.set(
        uid,
        equipmentSlotsFromPersisted(raw, emptyEquipmentTemplate)
      );
    }
  }
  if (meta.resumedState?.vitals) {
    for (const [uid, raw] of Object.entries(meta.resumedState.vitals)) {
      disconnectedVitals.set(uid, vitalsFromPersisted(raw));
    }
  }
  if (meta.resumedState?.chests) {
    for (const [key, raw] of Object.entries(meta.resumedState.chests)) {
      chests.set(key, chestFromPersisted(raw, emptyChestTemplate));
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
    disconnectedEquipmentSlots,
    disconnectedVitals,
    chests,
    chestLocks: new Map(),
    dirty: false,
    lastTickAt: 0,
    drops: hydrateDropsFromPersisted(meta.resumedState?.drops),
    activeTnts: createActiveTnts(),
    lastWeatherAt: 0,
    dropSyncIds: new Set(),
    lastDropBroadcastAt: 0
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
  if (
    o.spawnedAt !== undefined &&
    (typeof o.spawnedAt !== "number" || !Number.isFinite(o.spawnedAt))
  ) {
    return false;
  }
  for (const k of ["vx", "vy", "vz"] as const) {
    const v = o[k];
    if (v !== undefined && (typeof v !== "number" || !Number.isFinite(v))) {
      return false;
    }
  }
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

function makeSpawnPointSafe(room: VoxelRoom, point: Vec3): Vec3 {
  if (isSpawnPointSafe(room.world, point)) return point;
  const x = Math.floor(point[0]);
  const y = Math.floor(point[1]);
  const z = Math.floor(point[2]);
  applyDelta(room.world, x, y - 2, z, BLOCK_REGISTRY.GRASS);
  for (let yy = y - 1; yy <= y + 2; yy++) {
    applyDelta(room.world, x, yy, z, BLOCK_REGISTRY.AIR);
  }
  room.dirty = true;
  return point;
}

export function spawnFor(room: VoxelRoom, userId: string): Vec3 {
  const cached = room.spawnPoints.get(userId);
  if (cached && isSpawnPointSafe(room.world, cached)) return cached;
  if (cached) room.spawnPoints.delete(userId);
  const pt = makeSpawnPointSafe(room, spawnPointFor(room.world.seed, userId));
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
    lastInputAt: now,
    selectedHotbarIndex: 0
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
    player.craftingGridWidth = 2;
    room.disconnectedCraftingGrids.delete(userId);
    const cachedEquipment = room.disconnectedEquipmentSlots.get(userId);
    player.equipmentSlots = cachedEquipment
      ? cloneEquipmentSlots(cachedEquipment)
      : createEmptyEquipmentSlots();
    room.disconnectedEquipmentSlots.delete(userId);
    const cachedVitals = room.disconnectedVitals.get(userId);
    assignVitals(player, cachedVitals ?? createDefaultVitals(now));
    room.disconnectedVitals.delete(userId);
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
  if (leaving?.equipmentSlots) {
    r.disconnectedEquipmentSlots.set(
      userId,
      cloneEquipmentSlots(leaving.equipmentSlots)
    );
  }
  const vitals = runtimeVitalsFromPlayer(leaving);
  if (vitals) {
    r.disconnectedVitals.set(userId, vitals);
  }
  for (const [key, holder] of r.chestLocks) {
    if (holder === userId) r.chestLocks.delete(key);
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
  const equipmentSlots: Record<string, ItemSlot[]> = {};
  const vitals: Record<string, VitalsRuntime> = {};
  const chests: Record<string, ChestSlot[]> = {};
  if ((room.gameMode ?? "creative") === "survival") {
    for (const p of room.players.values()) {
      if (p.inventory) inventories[p.userId] = cloneHotbar(p.inventory);
      if (p.itemInventory) {
        itemInventories[p.userId] = cloneItemInventory(p.itemInventory);
      }
      if (p.craftingGrid) {
        craftingGrids[p.userId] = cloneCraftingGrid(p.craftingGrid);
      }
      if (p.equipmentSlots) {
        equipmentSlots[p.userId] = cloneEquipmentSlots(p.equipmentSlots);
      }
      const playerVitals = runtimeVitalsFromPlayer(p);
      if (playerVitals) vitals[p.userId] = playerVitals;
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
    for (const [uid, equipment] of room.disconnectedEquipmentSlots) {
      if (!(uid in equipmentSlots)) {
        equipmentSlots[uid] = cloneEquipmentSlots(equipment);
      }
    }
    for (const [uid, cachedVitals] of room.disconnectedVitals) {
      if (!(uid in vitals)) {
        vitals[uid] = cachedVitals;
      }
    }
    for (const [key, slots] of room.chests) {
      chests[key] = cloneChest(slots);
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
    ...(Object.keys(equipmentSlots).length > 0 ? { equipmentSlots } : {}),
    ...(Object.keys(vitals).length > 0 ? { vitals } : {}),
    ...(Object.keys(chests).length > 0 ? { chests } : {}),
    ...((room.gameMode ?? "creative") === "survival" && room.drops.size > 0
      ? { drops: Array.from(room.drops.values()) }
      : {})
  };
}

function runtimeVitalsFromPlayer(
  player: PlayerRuntime | undefined
): VitalsRuntime | null {
  if (!player || player.health === undefined) return null;
  const defaults = createDefaultVitals();
  return {
    health: player.health,
    hunger: player.hunger ?? defaults.hunger,
    saturation: player.saturation ?? defaults.saturation,
    exhaustion: player.exhaustion ?? defaults.exhaustion,
    lastVitalsAt: player.lastVitalsAt ?? defaults.lastVitalsAt,
    lastRegenAt: player.lastRegenAt ?? defaults.lastRegenAt,
    lastStarveAt: player.lastStarveAt ?? defaults.lastStarveAt,
    lastHeliosRegenAt: player.lastHeliosRegenAt ?? defaults.lastHeliosRegenAt
  };
}

/** Test-only: drop every room from the in-memory map. */
export function __resetRoomsForTest(): void {
  rooms.clear();
}
