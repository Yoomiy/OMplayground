import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

import http from "http";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";
import { createClient } from "@supabase/supabase-js";
import { isWithinRecess } from "./recess";
import {
  applyDelta,
  getVoxelID,
  serializeDeltas
} from "./world";
import {
  addPickUp,
  applyInventoryMove,
  blockBreakable,
  blockDropId,
  blockDropsPickable,
  cloneCraftingGrid,
  cloneHotbar,
  cloneItemInventory,
  consumeOneIfPresent,
  createEmptyCraftingGrid,
  createEmptyHotbar,
  createEmptyItemInventory,
  tryCraftFromGrid
} from "./inventory";
import {
  assignPlayer,
  canStopGame,
  connectedPlayers,
  deleteRoom,
  getOrCreateRoom,
  getRoom,
  removePlayerFromRoom,
  roomRoster,
  snapshotPersistedState,
  spawnFor,
  type PersistedRoomState
} from "./room";
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
import { startTickLoop } from "./tick";
import {
  BLOCK_REGISTRY,
  MAX_REACH,
  PLACEABLE_BLOCK_IDS,
  type BlockBreakReq,
  type BlockPlaceReq,
  type CraftAck,
  type CraftReq,
  type GameMode,
  type InputReq,
  type InventoryMoveReq,
  type JoinRoomAck,
  type SetGameModeReq,
  type SimpleAck,
  type Vec3
} from "./protocol";

const PORT = Number(process.env.PORT ?? 8081);
const CORS_ORIGIN =
  process.env.CORS_ORIGIN ??
  "http://localhost:5173,http://127.0.0.1:5173";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function exitIfInvalidSupabaseUrlForClient(): void {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;
  const u = SUPABASE_URL.trim();
  if (!/^https?:\/\//i.test(u)) {
    console.error(
      "[minecraft-server] SUPABASE_URL must include the scheme, e.g. https://YOUR_PROJECT.supabase.co\n" +
        `  Got: ${JSON.stringify(u)} (check apps/minecraft-server/.env)`
    );
    process.exit(1);
  }
  try {
    new URL(u);
  } catch {
    console.error(
      "[minecraft-server] SUPABASE_URL is not a valid URL. Fix apps/minecraft-server/.env"
    );
    process.exit(1);
  }
}

exitIfInvalidSupabaseUrlForClient();

const app = express();
app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: CORS_ORIGIN.split(",").map((s) => s.trim()),
    credentials: true
  })
);
app.use(express.json());
app.use(morgan("combined"));

const httpLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(httpLimiter);

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
    console.error("recess_schedules", error.message);
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
        console.error(
          "recess gate failed",
          err instanceof Error ? err.message : err
        );
        next(new Error("RECESS_DENIED"));
        return;
      }
    }
    socket.data.userId = profile.id as string;
    socket.data.displayName = profile.full_name as string;
    socket.data.role = profile.role as string;
    socket.data.gender = profile.gender as "boy" | "girl";
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

function blockIntersectsPlayer(pos: Vec3, x: number, y: number, z: number): boolean {
  const blockMinX = x;
  const blockMaxX = x + 1;
  const blockMinY = y;
  const blockMaxY = y + 1;
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

async function emitInventoryToSurvivalPlayers(
  sessionId: string,
  room: ReturnType<typeof getRoom>
): Promise<void> {
  if (!room || (room.gameMode ?? "creative") !== "survival") return;
  const socks = await io.in(`voxel:${sessionId}`).fetchSockets();
  for (const s of socks) {
    const uid = s.data.userId as string | undefined;
    if (!uid) continue;
    const p = room.players.get(uid);
    if (p?.inventory && p.itemInventory && p.craftingGrid) {
      s.emit("INVENTORY_SYNC", {
        slots: p.inventory,
        itemSlots: p.itemInventory,
        craftingSlots: p.craftingGrid
      });
    }
  }
}

io.on("connection", (socket) => {
  const userId = socket.data.userId as string;
  const displayName = socket.data.displayName as string;
  const gender = socket.data.gender as "boy" | "girl";

  socket.on(
    "JOIN_ROOM",
    async (
      payload: { sessionId: string },
      ack?: (r: JoinRoomAck) => void
    ) => {
      const sessionId = payload?.sessionId;
      if (!sessionId) {
        ack?.({
          ok: false,
          error: { code: "BAD_REQUEST", message: "sessionId required" }
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
      const { data: session, error } = await supabaseAdmin
        .from("game_sessions")
        .select(
          "id, game_id, gender, player_ids, player_names, host_id, status, game_state, games ( game_url, min_players, max_players )"
        )
        .eq("id", sessionId)
        .maybeSingle();
      if (error || !session) {
        ack?.({
          ok: false,
          error: { code: "NOT_FOUND", message: "Session not found" }
        });
        return;
      }
      if ((session.gender as string) !== gender) {
        ack?.({
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
        ack?.({
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
      if (sess.status === "paused" && !playerIds.includes(userId)) {
        ack?.({
          ok: false,
          error: {
            code: "NOT_IN_ROSTER",
            message: "רק שחקני המשחק המקורי יכולים להמשיך משחק מושהה"
          }
        });
        return;
      }
      if (sess.status === "completed") {
        ack?.({
          ok: false,
          error: { code: "SESSION_COMPLETED", message: "המשחק כבר הסתיים" }
        });
        return;
      }
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
      const assigned = assignPlayer(room, userId, displayName);
      if ("error" in assigned) {
        ack?.({ ok: false, error: assigned.error });
        return;
      }
      await socket.join(`voxel:${sessionId}`);
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
      const effectiveMode = room.gameMode ?? "creative";
      ack?.({
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
        craftingGrid:
          effectiveMode === "survival" && assigned.player.craftingGrid
            ? cloneCraftingGrid(assigned.player.craftingGrid)
            : createEmptyCraftingGrid()
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
    player.pos = payload.pos;
    player.heading = payload.heading;
    if (Number.isFinite(payload?.pitch)) player.pitch = payload.pitch as number;
    player.jumping = !!payload.jumping;
    player.t = Number.isFinite(payload?.t) ? payload.t : Date.now();
    player.lastInputAt = Date.now();
    room.dirty = true;
  });

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
      if (getVoxelID(room.world, x, y, z) !== BLOCK_REGISTRY.AIR) {
        ack?.({
          ok: false,
          error: { code: "BLOCK_OCCUPIED", message: "המקום תפוס" }
        });
        return;
      }
      for (const p of room.players.values()) {
        if (blockIntersectsPlayer(p.pos, x, y, z)) {
          ack?.({
            ok: false,
            error: { code: "BLOCK_OCCUPIED_BY_PLAYER", message: "שחקן עומד שם" }
          });
          return;
        }
      }
      applyDelta(room.world, x, y, z, blockId);
      if (
        (room.gameMode ?? "creative") === "survival" &&
        player.inventory &&
        player.itemInventory &&
        player.craftingGrid
      ) {
        consumeOneIfPresent(player.inventory, blockId);
        socket.emit("INVENTORY_SYNC", {
          slots: player.inventory,
          itemSlots: player.itemInventory,
          craftingSlots: player.craftingGrid
        });
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
      if (!isFiniteVec(payload?.pos)) {
        ack?.({
          ok: false,
          error: { code: "BAD_INTENT", message: "Invalid coordinates" }
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
      if (getVoxelID(room.world, x, y, z) === BLOCK_REGISTRY.AIR) {
        ack?.({
          ok: false,
          error: { code: "BLOCK_EMPTY", message: "אין שם בלוק" }
        });
        return;
      }
      const brokenId = getVoxelID(room.world, x, y, z);
      if (!blockBreakable(brokenId)) {
        ack?.({
          ok: false,
          error: { code: "UNBREAKABLE_BLOCK", message: "אי אפשר לשבור את הבלוק הזה" }
        });
        return;
      }
      applyDelta(room.world, x, y, z, BLOCK_REGISTRY.AIR);
      if (
        (room.gameMode ?? "creative") === "survival" &&
        player.inventory &&
        player.itemInventory &&
        player.craftingGrid &&
        blockDropsPickable(brokenId)
      ) {
        const dropId = blockDropId(brokenId);
        if (dropId !== null) addPickUp(player.inventory, dropId);
        socket.emit("INVENTORY_SYNC", {
          slots: player.inventory,
          itemSlots: player.itemInventory,
          craftingSlots: player.craftingGrid
        });
      }
      io.to(`voxel:${sessionId}`).emit("BLOCK_DELTA", {
        pos: [x, y, z],
        blockId: BLOCK_REGISTRY.AIR,
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
      if ((room.gameMode ?? "creative") !== "survival") {
        return ack?.({ ok: false });
      }
      if (!player.inventory || !player.itemInventory || !player.craftingGrid) {
        return ack?.({ ok: false });
      }
      const recipeId = String(payload?.recipeId ?? "");
      if (recipeId !== "grid") {
        return ack?.({ ok: false });
      }
      if (!tryCraftFromGrid(player.inventory, player.itemInventory, player.craftingGrid)) {
        return ack?.({ ok: false });
      }
      socket.emit("INVENTORY_SYNC", {
        slots: player.inventory,
        itemSlots: player.itemInventory,
        craftingSlots: player.craftingGrid
      });
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
      if ((room.gameMode ?? "creative") !== "survival") {
        return ack?.({
          ok: false,
          error: { code: "BAD_INTENT", message: "רק במצב הישרדות" }
        });
      }
      if (!player.inventory || !player.itemInventory || !player.craftingGrid) {
        return ack?.({ ok: false });
      }
      const from = payload?.from;
      const to = payload?.to;
      if (
        (from !== "hotbar" && from !== "storage" && from !== "craft") ||
        (to !== "hotbar" && to !== "storage" && to !== "craft")
      ) {
        return ack?.({ ok: false });
      }
      const fromIndex = Math.floor(Number(payload?.fromIndex));
      const toIndex = Math.floor(Number(payload?.toIndex));
      if (!Number.isFinite(fromIndex) || !Number.isFinite(toIndex)) {
        return ack?.({ ok: false });
      }
      if (!applyInventoryMove(player.inventory, player.itemInventory, player.craftingGrid, {
        from,
        fromIndex,
        to,
        toIndex
      })) {
        return ack?.({ ok: false });
      }
      socket.emit("INVENTORY_SYNC", {
        slots: player.inventory,
        itemSlots: player.itemInventory,
        craftingSlots: player.craftingGrid
      });
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
      if (next === "survival") {
        room.gameMode = "survival";
        for (const p of room.players.values()) {
          p.inventory = createEmptyHotbar();
          p.itemInventory = createEmptyItemInventory();
          p.craftingGrid = createEmptyCraftingGrid();
        }
        room.disconnectedInventories.clear();
        room.disconnectedItemInventories.clear();
        room.disconnectedCraftingGrids.clear();
      } else {
        room.gameMode = "creative";
        for (const p of room.players.values()) {
          delete p.inventory;
          delete p.itemInventory;
          delete p.craftingGrid;
        }
        room.disconnectedInventories.clear();
        room.disconnectedItemInventories.clear();
        room.disconnectedCraftingGrids.clear();
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
      ack?.({ ok: true });
    }
  );

  async function handleLeave(sessionId: string) {
    if (!userId) return;
    const before = getRoom(sessionId);
    const result = removePlayerFromRoom(sessionId, userId);
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
      const sessionId =
        payload?.sessionId ?? (socket.data.sessionId as string | undefined);
      if (!sessionId) {
        ack?.({
          ok: false,
          error: { code: "BAD_REQUEST", message: "sessionId required" }
        });
        return;
      }
      await handleLeave(sessionId);
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

type MinimalStatus = "waiting" | "playing" | "paused" | "completed";

const RECESS_TICK_MS = 30_000;
const recessSweepState = createRecessSweepState();
const recessTimer = setInterval(() => {
  void recessEndSweep(recessSweepState, {
    supabase: supabaseAdmin,
    loadSchedules: loadRecessSchedules,
    io
  });
}, RECESS_TICK_MS);
recessTimer.unref?.();

startTickLoop({ io });

server.listen(PORT, () => {
  console.log(`minecraft-server listening on ${PORT}`);
});
