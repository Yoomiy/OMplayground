import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

import http from "http";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import {
  auditMetadata,
  createObservabilityContext,
  fetchLiveKitVoiceStats,
  initObservability,
  logSocketAuthenticated,
  logSocketEvent,
  correlationMiddleware,
  mountLiveKitWebhook
} from "@playground/observability";
import { Server } from "socket.io";
import { createClient } from "@supabase/supabase-js";
import {
  applyToolWear,
  blockPlacementHeight,
  blockReplaceable,
  isGrassPlantBlock,
  isLeavesBlock,
  itemFoodSpec,
  melonSliceDropCount,
  rollGrassForagingDrop,
  rollGravelDrop,
  rollLeavesBonusDrop,
  sugarCaneMayPlaceOn,
  usesCustomSurvivalBreakDrops
} from "@playground/voxel-content";
import { isWithinRecess } from "./recess";
import {
  applyDelta,
  getVoxelID,
  replacementBlockAfterBreak,
  serializeDeltas
} from "./world";
import {
  applyInventoryMove,
  blockBreakable,
  blockDropId,
  blockDropsPickable,
  cloneChest,
  cloneCraftingGrid,
  cloneEquipmentSlots,
  cloneHotbar,
  cloneItemInventory,
  consumeOneFromHotbarIndex,
  consumeOneIfPresent,
  createEmptyChest,
  createEmptyCraftingGrid,
  createEmptyEquipmentSlots,
  createEmptyHotbar,
  createEmptyItemInventory,
  isPersonalCraftingIndex,
  returnInactiveCraftingSlotsToInventory,
  tryCraftFromGrid,
  HOTBAR_SLOT_COUNT
} from "./inventory";
import {
  assignPlayer,
  canStopGame,
  connectedPlayers,
  deleteRoom,
  getOrCreateRoom,
  getRoom,
  listRooms,
  removePlayerFromRoom,
  roomRoster,
  snapshotPersistedState,
  spawnFor,
  type PersistedRoomState
} from "./room";
import { startTickLoop } from "./tick";
import {
  persistGamePaused,
  persistGameResumed,
  persistGameStopped,
  persistPlayerJoin,
  persistPlayerLeave
} from "./sessionPersistence";
import {
  createRecessSweepState,
  recessEndSweep
} from "./recessSweep";
import {
  generateLiveKitToken,
  LiveKitTokenError
} from "./livekitService";
import {
  beginBreak,
  cancelBreak,
  finishBreak,
  shouldUseTimedBreak
} from "./breakMining";
import {
  clearDropsBroadcast,
  dropPositionInFrontOfPlayer,
  jitterBreakSpawnPosition,
  listDropsWire,
  scatterImpulseBreakDrop,
  spawnBlockDropAt,
  spawnItemDropAt,
  tickMagnetPickups,
  tickWorldDrops,
  throwImpulseForPlayer,
  thrownDropPositionInFrontOfPlayer
} from "./drops";
import {
  BLOCK_REGISTRY,
  ITEM_REGISTRY,
  MAX_REACH,
  PLACEABLE_BLOCK_IDS,
  type ArmSwingPayload,
  type BlockBreakReq,
  type BlockPlaceReq,
  type BreakCancelReq,
  type BreakFinishReq,
  type BreakStartAck,
  type BreakStartReq,
  type CraftAck,
  type CraftReq,
  type ChestSyncPayload,
  type GameMode,
  type IgniteTntReq,
  type InputReq,
  type InventoryMoveReq,
  type DropItemReq,
  type EatReq,
  type EatStartAck,
  type FallImpactReq,
  type JoinRoomAck,
  type OpenCraftingTableReq,
  type OpenChestAck,
  type OpenChestReq,
  type PlayerAttackReq,
  type PlayerDamagePayload,
  type SetGameModeReq,
  type SimpleAck,
  type Vec3
} from "./protocol";
import type { PlayerRuntime, VoxelRoom } from "./room";
import {
  addMiningExhaustion,
  addMovementExhaustion,
  applyFood,
  assignVitals,
  cloneVitals,
  createDefaultVitals,
  EAT_FINISH_TOLERANCE_MS,
  EATING_DURATION_MS,
  MAX_HEALTH,
  MAX_HUNGER,
  tickVitals
} from "./vitals";
import {
  applyFallDamage,
  applyPlayerDamage,
  heldWeaponDamage,
  tickHeliosRegen
} from "./perks";
import { applyTntExplosion, primeTnt, TNT_EXPLOSION_RADIUS } from "./tnt";
import { tickWeatherFreezing } from "./weather";
import { applySuffocationDamage, handlePlayerDeath } from "./death";

const PORT = Number(process.env.PORT ?? 8081);
const ARM_SWING_COOLDOWN_MS = 150;
const PLAYER_ATTACK_COOLDOWN_MS = 500;
const PLAYER_ATTACK_REACH = 3.75;
const CORS_ORIGIN =
  process.env.CORS_ORIGIN ??
  "http://localhost:5173,http://127.0.0.1:5173";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const LIVEKIT_URL = process.env.LIVEKIT_URL ?? "";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY ?? "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET ?? "";

const tokenDenialLog = new Map<string, number[]>();
const TOKEN_DENIAL_WINDOW_MS = 5 * 60_000;
const TOKEN_DENIAL_THRESHOLD = 5;

function exitIfInvalidSupabaseUrlForClient(): void {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;
  const u = SUPABASE_URL.trim();
  if (!/^https?:\/\//i.test(u)) {
    process.stderr.write(
      "[minecraft-server] SUPABASE_URL must include the scheme, e.g. https://YOUR_PROJECT.supabase.co\n" +
        `  Got: ${JSON.stringify(u)} (check apps/minecraft-server/.env)\n`
    );
    process.exit(1);
  }
  try {
    new URL(u);
  } catch {
    process.stderr.write(
      "[minecraft-server] SUPABASE_URL is not a valid URL. Fix apps/minecraft-server/.env\n"
    );
    process.exit(1);
  }
}

exitIfInvalidSupabaseUrlForClient();

const observabilityEarly = createObservabilityContext("minecraft-server");
let logger = observabilityEarly.logger;
let stats = observabilityEarly.stats;

const app = express();
app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: CORS_ORIGIN.split(",").map((s) => s.trim()),
    credentials: true
  })
);
app.use(correlationMiddleware());
if (LIVEKIT_API_KEY && LIVEKIT_API_SECRET) {
  mountLiveKitWebhook(app, {
    logger,
    stats,
    apiKey: LIVEKIT_API_KEY,
    apiSecret: LIVEKIT_API_SECRET
  });
}
app.use(express.json());

const httpLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(httpLimiter);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN.split(",").map((s) => s.trim()),
    credentials: true
  }
});

const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      })
    : null;

function trackTokenDenial(key: string): boolean {
  const now = Date.now();
  const hits = (tokenDenialLog.get(key) ?? []).filter(
    (t) => now - t <= TOKEN_DENIAL_WINDOW_MS
  );
  hits.push(now);
  tokenDenialLog.set(key, hits);
  return hits.length >= TOKEN_DENIAL_THRESHOLD;
}

app.post("/rtc/token", async (req, res) => {
  const correlationId = (req as express.Request & { correlationId?: string })
    .correlationId;
  try {
    const accessToken = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    const sessionId = (req.body as { sessionId?: string })?.sessionId;
    if (!accessToken || !sessionId) {
      res.status(400).json({ error: "missing_params" });
      return;
    }
    if (!supabaseAdmin) {
      res.status(503).json({ error: "server_config" });
      return;
    }
    const result = await generateLiveKitToken({
      supabaseAdmin,
      accessToken,
      sessionId
    });
    logger.info({
      correlationId,
      userId: result.userId,
      sessionId,
      protocol: "http",
      message: "LiveKit token issued",
      context: {
        event: "RTC_TOKEN_ISSUED",
        livekitRoom: result.livekitRoom,
        status: "success"
      }
    });
    res.json({ token: result.token, serverUrl: result.serverUrl });
  } catch (err) {
    const sessionId = (req.body as { sessionId?: string })?.sessionId;
    const denialKey = `${req.ip ?? "unknown"}:${sessionId ?? "none"}`;
    const reason =
      err instanceof LiveKitTokenError ? err.reason : "unauthorized";
    const abuse = trackTokenDenial(denialKey);
    logger.warn({
      correlationId,
      sessionId,
      protocol: "http",
      message: "LiveKit token denied",
      context: {
        event: "RTC_TOKEN_DENIED",
        reason,
        status: "failed",
        repeatedDenials: abuse
      }
    });
    if (abuse && supabaseAdmin && sessionId) {
      void supabaseAdmin.from("audit_log").insert({
        actor_id: null,
        actor_kind: "system",
        action: "rtc_token_abuse",
        entity_type: "game_session",
        entity_id: sessionId,
        metadata: auditMetadata(correlationId, { reason, ip: req.ip })
      });
    }
    const status = reason === "server_config" ? 503 : 401;
    res.status(status).json({
      error: reason,
      message: err instanceof Error ? err.message : "unauthorized"
    });
  }
});

const wiredObservability = initObservability(app, io, {
  service: "minecraft-server",
  supabaseAdmin,
  logger,
  stats,
  skipCorrelation: true,
  listRooms: () =>
    listRooms().map((room) => ({
      sessionId: room.sessionId,
      gameType: "voxel",
      playerCount: connectedPlayers(room).length
    })),
  voiceStats: () =>
    fetchLiveKitVoiceStats(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
});
logger = wiredObservability.logger;
stats = wiredObservability.stats;

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "playground-minecraft-server" });
});

app.get("/ready", (_req, res) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    res.status(503).json({ ok: false, reason: "missing_env" });
    return;
  }
  res.json({ ok: true });
});

let recessCache: {
  rows: { day_of_week: number; start_time: string; end_time: string; is_active: boolean }[];
  fetchedAt: number;
} = { rows: [], fetchedAt: 0 };

async function loadRecessSchedules() {
  if (!supabaseAdmin) throw new Error("missing_supabase_admin");
  const now = Date.now();
  if (now - recessCache.fetchedAt < 60_000) {
    return recessCache.rows;
  }
  const { data, error } = await supabaseAdmin
    .from("recess_schedules")
    .select("day_of_week, start_time, end_time, is_active")
    .eq("is_active", true);
  if (error) {
    logger.error({ message: "recess_schedules fetch failed", error: error.message });
    throw new Error("recess_schedules_unavailable");
  }
  recessCache = { rows: data ?? [], fetchedAt: now };
  return recessCache.rows;
}

io.use(async (socket, next) => {
  try {
    const token =
      (socket.handshake.auth as { token?: string }).token ??
      socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) {
      next(new Error("UNAUTHORIZED"));
      return;
    }
    if (!supabaseAdmin) {
      next(new Error("SERVER_CONFIG"));
      return;
    }
    const { data: authData, error: authErr } =
      await supabaseAdmin.auth.getUser(token);
    if (authErr || !authData?.user?.id) {
      next(new Error("UNAUTHORIZED"));
      return;
    }
    const { data: profile, error } = await supabaseAdmin
      .from("kid_profiles")
      .select("id, role, gender, full_name, is_active")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (error || !profile || !profile.is_active) {
      next(new Error("FORBIDDEN"));
      return;
    }
    if (profile.role === "kid") {
      try {
        const schedules = await loadRecessSchedules();
        if (!isWithinRecess(new Date(), schedules)) {
          next(new Error("RECESS_DENIED"));
          return;
        }
      } catch (err) {
        logger.warn({
          message: "recess gate failed",
          error: err instanceof Error ? err.message : String(err)
        });
        next(new Error("RECESS_DENIED"));
        return;
      }
    }
    socket.data.userId = profile.id as string;
    socket.data.displayName = profile.full_name as string;
    socket.data.role = profile.role as string;
    socket.data.gender = profile.gender as "boy" | "girl";
    logSocketAuthenticated(logger, socket);
    next();
  } catch {
    next(new Error("UNAUTHORIZED"));
  }
});

function vecDist(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function blockIntersectsPlayer(
  pos: Vec3,
  x: number,
  y: number,
  z: number,
  blockId: number
): boolean {
  const blockMinX = x;
  const blockMaxX = x + 1;
  const blockMinY = y;
  const blockMaxY = y + blockPlacementHeight(blockId);
  const blockMinZ = z;
  const blockMaxZ = z + 1;

  const playerMinX = pos[0] - 0.35;
  const playerMaxX = pos[0] + 0.35;
  const playerMinY = pos[1];
  const playerMaxY = pos[1] + 1.8;
  const playerMinZ = pos[2] - 0.35;
  const playerMaxZ = pos[2] + 0.35;

  return (
    blockMinX < playerMaxX &&
    blockMaxX > playerMinX &&
    blockMinY < playerMaxY &&
    blockMaxY > playerMinY &&
    blockMinZ < playerMaxZ &&
    blockMaxZ > playerMinZ
  );
}

function isFiniteVec(v: unknown): v is Vec3 {
  return (
    Array.isArray(v) &&
    v.length === 3 &&
    Number.isFinite(v[0]) &&
    Number.isFinite(v[1]) &&
    Number.isFinite(v[2])
  );
}

function isGameMode(v: unknown): v is GameMode {
  return v === "creative" || v === "survival";
}

function inventorySyncPayload(player: PlayerRuntime) {
  return {
    slots: player.inventory ?? [],
    itemSlots: player.itemInventory,
    equipmentSlots: player.equipmentSlots,
    craftingSlots: player.craftingGrid,
    craftingGridWidth: player.craftingGridWidth ?? 2,
    ...(player.health !== undefined ? { vitals: cloneVitals(player) } : {})
  };
}

function playerDamagePayload(
  player: PlayerRuntime,
  amount: number,
  source: PlayerDamagePayload["source"],
  impulse?: Vec3
): PlayerDamagePayload {
  return {
    userId: player.userId,
    health: cloneVitals(player).health,
    amount,
    source,
    ...(impulse ? { impulse } : {})
  };
}

function checkAndHandlePlayerDeath(
  room: VoxelRoom,
  player: PlayerRuntime,
  now = Date.now()
): boolean {
  if (player.health === undefined || player.health > 0) return false;

  const { deathPos, respawnPos, drops } = handlePlayerDeath(room, player, now);

  io.to(`voxel:${room.sessionId}`).emit("ROOM_EVENT", {
    sessionId: room.sessionId,
    kind: "PLAYER_DEATH",
    userId: player.userId,
    deathPos
  });
  void insertSystemChatMessage(room.sessionId, `${player.displayName} מת`);

  for (const drop of drops) {
    io.to(`voxel:${room.sessionId}`).emit("ROOM_EVENT", {
      sessionId: room.sessionId,
      kind: "WORLD_DROP_SPAWNED",
      drop
    });
  }

  io.to(`voxel:${room.sessionId}`).emit("ROOM_EVENT", {
    sessionId: room.sessionId,
    kind: "PLAYER_RESPAWN",
    userId: player.userId,
    respawnPos
  });
  void insertSystemChatMessage(room.sessionId, `${player.displayName} נולד מחדש`);

  io.to(`voxel-user:${player.userId}:${room.sessionId}`).emit(
    "INVENTORY_SYNC",
    inventorySyncPayload(player)
  );

  return true;
}

function chestKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

function chestKeyFromPos(pos: Vec3): string {
  return chestKey(Math.floor(pos[0]), Math.floor(pos[1]), Math.floor(pos[2]));
}

function chestPosFromKey(key: string): Vec3 | null {
  const parts = key.split(",").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  return [parts[0]!, parts[1]!, parts[2]!];
}

function getOrCreateChest(room: VoxelRoom, key: string) {
  let chest = room.chests.get(key);
  if (!chest) {
    chest = createEmptyChest();
    room.chests.set(key, chest);
  }
  return chest;
}

function chestSyncPayload(key: string, slots: ReturnType<typeof cloneChest>): ChestSyncPayload {
  const pos = chestPosFromKey(key) ?? [0, 0, 0];
  return { pos, slots };
}

function applyHeldItemWear(player: PlayerRuntime, itemId: number): boolean {
  if (!player.inventory) return false;
  const hotbarIndex = player.selectedHotbarIndex ?? 0;
  const cell = player.inventory[hotbarIndex];
  if (!cell || cell.itemId !== itemId || cell.count <= 0) return false;
  const wear = applyToolWear(itemId, cell.durability);
  if (wear.broken) {
    player.inventory[hotbarIndex] = {
      blockId: BLOCK_REGISTRY.AIR,
      itemId: 0,
      count: 0
    };
    return true;
  }
  player.inventory[hotbarIndex] = {
    blockId: BLOCK_REGISTRY.AIR,
    itemId,
    count: 1,
    ...(wear.durability !== undefined ? { durability: wear.durability } : {})
  };
  return true;
}

function executeBlockBreak(
  room: VoxelRoom,
  player: PlayerRuntime,
  userId: string,
  sessionId: string,
  x: number,
  y: number,
  z: number,
  brokenId: number
): void {
  if (
    (room.gameMode ?? "survival") === "survival" &&
    player.health !== undefined &&
    addMiningExhaustion(player)
  ) {
    room.dirty = true;
  }
  if ((room.gameMode ?? "survival") === "survival" && brokenId === BLOCK_REGISTRY.CHEST) {
    const key = chestKey(x, y, z);
    const chest = room.chests.get(key);
    if (chest) {
      for (const cell of chest) {
        if (!cell || cell.count <= 0) continue;
        const pos = jitterBreakSpawnPosition(x, y, z);
        const impulse = scatterImpulseBreakDrop();
        const spawned =
          (cell.itemId ?? 0) > 0
            ? spawnItemDropAt(room, pos, cell.itemId, cell.count, impulse)
            : cell.blockId !== BLOCK_REGISTRY.AIR
              ? spawnBlockDropAt(room, pos, cell.blockId, cell.count, impulse)
              : null;
        if (spawned) {
          io.to(`voxel:${sessionId}`).emit("ROOM_EVENT", {
            sessionId,
            kind: "WORLD_DROP_SPAWNED",
            drop: spawned
          });
        }
      }
      room.chests.delete(key);
    }
    room.chestLocks.delete(key);
    for (const p of room.players.values()) {
      if (p.activeChestKey === key) delete p.activeChestKey;
    }
    io.to(`voxel:${sessionId}`).emit("ROOM_EVENT", {
      sessionId,
      kind: "CHEST_CLOSED",
      pos: [x, y, z]
    });
  }
  const replacementBlockId = replacementBlockAfterBreak(room.world, x, y, z);
  applyDelta(room.world, x, y, z, replacementBlockId);
  if (
    (room.gameMode ?? "survival") === "survival" &&
    player.inventory &&
    player.itemInventory &&
    player.craftingGrid
  ) {
    const dropPos = jitterBreakSpawnPosition(x, y, z);
    if (usesCustomSurvivalBreakDrops(brokenId) || isLeavesBlock(brokenId)) {
      spawnSurvivalBreakDrops(room, sessionId, brokenId, dropPos);
    } else if (blockDropsPickable(brokenId)) {
      const dropId = blockDropId(brokenId);
      if (dropId !== null) {
        const spawned = spawnBlockDropAt(room, dropPos, dropId, 1, {
          ...scatterImpulseBreakDrop()
        });
        if (spawned) {
          io.to(`voxel:${sessionId}`).emit("ROOM_EVENT", {
            sessionId,
            kind: "WORLD_DROP_SPAWNED",
            drop: spawned
          });
        }
      }
    }
  }
  io.to(`voxel:${sessionId}`).emit("BLOCK_DELTA", {
    pos: [x, y, z],
    blockId: replacementBlockId,
    by: userId
  });
}

function emitBreakBonusDrop(
  room: VoxelRoom,
  sessionId: string,
  pos: Vec3,
  bonus: { kind: "item" | "block"; id: number; count: number }
): void {
  const impulse = scatterImpulseBreakDrop();
  const spawned =
    bonus.kind === "item"
      ? spawnItemDropAt(room, pos, bonus.id, bonus.count, impulse)
      : spawnBlockDropAt(room, pos, bonus.id, bonus.count, impulse);
  if (spawned) {
    io.to(`voxel:${sessionId}`).emit("ROOM_EVENT", {
      sessionId,
      kind: "WORLD_DROP_SPAWNED",
      drop: spawned
    });
  }
}

function spawnSurvivalBreakDrops(
  room: VoxelRoom,
  sessionId: string,
  brokenId: number,
  pos: Vec3
): void {
  if (brokenId === BLOCK_REGISTRY.GRAVEL) {
    const bonus = rollGravelDrop(Math.random());
    emitBreakBonusDrop(room, sessionId, pos, bonus);
    return;
  }
  if (brokenId === BLOCK_REGISTRY.MELON) {
    const count = melonSliceDropCount(Math.random());
    emitBreakBonusDrop(room, sessionId, pos, {
      kind: "item",
      id: ITEM_REGISTRY.MELON_SLICE,
      count
    });
    return;
  }
  if (isGrassPlantBlock(brokenId)) {
    const bonus = rollGrassForagingDrop(Math.random());
    if (bonus) emitBreakBonusDrop(room, sessionId, pos, bonus);
    return;
  }
  if (isLeavesBlock(brokenId)) {
    const dropId = blockDropId(brokenId);
    if (dropId !== null) {
      const spawned = spawnBlockDropAt(room, pos, dropId, 1, scatterImpulseBreakDrop());
      if (spawned) {
        io.to(`voxel:${sessionId}`).emit("ROOM_EVENT", {
          sessionId,
          kind: "WORLD_DROP_SPAWNED",
          drop: spawned
        });
      }
    }
    const bonus = rollLeavesBonusDrop(Math.random());
    if (bonus) emitBreakBonusDrop(room, sessionId, pos, bonus);
  }
}

type BreakTarget =
  | {
      ok: true;
      room: VoxelRoom;
      player: PlayerRuntime;
      sessionId: string;
      x: number;
      y: number;
      z: number;
      blockId: number;
    }
  | { ok: false; ack: SimpleAck };

function resolveBreakTarget(
  userId: string,
  sessionId: string | undefined,
  pos: unknown,
  roomLookup: (id: string) => VoxelRoom | undefined
): BreakTarget {
  if (!sessionId) {
    return {
      ok: false,
      ack: { ok: false, error: { code: "NOT_IN_ROOM", message: "לא בחדר" } }
    };
  }
  const room = roomLookup(sessionId);
  if (!room) {
    return {
      ok: false,
      ack: { ok: false, error: { code: "NOT_FOUND", message: "Room not loaded" } }
    };
  }
  if (room.paused) {
    return {
      ok: false,
      ack: { ok: false, error: { code: "GAME_PAUSED", message: "המשחק מושהה" } }
    };
  }
  const player = room.players.get(userId);
  if (!player) {
    return {
      ok: false,
      ack: { ok: false, error: { code: "NOT_IN_ROOM", message: "השחקן לא נמצא בחדר" } }
    };
  }
  if (!isFiniteVec(pos)) {
    return {
      ok: false,
      ack: { ok: false, error: { code: "BAD_INTENT", message: "Invalid coordinates" } }
    };
  }
  const [x, y, z] = (pos as Vec3).map((n) => Math.floor(Number(n))) as Vec3;
  if (vecDist(player.pos, [x + 0.5, y + 0.5, z + 0.5]) > MAX_REACH) {
    return {
      ok: false,
      ack: { ok: false, error: { code: "OUT_OF_REACH", message: "רחוק מדי" } }
    };
  }
  const blockId = getVoxelID(room.world, x, y, z);
  if (blockId === BLOCK_REGISTRY.AIR) {
    return {
      ok: false,
      ack: { ok: false, error: { code: "BLOCK_EMPTY", message: "אין שם בלוק" } }
    };
  }
  if (!blockBreakable(blockId)) {
    return {
      ok: false,
      ack: {
        ok: false,
        error: { code: "UNBREAKABLE_BLOCK", message: "אי אפשר לשבור את הבלוק הזה" }
      }
    };
  }
  return { ok: true, room, player, sessionId, x, y, z, blockId };
}

async function emitInventoryToSurvivalPlayers(
  sessionId: string,
  room: ReturnType<typeof getRoom>
): Promise<void> {
  if (!room || (room.gameMode ?? "survival") !== "survival") return;
  const socks = await io.in(`voxel:${sessionId}`).fetchSockets();
  for (const s of socks) {
    const uid = s.data.userId as string | undefined;
    if (!uid) continue;
    const p = room.players.get(uid);
    if (p?.inventory && p.itemInventory && p.craftingGrid && p.equipmentSlots) {
      s.emit("INVENTORY_SYNC", inventorySyncPayload(p));
    }
  }
}

io.on("connection", (socket) => {
  const originalOn = socket.on.bind(socket);
  socket.on = (event: string, listener: (...args: any[]) => void | Promise<void>) => {
    return originalOn(event, async (...args: any[]) => {
      const started = Date.now();
      const ack = typeof args[args.length - 1] === "function" ? args[args.length - 1] : undefined;
      try {
        const result = listener(...args);
        if (result instanceof Promise) {
          await result;
        }
      } catch (err) {
        const sessionId = (args[0] as { sessionId?: string })?.sessionId ?? (socket.data.sessionId as string | undefined);
        logger.error({
          correlationId: socket.data.correlationId,
          userId: socket.data.userId,
          sessionId,
          protocol: "socket",
          message: `Socket handler ${event} threw`,
          context: {
            event,
            status: "failed",
            duration_ms: Date.now() - started
          },
          error: err instanceof Error ? err.message : String(err)
        });
        stats.recordIntentFailed();
        if (ack) {
          try {
            ack({ ok: false, error: { code: "INTERNAL", message: "Internal server error" } });
          } catch {
            // ignore
          }
        }
      }
    });
  };

  const userId = socket.data.userId as string;
  const displayName = socket.data.displayName as string;
  const gender = socket.data.gender as "boy" | "girl";

  function wrapAck<T>(
    event: string,
    started: number,
    sessionId: string | undefined,
    ack?: (r: T) => void
  ): ((r: T) => void) | undefined {
    if (!ack) return undefined;
    return (result: T) => {
      const outcome = result as { ok?: boolean; error?: { code?: string } };
      logSocketEvent(logger, stats, "minecraft-server", socket, event, {
        ok: outcome.ok !== false,
        code: outcome.error?.code,
        sessionId,
        durationMs: Date.now() - started
      });
      ack(result);
    };
  }

  socket.on(
    "JOIN_ROOM",
    async (
      payload: { sessionId: string },
      ack?: (r: JoinRoomAck) => void
    ) => {
      const started = Date.now();
      const sessionId = payload?.sessionId;
      const reply = wrapAck("JOIN_ROOM", started, sessionId, ack);
      if (!sessionId) {
        reply?.({
          ok: false,
          error: { code: "BAD_REQUEST", message: "sessionId required" }
        });
        return;
      }
      const prevSessionId = socket.data.sessionId as string | undefined;
      if (prevSessionId && prevSessionId !== sessionId) {
        await handleLeave(prevSessionId);
      }
      if (!supabaseAdmin) {
        reply?.({
          ok: false,
          error: { code: "SERVER_CONFIG", message: "Supabase not configured" }
        });
        return;
      }
      const { data: session, error } = await supabaseAdmin
        .from("game_sessions")
        .select(
          "id, game_id, gender, player_ids, player_names, host_id, status, game_state, is_open, games ( game_url, min_players, max_players )"
        )
        .eq("id", sessionId)
        .maybeSingle();
      if (error || !session) {
        reply?.({
          ok: false,
          error: { code: "NOT_FOUND", message: "Session not found" }
        });
        return;
      }
      if ((session.gender as string) !== gender) {
        reply?.({
          ok: false,
          error: { code: "GENDER_MISMATCH", message: "Wrong gender partition" }
        });
        return;
      }
      const gameRow = (session as {
        games?: {
          game_url?: string;
          min_players?: number;
          max_players?: number;
        } | null;
      }).games;
      if (gameRow?.game_url !== "minecraft") {
        reply?.({
          ok: false,
          error: {
            code: "GAME_UNSUPPORTED",
            message: "החדר אינו של מיינקראפט"
          }
        });
        return;
      }
      const sess = session as { status?: string; game_state?: unknown };
      const playerIds = ((session.player_ids as string[]) ?? []).map(String);
      const playerNames = ((session.player_names as string[]) ?? []).map(
        String
      );
      const joinRole = socket.data.role as string;
      const hostId = String(session.host_id ?? "");
      const isOpen = (session as { is_open?: boolean }).is_open !== false;
      if (
        !isOpen &&
        joinRole !== "teacher" &&
        !playerIds.includes(userId) &&
        hostId !== userId
      ) {
        reply?.({
          ok: false,
          error: {
            code: "SESSION_CLOSED",
            message: "החדר סגור — נדרשת הזמנה"
          }
        });
        return;
      }
      if (sess.status === "paused" && !playerIds.includes(userId)) {
        reply?.({
          ok: false,
          error: {
            code: "NOT_IN_ROSTER",
            message: "רק שחקני המשחק המקורי יכולים להמשיך משחק מושהה"
          }
        });
        return;
      }
      if (sess.status === "completed") {
        reply?.({
          ok: false,
          error: { code: "SESSION_COMPLETED", message: "המשחק כבר הסתיים" }
        });
        return;
      }
      const existingRoom = getRoom(sessionId);
      const resumedState =
        sess.status === "paused" && sess.game_state != null
          ? (sess.game_state as PersistedRoomState)
          : null;
      const room = getOrCreateRoom(sessionId, {
        gameId: session.game_id as string,
        gender,
        hostId: session.host_id as string,
        minPlayers: gameRow?.min_players ?? 1,
        maxPlayers: gameRow?.max_players ?? 8,
        roster: playerIds.map((id, i) => ({
          userId: id,
          displayName: playerNames[i] ?? "שחקן"
        })),
        paused: sess.status === "paused",
        resumedState
      });
      if (!existingRoom) {
        stats.onRoomCreated(sessionId, "voxel");
      }
      const wasAlreadyInRoom = room.players.has(userId);
      const assigned = assignPlayer(room, userId, displayName, socket.data.role === "teacher");
      if ("error" in assigned) {
        reply?.({ ok: false, error: assigned.error });
        return;
      }
      await socket.join(`voxel:${sessionId}`);
      await socket.join(`voxel-user:${userId}:${sessionId}`);
      if (socket.data.role === "teacher") {
        await socket.join(`voxel-snapshot-teacher:${sessionId}`);
      } else {
        await socket.join(`voxel-snapshot:${sessionId}`);
      }
      socket.data.sessionId = sessionId;
      void persistPlayerJoin({
        supabase: supabaseAdmin,
        sessionId,
        session: {
          player_ids: playerIds,
          player_names: playerNames,
          status: (sess.status as MinimalStatus | undefined) ?? "waiting"
        },
        userId,
        displayName,
        connectedPlayerIds: connectedPlayers(room).map((p) => p.userId),
        connectedPlayerNames: connectedPlayers(room).map((p) => p.displayName),
        roomStatusIsIdle: false
      });
      io.to(`voxel:${sessionId}`).emit("ROOM_EVENT", {
        sessionId,
        kind: "PLAYER_JOINED",
        player: { userId, displayName }
      });
      if (!wasAlreadyInRoom) {
        void insertSystemChatMessage(sessionId, `${displayName} הצטרף למשחק`);
      }
      const effectiveMode = room.gameMode ?? "survival";
      reply?.({
        ok: true,
        seed: room.world.seed,
        deltas: serializeDeltas(room.world),
        roster: roomRoster(room),
        hostId: room.hostId,
        spawn: spawnFor(room, userId),
        paused: room.paused,
        gameMode: effectiveMode,
        inventory:
          effectiveMode === "survival" && assigned.player.inventory
            ? cloneHotbar(assigned.player.inventory)
            : createEmptyHotbar(),
        itemInventory:
          effectiveMode === "survival" && assigned.player.itemInventory
            ? cloneItemInventory(assigned.player.itemInventory)
            : createEmptyItemInventory(),
        equipmentSlots:
          effectiveMode === "survival" && assigned.player.equipmentSlots
            ? cloneEquipmentSlots(assigned.player.equipmentSlots)
            : createEmptyEquipmentSlots(),
        vitals:
          effectiveMode === "survival" && assigned.player.health !== undefined
            ? cloneVitals(assigned.player)
            : cloneVitals(createDefaultVitals()),
        craftingGrid:
          effectiveMode === "survival" && assigned.player.craftingGrid
            ? cloneCraftingGrid(assigned.player.craftingGrid)
            : createEmptyCraftingGrid(),
        craftingGridWidth:
          effectiveMode === "survival" ? assigned.player.craftingGridWidth ?? 2 : 2,
        drops: effectiveMode === "survival" ? listDropsWire(room) : []
      });
    }
  );

  socket.on("INPUT", (payload: InputReq) => {
    const sessionId = socket.data.sessionId as string | undefined;
    if (!sessionId) return;
    const room = getRoom(sessionId);
    if (!room || room.paused) return;
    const player = room.players.get(userId);
    if (!player) return;
    if (!isFiniteVec(payload?.pos)) return;
    if (!Number.isFinite(payload?.heading)) return;
    const skipPositionUpdate =
      player.lastDeathAt !== undefined && Date.now() - player.lastDeathAt < 1000;

    if (!skipPositionUpdate && (room.gameMode ?? "survival") === "survival" && player.health !== undefined) {
      const dx = payload.pos[0] - player.pos[0];
      const dz = payload.pos[2] - player.pos[2];
      const distance = Math.hypot(dx, dz);
      const jumped = !!payload.jumping && !player.jumping;
      if (addMovementExhaustion(player, distance, jumped)) {
        room.dirty = true;
      }
    }
    if (!skipPositionUpdate) {
      player.pos = payload.pos;
    }
    player.heading = payload.heading;
    if (Number.isFinite(payload?.pitch)) player.pitch = payload.pitch as number;
    player.jumping = !!payload.jumping;
    player.t = Number.isFinite(payload?.t) ? payload.t : Date.now();
    const hb = Math.floor(Number(payload?.hotbarIndex));
    if (Number.isFinite(hb) && hb >= 0 && hb < HOTBAR_SLOT_COUNT) {
      player.selectedHotbarIndex = hb;
    }
    player.lastInputAt = Date.now();
    room.dirty = true;
  });

  socket.on("ARM_SWING", (_payload: unknown, ack?: (r: SimpleAck) => void) => {
    const sessionId = socket.data.sessionId as string | undefined;
    if (!sessionId) return ack?.({ ok: false });
    const room = getRoom(sessionId);
    if (!room || room.paused) return ack?.({ ok: false });
    const player = room.players.get(userId);
    if (!player) return ack?.({ ok: false });
    const now = Date.now();
    if (now - (player.lastArmSwingAt ?? 0) < ARM_SWING_COOLDOWN_MS) {
      return ack?.({ ok: true });
    }
    player.lastArmSwingAt = now;
    const payload: ArmSwingPayload = { userId };
    socket.to(`voxel:${sessionId}`).emit("PLAYER_ARM_SWING", payload);
    ack?.({ ok: true });
  });

  socket.on("MUTE_ALL", (payload: unknown, ack?: (r: SimpleAck) => void) => {
    const started = Date.now();
    const sessionId = socket.data.sessionId as string | undefined;
    const reply = wrapAck("MUTE_ALL", started, sessionId, ack);
    if (!sessionId) return reply?.({ ok: false });
    const room = getRoom(sessionId);
    if (!room) return reply?.({ ok: false });
    const isHost = room.hostId === userId;
    if (!isHost) {
      return reply?.({
        ok: false,
        error: { code: "UNAUTHORIZED", message: "Only the host can mute all players" }
      });
    }
    io.to(`voxel:${sessionId}`).emit("MUTE_ALL", { mutedBy: displayName });
    reply?.({ ok: true });
  });

  socket.on(
    "FALL_IMPACT",
    (payload: FallImpactReq, ack?: (r: SimpleAck) => void) => {
      const sessionId = socket.data.sessionId as string | undefined;
      const room = sessionId ? getRoom(sessionId) : undefined;
      const player = room ? room.players.get(userId) : undefined;
      if (!sessionId || !room || !player || room.paused) {
        ack?.({ ok: false, error: { code: "NOT_IN_ROOM", message: "לא בחדר" } });
        return;
      }
      if ((room.gameMode ?? "survival") !== "survival" || player.health === undefined) {
        ack?.({ ok: false, error: { code: "BAD_INTENT", message: "רק במצב הישרדות" } });
        return;
      }
      const velocityY = Number(payload?.velocityY);
      if (!Number.isFinite(velocityY) || velocityY > -8 || velocityY < -80) {
        ack?.({ ok: false, error: { code: "BAD_INTENT", message: "Invalid fall" } });
        return;
      }
      const amount = applyFallDamage(player, velocityY);
      if (amount > 0) {
        room.dirty = true;
        io.to(`voxel:${sessionId}`).emit(
          "PLAYER_DAMAGE",
          playerDamagePayload(player, amount, "fall")
        );
        checkAndHandlePlayerDeath(room, player);
      }
      socket.emit("INVENTORY_SYNC", inventorySyncPayload(player));
      ack?.({ ok: true });
    }
  );

  socket.on(
    "PLAYER_ATTACK",
    (payload: PlayerAttackReq, ack?: (r: SimpleAck) => void) => {
      const sessionId = socket.data.sessionId as string | undefined;
      const room = sessionId ? getRoom(sessionId) : undefined;
      const attacker = room ? room.players.get(userId) : undefined;
      const targetUserId = String(payload?.targetUserId ?? "");
      const target = room?.players.get(targetUserId);
      if (!sessionId || !room || !attacker || !target || room.paused) {
        ack?.({ ok: false, error: { code: "NOT_IN_ROOM", message: "לא בחדר" } });
        return;
      }
      if (
        (room.gameMode ?? "survival") !== "survival" ||
        attacker.health === undefined ||
        target.health === undefined ||
        target.userId === attacker.userId
      ) {
        ack?.({ ok: false, error: { code: "BAD_INTENT", message: "תקיפה לא תקפה" } });
        return;
      }
      const now = Date.now();
      if (now - (attacker.lastAttackAt ?? 0) < PLAYER_ATTACK_COOLDOWN_MS) {
        ack?.({ ok: true });
        return;
      }
      if (vecDist(attacker.pos, target.pos) > PLAYER_ATTACK_REACH) {
        ack?.({ ok: false, error: { code: "OUT_OF_REACH", message: "רחוק מדי" } });
        return;
      }
      attacker.lastAttackAt = now;
      const amount = applyPlayerDamage(target, heldWeaponDamage(attacker), "combat");
      if (amount > 0) {
        room.dirty = true;
        io.to(`voxel:${sessionId}`).emit(
          "PLAYER_DAMAGE",
          playerDamagePayload(target, amount, "combat")
        );
        checkAndHandlePlayerDeath(room, target, now);
      }
      ack?.({ ok: true });
    }
  );

  socket.on(
    "IGNITE_TNT",
    (payload: IgniteTntReq, ack?: (r: SimpleAck) => void) => {
      const sessionId = socket.data.sessionId as string | undefined;
      const target = resolveBreakTarget(userId, sessionId, payload?.pos, getRoom);
      if (!target.ok) {
        ack?.(target.ack);
        return;
      }
      const { room, player, sessionId: activeSessionId, x, y, z, blockId } = target;
      if ((room.gameMode ?? "survival") !== "survival") {
        ack?.({
          ok: false,
          error: { code: "BAD_INTENT", message: "רק במצב שרדות" }
        });
        return;
      }
      if (blockId !== BLOCK_REGISTRY.TNT) {
        ack?.({
          ok: false,
          error: { code: "BAD_INTENT", message: "אפשר להדליק רק TNT" }
        });
        return;
      }
      const hotbarIndex = player.selectedHotbarIndex ?? 0;
      const held = player.inventory?.[hotbarIndex];
      if (
        !player.inventory ||
        !player.itemInventory ||
        !player.craftingGrid ||
        !held ||
        held.itemId !== ITEM_REGISTRY.FLINT_AND_STEEL ||
        held.count <= 0
      ) {
        ack?.({
          ok: false,
          error: { code: "MISSING_TOOL", message: "צריך מצית צור וברזל בסרגל" }
        });
        return;
      }
      const now = Date.now();
      const tnt = primeTnt(room, [x, y, z], userId, now);
      if (!tnt) {
        ack?.({
          ok: false,
          error: { code: "BAD_INTENT", message: "TNT לא זמין" }
        });
        return;
      }
      applyHeldItemWear(player, ITEM_REGISTRY.FLINT_AND_STEEL);
      socket.emit("INVENTORY_SYNC", inventorySyncPayload(player));
      io.to(`voxel:${activeSessionId}`).emit("BLOCK_DELTA", {
        pos: [x, y, z],
        blockId: getVoxelID(room.world, x, y, z),
        by: userId
      });
      io.to(`voxel:${activeSessionId}`).emit("ROOM_EVENT", {
        kind: "TNT_PRIMED",
        sessionId: activeSessionId,
        id: tnt.id,
        pos: tnt.pos,
        primedAt: tnt.primedAt,
        explodeAt: tnt.explodeAt,
        by: userId
      });
      ack?.({ ok: true });
    }
  );

  socket.on(
    "BLOCK_PLACE",
    (payload: BlockPlaceReq, ack?: (r: SimpleAck) => void) => {
      const sessionId = socket.data.sessionId as string | undefined;
      if (!sessionId) {
        ack?.({
          ok: false,
          error: { code: "NOT_IN_ROOM", message: "לא בחדר" }
        });
        return;
      }
      const room = getRoom(sessionId);
      if (!room) {
        ack?.({
          ok: false,
          error: { code: "NOT_FOUND", message: "Room not loaded" }
        });
        return;
      }
      if (room.paused) {
        ack?.({
          ok: false,
          error: { code: "GAME_PAUSED", message: "המשחק מושהה" }
        });
        return;
      }
      const player = room.players.get(userId);
      if (!player) {
        ack?.({
          ok: false,
          error: { code: "NOT_IN_ROOM", message: "השחקן לא נמצא בחדר" }
        });
        return;
      }
      if (player.activeEating) {
        ack?.({
          ok: false,
          error: { code: "EATING_BUSY", message: "אוכל עכשיו" }
        });
        return;
      }
      if (!isFiniteVec(payload?.pos)) {
        ack?.({
          ok: false,
          error: { code: "BAD_INTENT", message: "Invalid coordinates" }
        });
        return;
      }
      const blockId = Number(payload.blockId);
      if (!PLACEABLE_BLOCK_IDS.includes(blockId)) {
        ack?.({
          ok: false,
          error: { code: "BAD_INTENT", message: "Block not placeable" }
        });
        return;
      }
      const [x, y, z] = payload.pos.map((n) => Math.floor(Number(n))) as Vec3;
      if (vecDist(player.pos, [x + 0.5, y + 0.5, z + 0.5]) > MAX_REACH) {
        ack?.({
          ok: false,
          error: { code: "OUT_OF_REACH", message: "רחוק מדי" }
        });
        return;
      }
      if (!blockReplaceable(getVoxelID(room.world, x, y, z))) {
        ack?.({
          ok: false,
          error: { code: "BLOCK_OCCUPIED", message: "המקום תפוס" }
        });
        return;
      }
      if (blockId === BLOCK_REGISTRY.SUGAR_CANE) {
        const belowId = getVoxelID(room.world, x, y - 1, z);
        if (!sugarCaneMayPlaceOn(belowId)) {
          ack?.({
            ok: false,
            error: {
              code: "BAD_INTENT",
              message: "קני סוכר צריך דשא, עפר או חול מתחת"
            }
          });
          return;
        }
      }
      for (const p of room.players.values()) {
        if (blockIntersectsPlayer(p.pos, x, y, z, blockId)) {
          ack?.({
            ok: false,
            error: { code: "BLOCK_OCCUPIED_BY_PLAYER", message: "שחקן עומד שם" }
          });
          return;
        }
      }
      applyDelta(room.world, x, y, z, blockId);
      if (
        (room.gameMode ?? "survival") === "survival" &&
        player.inventory &&
        player.itemInventory &&
        player.craftingGrid
      ) {
        consumeOneIfPresent(player.inventory, blockId);
        socket.emit("INVENTORY_SYNC", inventorySyncPayload(player));
      }
      io.to(`voxel:${sessionId}`).emit("BLOCK_DELTA", {
        pos: [x, y, z],
        blockId,
        by: userId
      });
      ack?.({ ok: true });
    }
  );

  socket.on(
    "BLOCK_BREAK",
    (payload: BlockBreakReq, ack?: (r: SimpleAck) => void) => {
      const sessionId = socket.data.sessionId as string | undefined;
      const target = resolveBreakTarget(userId, sessionId, payload?.pos, getRoom);
      if (!target.ok) {
        ack?.(target.ack);
        return;
      }
      const { room, player, x, y, z, blockId } = target;
      if (player.activeEating) {
        ack?.({
          ok: false,
          error: { code: "EATING_BUSY", message: "אוכל עכשיו" }
        });
        return;
      }
      if (shouldUseTimedBreak(blockId, room.gameMode)) {
        ack?.({
          ok: false,
          error: { code: "USE_TIMED_BREAK", message: "החזק לשבירה" }
        });
        return;
      }
      executeBlockBreak(room, player, userId, sessionId!, x, y, z, blockId);
      ack?.({ ok: true });
    }
  );

  socket.on(
    "BREAK_START",
    (payload: BreakStartReq, ack?: (r: BreakStartAck) => void) => {
      const sessionId = socket.data.sessionId as string | undefined;
      const target = resolveBreakTarget(userId, sessionId, payload?.pos, getRoom);
      if (!target.ok) {
        ack?.(target.ack);
        return;
      }
      const { room, player, x, y, z, blockId } = target;
      if (player.activeEating) {
        ack?.({
          ok: false,
          error: { code: "EATING_BUSY", message: "אוכל עכשיו" }
        });
        return;
      }
      if ((room.gameMode ?? "survival") !== "survival") {
        ack?.({
          ok: false,
          error: { code: "BAD_INTENT", message: "רק במצב שרדות" }
        });
        return;
      }
      if (!shouldUseTimedBreak(blockId, room.gameMode)) {
        ack?.({
          ok: false,
          error: { code: "INSTANT_BLOCK", message: "שבירה מיידית" }
        });
        return;
      }
      const started = beginBreak(player, [x, y, z], blockId, Date.now());
      if (!started.ok) {
        ack?.({
          ok: false,
          error: { code: started.code, message: started.message }
        });
        return;
      }
      ack?.({ ok: true, durationMs: started.durationMs });
    }
  );

  socket.on(
    "BREAK_FINISH",
    (payload: BreakFinishReq, ack?: (r: SimpleAck) => void) => {
      const sessionId = socket.data.sessionId as string | undefined;
      const target = resolveBreakTarget(userId, sessionId, payload?.pos, getRoom);
      if (!target.ok) {
        ack?.(target.ack);
        return;
      }
      const { room, player, x, y, z, blockId } = target;
      const done = finishBreak(player, [x, y, z], blockId, Date.now());
      if (!done.ok) {
        ack?.({
          ok: false,
          error: { code: done.code, message: done.message }
        });
        return;
      }
      executeBlockBreak(room, player, userId, sessionId!, x, y, z, blockId);
      if (player.inventory && player.itemInventory && player.craftingGrid) {
        socket.emit("INVENTORY_SYNC", inventorySyncPayload(player));
      }
      ack?.({ ok: true });
    }
  );

  socket.on("BREAK_CANCEL", (payload: BreakCancelReq) => {
    const sessionId = socket.data.sessionId as string | undefined;
    const room = sessionId ? getRoom(sessionId) : undefined;
    const player = room?.players.get(userId);
    if (!player) return;
    const active = player.activeBreak;
    if (!active || !isFiniteVec(payload?.pos)) {
      cancelBreak(player);
      return;
    }
    const [x, y, z] = payload.pos.map((n) => Math.floor(Number(n))) as Vec3;
    if (
      active.pos[0] === x &&
      active.pos[1] === y &&
      active.pos[2] === z
    ) {
      cancelBreak(player);
    }
  });

  socket.on(
    "DROP_ITEM_REQ",
    (payload: DropItemReq, ack?: (r: SimpleAck) => void) => {
      const sessionId = socket.data.sessionId as string | undefined;
      if (!sessionId) {
        ack?.({
          ok: false,
          error: { code: "NOT_IN_ROOM", message: "לא בחדר" }
        });
        return;
      }
      const room = getRoom(sessionId);
      if (!room) {
        ack?.({
          ok: false,
          error: { code: "NOT_FOUND", message: "Room not loaded" }
        });
        return;
      }
      if (room.paused) {
        ack?.({
          ok: false,
          error: { code: "GAME_PAUSED", message: "המשחק מושהה" }
        });
        return;
      }
      const player = room.players.get(userId);
      if (!player) {
        ack?.({
          ok: false,
          error: { code: "NOT_IN_ROOM", message: "השחקן לא נמצא בחדר" }
        });
        return;
      }
      if ((room.gameMode ?? "survival") !== "survival") {
        ack?.({
          ok: false,
          error: { code: "BAD_INTENT", message: "רק במצב שרדות" }
        });
        return;
      }
      if (!player.inventory || !player.itemInventory || !player.craftingGrid) {
        ack?.({ ok: false });
        return;
      }
      const idx = Math.floor(Number(payload?.hotbarIndex));
      if (!Number.isFinite(idx) || idx < 0 || idx >= HOTBAR_SLOT_COUNT) {
        ack?.({
          ok: false,
          error: { code: "BAD_INTENT", message: "Invalid slot" }
        });
        return;
      }
      const cell = player.inventory[idx];
      if (!cell || cell.count <= 0) {
        ack?.({
          ok: false,
          error: { code: "EMPTY_SLOT", message: "המשבצת ריקה" }
        });
        return;
      }
      const isItem = (cell.itemId ?? 0) > 0;
      const isBlock =
        !isItem && cell.blockId !== BLOCK_REGISTRY.AIR;
      if (!isItem && !isBlock) {
        ack?.({
          ok: false,
          error: { code: "EMPTY_SLOT", message: "המשבצת ריקה" }
        });
        return;
      }
      if (!consumeOneFromHotbarIndex(player.inventory, idx)) {
        ack?.({
          ok: false,
          error: { code: "EMPTY_SLOT", message: "המשבצת ריקה" }
        });
        return;
      }
      const dropPos = thrownDropPositionInFrontOfPlayer(player);
      const impulse = throwImpulseForPlayer(player);
      const spawned = isItem
        ? spawnItemDropAt(room, dropPos, cell.itemId, 1, impulse)
        : spawnBlockDropAt(room, dropPos, cell.blockId, 1, impulse);
      if (!spawned) {
        ack?.({
          ok: false,
          error: { code: "BAD_INTENT", message: "לא ניתן לזרוק" }
        });
        return;
      }
      socket.emit("INVENTORY_SYNC", inventorySyncPayload(player));
      io.to(`voxel:${sessionId}`).emit("ROOM_EVENT", {
        sessionId,
        kind: "WORLD_DROP_SPAWNED",
        drop: spawned
      });
      ack?.({ ok: true });
    }
  );

  socket.on(
    "EAT_START",
    (payload: EatReq, ack?: (r: EatStartAck) => void) => {
      const sessionId = socket.data.sessionId as string | undefined;
      const room = sessionId ? getRoom(sessionId) : undefined;
      const player = room ? room.players.get(userId) : undefined;
      if (!sessionId || !room || !player || room.paused) {
        ack?.({
          ok: false,
          error: { code: "NOT_IN_ROOM", message: "לא בחדר" }
        });
        return;
      }
      if ((room.gameMode ?? "survival") !== "survival" || !player.inventory) {
        ack?.({
          ok: false,
          error: { code: "BAD_INTENT", message: "רק במצב הישרדות" }
        });
        return;
      }
      const hotbarIndex = Math.floor(Number(payload?.hotbarIndex));
      if (
        !Number.isFinite(hotbarIndex) ||
        hotbarIndex < 0 ||
        hotbarIndex >= HOTBAR_SLOT_COUNT
      ) {
        ack?.({
          ok: false,
          error: { code: "BAD_INTENT", message: "Invalid slot" }
        });
        return;
      }
      const cell = player.inventory[hotbarIndex];
      const itemId = cell?.itemId ?? 0;
      const food = itemFoodSpec(itemId);
      if (!cell || cell.count <= 0 || !food) {
        ack?.({
          ok: false,
          error: { code: "NOT_FOOD", message: "אין אוכל במשבצת" }
        });
        return;
      }
      if ((player.health ?? MAX_HEALTH) >= MAX_HEALTH && food.nutrition >= 0) {
        ack?.({
          ok: false,
          error: { code: "FULL_HEALTH", message: "מד החיים שלך כבר מלא" }
        });
        return;
      }
      player.activeEating = {
        hotbarIndex,
        itemId,
        startedAt: Date.now()
      };
      ack?.({ ok: true, durationMs: EATING_DURATION_MS });
    }
  );

  socket.on(
    "EAT_FINISH",
    (payload: EatReq, ack?: (r: SimpleAck) => void) => {
      const sessionId = socket.data.sessionId as string | undefined;
      const room = sessionId ? getRoom(sessionId) : undefined;
      const player = room ? room.players.get(userId) : undefined;
      if (!sessionId || !room || !player || room.paused) {
        ack?.({
          ok: false,
          error: { code: "NOT_IN_ROOM", message: "לא בחדר" }
        });
        return;
      }
      if ((room.gameMode ?? "survival") !== "survival" || !player.inventory) {
        ack?.({
          ok: false,
          error: { code: "BAD_INTENT", message: "רק במצב הישרדות" }
        });
        return;
      }
      const hotbarIndex = Math.floor(Number(payload?.hotbarIndex));
      const active = player.activeEating;
      if (
        !active ||
        active.hotbarIndex !== hotbarIndex ||
        Date.now() - active.startedAt < EAT_FINISH_TOLERANCE_MS
      ) {
        ack?.({
          ok: false,
          error: { code: "EAT_NOT_READY", message: "עדיין לא סיימת לאכול" }
        });
        return;
      }
      const cell = player.inventory[hotbarIndex];
      const itemId = cell?.itemId ?? 0;
      const food = itemFoodSpec(itemId);
      if (
        !cell ||
        cell.count <= 0 ||
        itemId !== active.itemId ||
        !food ||
        !consumeOneFromHotbarIndex(player.inventory, hotbarIndex)
      ) {
        delete player.activeEating;
        ack?.({
          ok: false,
          error: { code: "NOT_FOOD", message: "האוכל כבר לא שם" }
        });
        return;
      }
      delete player.activeEating;
      applyFood(player, food.nutrition, food.saturationModifier);
      room.dirty = true;
      socket.emit("INVENTORY_SYNC", inventorySyncPayload(player));
      ack?.({ ok: true });
    }
  );

  socket.on("EAT_CANCEL", (_payload: unknown, ack?: (r: SimpleAck) => void) => {
    const sessionId = socket.data.sessionId as string | undefined;
    const room = sessionId ? getRoom(sessionId) : undefined;
    const player = room ? room.players.get(userId) : undefined;
    if (player) delete player.activeEating;
    ack?.({ ok: true });
  });

  socket.on(
    "EAT_CAKE_SLICE",
    (payload: { pos: Vec3 }, ack?: (r: SimpleAck) => void) => {
      const sessionId = socket.data.sessionId as string | undefined;
      const room = sessionId ? getRoom(sessionId) : undefined;
      const player = room ? room.players.get(userId) : undefined;
      if (!sessionId || !room || !player || room.paused) {
        ack?.({
          ok: false,
          error: { code: "NOT_IN_ROOM", message: "לא בחדר" }
        });
        return;
      }
      if ((room.gameMode ?? "survival") !== "survival") {
        ack?.({
          ok: false,
          error: { code: "BAD_INTENT", message: "רק במצב הישרדות" }
        });
        return;
      }
      if (!isFiniteVec(payload?.pos)) {
        ack?.({
          ok: false,
          error: { code: "BAD_INTENT", message: "Invalid coordinates" }
        });
        return;
      }
      const [x, y, z] = payload.pos.map((n) => Math.floor(Number(n))) as Vec3;
      const currentBlockId = getVoxelID(room.world, x, y, z);
      const isCakeBlock =
        currentBlockId === BLOCK_REGISTRY.CAKE ||
        currentBlockId === BLOCK_REGISTRY.CAKE_5 ||
        currentBlockId === BLOCK_REGISTRY.CAKE_4 ||
        currentBlockId === BLOCK_REGISTRY.CAKE_3 ||
        currentBlockId === BLOCK_REGISTRY.CAKE_2 ||
        currentBlockId === BLOCK_REGISTRY.CAKE_1;

      if (!isCakeBlock) {
        ack?.({
          ok: false,
          error: { code: "NOT_CAKE", message: "אין עוגה שם" }
        });
        return;
      }
      if (vecDist(player.pos, [x + 0.5, y + 0.5, z + 0.5]) > MAX_REACH) {
        ack?.({
          ok: false,
          error: { code: "OUT_OF_REACH", message: "רחוק מדי" }
        });
        return;
      }
      if ((player.health ?? MAX_HEALTH) >= MAX_HEALTH) {
        ack?.({
          ok: false,
          error: { code: "FULL_HEALTH", message: "מד החיים שלך כבר מלא" }
        });
        return;
      }

      const nextBlockId =
        currentBlockId === BLOCK_REGISTRY.CAKE ? BLOCK_REGISTRY.CAKE_5 :
        currentBlockId === BLOCK_REGISTRY.CAKE_5 ? BLOCK_REGISTRY.CAKE_4 :
        currentBlockId === BLOCK_REGISTRY.CAKE_4 ? BLOCK_REGISTRY.CAKE_3 :
        currentBlockId === BLOCK_REGISTRY.CAKE_3 ? BLOCK_REGISTRY.CAKE_2 :
        currentBlockId === BLOCK_REGISTRY.CAKE_2 ? BLOCK_REGISTRY.CAKE_1 :
        BLOCK_REGISTRY.AIR;

      applyFood(player, 2, 0);
      room.dirty = true;
      socket.emit("INVENTORY_SYNC", inventorySyncPayload(player));

      applyDelta(room.world, x, y, z, nextBlockId);
      io.to(`voxel:${sessionId}`).emit("BLOCK_DELTA", {
        pos: [x, y, z],
        blockId: nextBlockId,
        by: userId
      });

      ack?.({ ok: true });
    }
  );

  socket.on(
    "CRAFT",
    (payload: CraftReq, ack?: (r: CraftAck) => void) => {
      const sessionId = socket.data.sessionId as string | undefined;
      if (!sessionId) return ack?.({ ok: false });
      const room = getRoom(sessionId);
      const player = room ? room.players.get(userId) : undefined;
      if (!room || !player || room.paused) {
        return ack?.({ ok: false });
      }
      if ((room.gameMode ?? "survival") !== "survival") {
        return ack?.({ ok: false });
      }
      if (!player.inventory || !player.itemInventory || !player.craftingGrid) {
        return ack?.({ ok: false });
      }
      const recipeId = String(payload?.recipeId ?? "");
      if (recipeId !== "grid") {
        return ack?.({ ok: false });
      }
      if (
        !tryCraftFromGrid(
          player.inventory,
          player.itemInventory,
          player.craftingGrid,
          player.craftingGridWidth ?? 2
        )
      ) {
        return ack?.({ ok: false });
      }
      socket.emit("INVENTORY_SYNC", inventorySyncPayload(player));
      ack?.({ ok: true });
    }
  );

  socket.on(
    "OPEN_CRAFTING_TABLE",
    (payload: OpenCraftingTableReq, ack?: (r: SimpleAck) => void) => {
      const sessionId = socket.data.sessionId as string | undefined;
      const room = sessionId ? getRoom(sessionId) : undefined;
      const player = room ? room.players.get(userId) : undefined;
      if (!sessionId || !room || !player || room.paused) return ack?.({ ok: false });
      if ((room.gameMode ?? "survival") !== "survival") return ack?.({ ok: false });
      if (!player.inventory || !player.itemInventory || !player.craftingGrid) {
        return ack?.({ ok: false });
      }
      const pos = payload?.pos;
      if (!isFiniteVec(pos)) return ack?.({ ok: false });
      const [x, y, z] = pos.map((n) => Math.floor(n)) as Vec3;
      if (vecDist(player.pos, [x + 0.5, y + 0.5, z + 0.5]) > MAX_REACH) {
        return ack?.({
          ok: false,
          error: { code: "OUT_OF_REACH", message: "רחוק מדי" }
        });
      }
      if (getVoxelID(room.world, x, y, z) !== BLOCK_REGISTRY.CRAFTING) {
        return ack?.({ ok: false });
      }
      player.craftingGridWidth = 3;
      socket.emit("INVENTORY_SYNC", inventorySyncPayload(player));
      ack?.({ ok: true });
    }
  );

  socket.on("CLOSE_CRAFTING_TABLE", (_payload: unknown, ack?: (r: SimpleAck) => void) => {
    const sessionId = socket.data.sessionId as string | undefined;
    const room = sessionId ? getRoom(sessionId) : undefined;
    const player = room ? room.players.get(userId) : undefined;
    if (!sessionId || !room || !player) return ack?.({ ok: false });
    if (!player.inventory || !player.itemInventory || !player.craftingGrid) {
      player.craftingGridWidth = 2;
      return ack?.({ ok: true });
    }
    const overflow = returnInactiveCraftingSlotsToInventory(
      player.craftingGrid,
      player.inventory,
      player.itemInventory
    );
    for (const item of overflow) {
      const dropPos = dropPositionInFrontOfPlayer(player);
      const spawned =
        item.kind === "block"
          ? spawnBlockDropAt(room, dropPos, item.blockId, item.count)
          : spawnItemDropAt(room, dropPos, item.itemId, item.count);
      if (spawned) {
        io.to(`voxel:${sessionId}`).emit("ROOM_EVENT", {
          sessionId,
          kind: "WORLD_DROP_SPAWNED",
          drop: spawned
        });
      }
    }
    player.craftingGridWidth = 2;
    socket.emit("INVENTORY_SYNC", inventorySyncPayload(player));
    ack?.({ ok: true });
  });

  socket.on(
    "OPEN_CHEST",
    (payload: OpenChestReq, ack?: (r: OpenChestAck) => void) => {
      const sessionId = socket.data.sessionId as string | undefined;
      const room = sessionId ? getRoom(sessionId) : undefined;
      const player = room ? room.players.get(userId) : undefined;
      if (!sessionId || !room || !player || room.paused) return ack?.({ ok: false });
      if ((room.gameMode ?? "survival") !== "survival") return ack?.({ ok: false });
      if (!player.inventory || !player.itemInventory || !player.craftingGrid) {
        return ack?.({ ok: false });
      }
      const pos = payload?.pos;
      if (!isFiniteVec(pos)) return ack?.({ ok: false });
      const [x, y, z] = pos.map((n) => Math.floor(n)) as Vec3;
      if (vecDist(player.pos, [x + 0.5, y + 0.5, z + 0.5]) > MAX_REACH) {
        return ack?.({
          ok: false,
          error: { code: "OUT_OF_REACH", message: "רחוק מדי" }
        });
      }
      if (getVoxelID(room.world, x, y, z) !== BLOCK_REGISTRY.CHEST) {
        return ack?.({ ok: false });
      }
      const key = chestKey(x, y, z);
      const lockedBy = room.chestLocks.get(key);
      if (lockedBy && lockedBy !== userId) {
        return ack?.({
          ok: false,
          error: { code: "CHEST_LOCKED", message: "תיבה פתוחה אצל שחקן אחר" }
        });
      }
      if (player.activeChestKey && player.activeChestKey !== key) {
        room.chestLocks.delete(player.activeChestKey);
      }
      player.activeChestKey = key;
      room.chestLocks.set(key, userId);
      const chest = getOrCreateChest(room, key);
      ack?.({ ok: true, pos: [x, y, z], slots: cloneChest(chest) });
    }
  );

  socket.on("CLOSE_CHEST", (_payload: unknown, ack?: (r: SimpleAck) => void) => {
    const sessionId = socket.data.sessionId as string | undefined;
    const room = sessionId ? getRoom(sessionId) : undefined;
    const player = room ? room.players.get(userId) : undefined;
    if (player?.activeChestKey) {
      room?.chestLocks.delete(player.activeChestKey);
      delete player.activeChestKey;
    }
    ack?.({ ok: true });
  });

  socket.on(
    "CHEST_MOVE",
    (payload: InventoryMoveReq, ack?: (r: SimpleAck) => void) => {
      const sessionId = socket.data.sessionId as string | undefined;
      const room = sessionId ? getRoom(sessionId) : undefined;
      const player = room ? room.players.get(userId) : undefined;
      if (!sessionId || !room || !player || room.paused) return ack?.({ ok: false });
      if ((room.gameMode ?? "survival") !== "survival") return ack?.({ ok: false });
      if (
        !player.inventory ||
        !player.itemInventory ||
        !player.craftingGrid ||
        !player.equipmentSlots ||
        !player.activeChestKey
      ) {
        return ack?.({ ok: false });
      }
      if (room.chestLocks.get(player.activeChestKey) !== userId) {
        return ack?.({
          ok: false,
          error: { code: "CHEST_LOCKED", message: "התיבה נעולה" }
        });
      }
      const from = payload?.from;
      const to = payload?.to;
      if (
        (from !== "hotbar" && from !== "storage" && from !== "chest") ||
        (to !== "hotbar" && to !== "storage" && to !== "chest")
      ) {
        return ack?.({ ok: false });
      }
      const chest = room.chests.get(player.activeChestKey);
      if (!chest) return ack?.({ ok: false });
      const fromIndex = Math.floor(Number(payload?.fromIndex));
      const toIndex = Math.floor(Number(payload?.toIndex));
      if (
        !applyInventoryMove(
          player.inventory,
          player.itemInventory,
          player.craftingGrid,
          {
            from,
            fromIndex,
            to,
            toIndex
          },
          player.equipmentSlots,
          chest
        )
      ) {
        return ack?.({ ok: false });
      }
      socket.emit("INVENTORY_SYNC", inventorySyncPayload(player));
      socket.emit("CHEST_SYNC", chestSyncPayload(player.activeChestKey, cloneChest(chest)));
      ack?.({ ok: true });
    }
  );

  socket.on(
    "INVENTORY_MOVE",
    (payload: InventoryMoveReq, ack?: (r: SimpleAck) => void) => {
      const sessionId = socket.data.sessionId as string | undefined;
      if (!sessionId) {
        return ack?.({
          ok: false,
          error: { code: "NOT_IN_ROOM", message: "לא בחדר" }
        });
      }
      const room = getRoom(sessionId);
      const player = room ? room.players.get(userId) : undefined;
      if (!room || !player || room.paused) {
        return ack?.({
          ok: false,
          error: { code: "NOT_IN_ROOM", message: "לא בחדר" }
        });
      }
      if ((room.gameMode ?? "survival") !== "survival") {
        return ack?.({
          ok: false,
          error: { code: "BAD_INTENT", message: "רק במצב הישרדות" }
        });
      }
      if (
        !player.inventory ||
        !player.itemInventory ||
        !player.craftingGrid ||
        !player.equipmentSlots
      ) {
        return ack?.({ ok: false });
      }
      const from = payload?.from;
      const to = payload?.to;
      if (
        (from !== "hotbar" && from !== "storage" && from !== "craft" && from !== "equipment") ||
        (to !== "hotbar" && to !== "storage" && to !== "craft" && to !== "equipment")
      ) {
        return ack?.({ ok: false });
      }
      const fromIndex = Math.floor(Number(payload?.fromIndex));
      const toIndex = Math.floor(Number(payload?.toIndex));
      if (!Number.isFinite(fromIndex) || !Number.isFinite(toIndex)) {
        return ack?.({ ok: false });
      }
      const craftingWidth = player.craftingGridWidth ?? 2;
      if (
        craftingWidth === 2 &&
        ((from === "craft" && !isPersonalCraftingIndex(fromIndex)) ||
          (to === "craft" && !isPersonalCraftingIndex(toIndex)))
      ) {
        return ack?.({ ok: false });
      }
      if (
        !applyInventoryMove(
          player.inventory,
          player.itemInventory,
          player.craftingGrid,
          {
            from,
            fromIndex,
            to,
            toIndex
          },
          player.equipmentSlots
        )
      ) {
        return ack?.({ ok: false });
      }
      socket.emit("INVENTORY_SYNC", inventorySyncPayload(player));
      ack?.({ ok: true });
    }
  );

  socket.on(
    "SET_GAME_MODE",
    async (payload: SetGameModeReq, ack?: (r: SimpleAck) => void) => {
      const sessionId =
        payload?.sessionId ?? (socket.data.sessionId as string | undefined);
      if (!sessionId || !payload || !isGameMode(payload.gameMode)) {
        ack?.({
          ok: false,
          error: { code: "BAD_REQUEST", message: "חסר מצב משחק" }
        });
        return;
      }
      const room = getRoom(sessionId);
      if (!room) {
        ack?.({
          ok: false,
          error: { code: "NOT_FOUND", message: "Room not loaded" }
        });
        return;
      }
      if (room.hostId !== userId) {
        ack?.({
          ok: false,
          error: { code: "NOT_HOST", message: "רק המארח יכול לשנות מצב" }
        });
        return;
      }
      if (room.paused) {
        ack?.({
          ok: false,
          error: { code: "GAME_PAUSED", message: "המשחק מושהה" }
        });
        return;
      }
      const next = payload.gameMode;
      const callerPlayer = room.players.get(userId);
      const callerName = callerPlayer?.displayName ?? userId;
      const playerNames = Array.from(room.players.values()).map(p => p.displayName).join(", ");
      logger.info({
        correlationId: socket.data.correlationId,
        userId,
        sessionId,
        protocol: "socket",
        message: "Game mode changed",
        context: {
          event: "SET_GAME_MODE",
          gameMode: next,
          gameId: room.gameId,
          callerName,
          playerCount: room.players.size,
          status: "success"
        }
      });
      if (next === "survival") {
        room.gameMode = "survival";
        for (const p of room.players.values()) {
          p.inventory = createEmptyHotbar();
          p.itemInventory = createEmptyItemInventory();
          p.craftingGrid = createEmptyCraftingGrid();
          p.equipmentSlots = createEmptyEquipmentSlots();
          p.craftingGridWidth = 2;
          assignVitals(p, createDefaultVitals());
          delete p.activeEating;
          delete p.activeChestKey;
        }
        room.disconnectedInventories.clear();
        room.disconnectedItemInventories.clear();
        room.disconnectedCraftingGrids.clear();
        room.disconnectedEquipmentSlots.clear();
        room.disconnectedVitals.clear();
        room.chests.clear();
        room.chestLocks.clear();
      } else {
        room.gameMode = "creative";
        clearDropsBroadcast(io, room);
        for (const p of room.players.values()) {
          delete p.inventory;
          delete p.itemInventory;
          delete p.craftingGrid;
          delete p.equipmentSlots;
          delete p.craftingGridWidth;
          delete p.health;
          delete p.hunger;
          delete p.saturation;
          delete p.exhaustion;
          delete p.lastVitalsAt;
          delete p.lastRegenAt;
          delete p.lastStarveAt;
          delete p.activeEating;
          delete p.activeChestKey;
        }
        room.disconnectedInventories.clear();
        room.disconnectedItemInventories.clear();
        room.disconnectedCraftingGrids.clear();
        room.disconnectedEquipmentSlots.clear();
        room.disconnectedVitals.clear();
        room.chests.clear();
        room.chestLocks.clear();
      }
      io.to(`voxel:${sessionId}`).emit("ROOM_EVENT", {
        sessionId,
        kind: "GAME_MODE_CHANGED",
        gameMode: next
      });
      await emitInventoryToSurvivalPlayers(sessionId, room);
      ack?.({ ok: true });
    }
  );

  socket.on(
    "SWITCH_TEACHER_MODE",
    async (
      payload: { sessionId: string; observer: boolean },
      ack?: (r: SimpleAck) => void
    ) => {
      const sessionId = payload?.sessionId ?? (socket.data.sessionId as string | undefined);
      const observer = !!payload?.observer;
      if (!sessionId) {
        ack?.({
          ok: false,
          error: { code: "BAD_REQUEST", message: "sessionId required" }
        });
        return;
      }
      if (socket.data.role !== "teacher") {
        ack?.({
          ok: false,
          error: { code: "FORBIDDEN", message: "רק מורה יכול לשנות מצב צפייה" }
        });
        return;
      }
      const room = getRoom(sessionId);
      if (!room) {
        ack?.({
          ok: false,
          error: { code: "NOT_FOUND", message: "Room not loaded" }
        });
        return;
      }
      const player = room.players.get(userId);
      if (!player) {
        ack?.({
          ok: false,
          error: { code: "NOT_FOUND", message: "Player not in room" }
        });
        return;
      }

      if (!observer) {
        // Switching to Player Mode: check if players < max_players
        const activeKidsCount = Array.from(room.players.values()).filter(
          (p) => !p.isTeacherObserver && p.userId !== userId
        ).length;
        if (activeKidsCount >= room.maxPlayers) {
          ack?.({
            ok: false,
            error: {
              code: "ROOM_FULL",
              message: `המשחק מלא (${activeKidsCount}/${room.maxPlayers} שחקנים). אי אפשר להיכנס כשחקן.`
            }
          });
          return;
        }
      }

      player.isTeacherObserver = observer;
      room.dirty = true;

      io.to(`voxel:${sessionId}`).emit("ROOM_EVENT", {
        sessionId,
        kind: "TEACHER_MODE_CHANGED",
        userId,
        observer
      });

      ack?.({ ok: true });
    }
  );

  socket.on(
    "PAUSE_GAME",
    (
      payload: { sessionId?: string } | undefined,
      ack?: (r: SimpleAck) => void
    ) => {
      const sessionId =
        payload?.sessionId ?? (socket.data.sessionId as string | undefined);
      if (!sessionId) {
        ack?.({
          ok: false,
          error: { code: "BAD_REQUEST", message: "sessionId required" }
        });
        return;
      }
      const room = getRoom(sessionId);
      if (!room) {
        ack?.({
          ok: false,
          error: { code: "NOT_FOUND", message: "Room not loaded" }
        });
        return;
      }
      const guard = canStopGame(room, userId);
      if (!guard.ok) {
        ack?.({ ok: false, error: guard.error });
        return;
      }
      room.paused = true;
      if (supabaseAdmin) {
        const connected = connectedPlayers(room);
        void persistGamePaused({
          supabase: supabaseAdmin,
          sessionId,
          gameState: snapshotPersistedState(room),
          connectedPlayerIds: connected.map((p) => p.userId),
          connectedPlayerNames: connected.map((p) => p.displayName)
        });
      }
      io.to(`voxel:${sessionId}`).emit("ROOM_EVENT", {
        sessionId,
        kind: "GAME_PAUSED"
      });
      ack?.({ ok: true });
    }
  );

  socket.on(
    "RESUME_GAME",
    (
      payload: { sessionId?: string } | undefined,
      ack?: (r: SimpleAck) => void
    ) => {
      const sessionId =
        payload?.sessionId ?? (socket.data.sessionId as string | undefined);
      if (!sessionId) {
        ack?.({
          ok: false,
          error: { code: "BAD_REQUEST", message: "sessionId required" }
        });
        return;
      }
      const room = getRoom(sessionId);
      if (!room) {
        ack?.({
          ok: false,
          error: { code: "NOT_FOUND", message: "Room not loaded" }
        });
        return;
      }
      const guard = canStopGame(room, userId);
      if (!guard.ok) {
        ack?.({ ok: false, error: guard.error });
        return;
      }
      room.paused = false;
      if (supabaseAdmin) {
        const connected = connectedPlayers(room);
        void persistGameResumed({
          supabase: supabaseAdmin,
          sessionId,
          connectedPlayerIds: connected.map((p) => p.userId),
          connectedPlayerNames: connected.map((p) => p.displayName)
        });
      }
      io.to(`voxel:${sessionId}`).emit("ROOM_EVENT", {
        sessionId,
        kind: "GAME_RESUMED"
      });
      ack?.({ ok: true });
    }
  );

  socket.on(
    "STOP_GAME",
    (
      payload: { sessionId?: string } | undefined,
      ack?: (r: SimpleAck) => void
    ) => {
      const started = Date.now();
      const sessionId =
        payload?.sessionId ?? (socket.data.sessionId as string | undefined);
      const reply = wrapAck("STOP_GAME", started, sessionId, ack);
      if (!sessionId) {
        reply?.({
          ok: false,
          error: { code: "BAD_REQUEST", message: "sessionId required" }
        });
        return;
      }
      const room = getRoom(sessionId);
      if (!room) {
        reply?.({
          ok: false,
          error: { code: "NOT_FOUND", message: "Room not loaded" }
        });
        return;
      }
      const guard = canStopGame(room, userId);
      if (!guard.ok) {
        reply?.({ ok: false, error: guard.error });
        return;
      }
      io.to(`voxel:${sessionId}`).emit("ROOM_EVENT", {
        sessionId,
        kind: "GAME_STOPPED",
        stoppedBy: userId
      });
      if (supabaseAdmin) {
        void persistGameStopped({
          supabase: supabaseAdmin,
          sessionId,
          stoppedBy: userId,
          gameState: snapshotPersistedState(room)
        });
      }
      deleteRoom(sessionId);
      stats.onRoomDeleted(sessionId);
      reply?.({ ok: true });
    }
  );

  async function handleLeave(sessionId: string) {
    if (!userId) return;
    const before = getRoom(sessionId);
    const result = removePlayerFromRoom(sessionId, userId);
    if (result.roomEmpty) {
      stats.onRoomDeleted(sessionId);
    }
    const room = getRoom(sessionId);
    if (supabaseAdmin && before) {
      const connected = room ? connectedPlayers(room) : [];
      void persistPlayerLeave({
        supabase: supabaseAdmin,
        sessionId,
        result,
        connectedPlayerIds: connected.map((p) => p.userId),
        connectedPlayerNames: connected.map((p) => p.displayName),
        gameState: snapshotPersistedState(before)
      });
    }
    if (room && result.roomEmpty) {
      room.paused = true;
      io.to(`voxel:${sessionId}`).emit("ROOM_EVENT", {
        sessionId,
        kind: "GAME_PAUSED"
      });
    }
    if (result.newHostId) {
      io.to(`voxel:${sessionId}`).emit("ROOM_EVENT", {
        sessionId,
        kind: "HOST_LEFT",
        newHostId: result.newHostId
      });
    }
    io.to(`voxel:${sessionId}`).emit("ROOM_EVENT", {
      sessionId,
      kind: "PLAYER_LEFT",
      player: { userId, displayName }
    });
    if (before && before.players.has(userId)) {
      void insertSystemChatMessage(sessionId, `${displayName} עזב את המשחק`);
    }
    await socket.leave(`voxel:${sessionId}`);
    if (socket.data.sessionId === sessionId) {
      socket.data.sessionId = undefined;
    }
  }

  socket.on(
    "LEAVE_ROOM",
    async (
      payload: { sessionId?: string } | undefined,
      ack?: (r: SimpleAck) => void
    ) => {
      const started = Date.now();
      const sessionId =
        payload?.sessionId ?? (socket.data.sessionId as string | undefined);
      const reply = wrapAck("LEAVE_ROOM", started, sessionId, ack);
      if (!sessionId) {
        reply?.({
          ok: false,
          error: { code: "BAD_REQUEST", message: "sessionId required" }
        });
        return;
      }
      await handleLeave(sessionId);
      reply?.({ ok: true });
    }
  );

  socket.on(
    "CHAT_MESSAGE",
    async (
      payload: { sessionId: string; message: string },
      ack?: (r: SimpleAck) => void
    ) => {
      const sessionId = payload?.sessionId;
      const message = payload?.message;
      if (!sessionId || typeof message !== "string") {
        ack?.({
          ok: false,
          error: { code: "BAD_REQUEST", message: "sessionId and message required" }
        });
        return;
      }
      if (socket.data.role === "teacher") {
        ack?.({
          ok: false,
          error: { code: "READ_ONLY", message: "Observers cannot chat here" }
        });
        return;
      }
      if (socket.data.sessionId !== sessionId) {
        ack?.({
          ok: false,
          error: { code: "NOT_IN_ROOM", message: "השחקן לא בחדר הנכון" }
        });
        return;
      }
      const text = message.trim().slice(0, 500);
      if (!text) {
        ack?.({
          ok: false,
          error: { code: "BAD_REQUEST", message: "הודעה ריקה" }
        });
        return;
      }
      if (!supabaseAdmin) {
        ack?.({
          ok: false,
          error: { code: "SERVER_CONFIG", message: "Supabase not configured" }
        });
        return;
      }
      const { error: insErr } = await supabaseAdmin.from("chat_messages").insert({
        session_id: sessionId,
        sender_id: userId,
        sender_name: displayName,
        message: text,
        is_system: false
      });
      if (insErr) {
        ack?.({
          ok: false,
          error: { code: "PERSIST_FAILED", message: insErr.message }
        });
        return;
      }
      ack?.({ ok: true });
    }
  );

  socket.on("disconnect", () => {
    const sessionId = socket.data.sessionId as string | undefined;
    if (sessionId && userId) {
      void handleLeave(sessionId);
    }
  });
});

async function insertSystemChatMessage(sessionId: string, message: string): Promise<void> {
  if (!supabaseAdmin) {
    logger.warn({ message: "supabaseAdmin not configured for system chat" });
    return;
  }
  const { error } = await supabaseAdmin.from("chat_messages").insert({
    session_id: sessionId,
    sender_id: null,
    sender_name: "מערכת",
    message: message,
    is_system: true
  });
  if (error) {
    logger.error({
      message: "failed to insert system chat message",
      error: error.message
    });
  }
}

type MinimalStatus = "waiting" | "playing" | "paused" | "completed";

const RECESS_TICK_MS = 30_000;
const recessSweepState = createRecessSweepState();
const recessTimer = setInterval(() => {
  void recessEndSweep(recessSweepState, {
    supabase: supabaseAdmin,
    loadSchedules: loadRecessSchedules,
    io,
    logError: (message, err) =>
      logger.error({
        message,
        error: err instanceof Error ? err.message : String(err)
      })
  });
}, RECESS_TICK_MS);
recessTimer.unref?.();

function tickRoomVitals(room: VoxelRoom, now: number): void {
  if ((room.gameMode ?? "survival") !== "survival") return;
  for (const player of room.players.values()) {
    if (player.health === undefined) continue;
    const suffAmount = applySuffocationDamage(room.world, player, now);
    if (suffAmount > 0) {
      room.dirty = true;
      io.to(`voxel:${room.sessionId}`).emit(
        "PLAYER_DAMAGE",
        playerDamagePayload(player, suffAmount, "suffocation")
      );
    }
    if (tickVitals(player, now) || tickHeliosRegen(player, room.world, now) || suffAmount > 0) {
      room.dirty = true;
    }
    checkAndHandlePlayerDeath(room, player, now);
  }
}

function tickRoomTnt(room: VoxelRoom, now: number): void {
  if ((room.gameMode ?? "survival") !== "survival" || room.activeTnts.size === 0) return;
  const sessionId = room.sessionId;
  for (const tnt of [...room.activeTnts.values()]) {
    if (tnt.explodeAt > now) continue;
    const result = applyTntExplosion(room, tnt);
    for (const delta of result.blockDeltas) {
      io.to(`voxel:${sessionId}`).emit("BLOCK_DELTA", {
        pos: delta.pos,
        blockId: delta.blockId,
        by: tnt.by
      });
      if (blockDropsPickable(delta.destroyedBlockId) && Math.random() < 0.3) {
        const [x, y, z] = delta.pos;
        const dropId = blockDropId(delta.destroyedBlockId);
        if (dropId !== null) {
          const spawned = spawnBlockDropAt(
            room,
            jitterBreakSpawnPosition(x, y, z),
            dropId,
            1,
            scatterImpulseBreakDrop()
          );
          if (spawned) {
            io.to(`voxel:${sessionId}`).emit("ROOM_EVENT", {
              sessionId,
              kind: "WORLD_DROP_SPAWNED",
              drop: spawned
            });
          }
        }
      }
    }
    for (const damage of result.playerDamage) {
      io.to(`voxel:${sessionId}`).emit(
        "PLAYER_DAMAGE",
        playerDamagePayload(damage.player, damage.amount, "explosion", damage.impulse)
      );
      checkAndHandlePlayerDeath(room, damage.player, now);
    }
    io.to(`voxel:${sessionId}`).emit("ROOM_EVENT", {
      kind: "EXPLOSION",
      sessionId,
      id: tnt.id,
      pos: tnt.pos,
      radius: TNT_EXPLOSION_RADIUS,
      by: tnt.by
    });
  }
}

function tickRoomWeather(room: VoxelRoom, now: number): void {
  const deltas = tickWeatherFreezing(room, now);
  if (deltas.length === 0) return;
  for (const delta of deltas) {
    io.to(`voxel:${room.sessionId}`).emit("BLOCK_DELTA", {
      pos: delta.pos,
      blockId: delta.blockId,
      by: "weather"
    });
  }
}

startTickLoop({
  io,
  survivalVitalsTick: tickRoomVitals,
  tntTick: tickRoomTnt,
  weatherTick: tickRoomWeather,
  worldDropsTick: (room) => tickWorldDrops(io, room, Date.now()),
  magnetPickups: (room) => tickMagnetPickups(io, room),
  onError: (message, err) =>
    logger.error({
      message,
      error: err instanceof Error ? err.message : String(err)
    })
});

server.listen(PORT, () => {
  logger.info({ message: `minecraft-server listening on ${PORT}`, protocol: "http" });
});
