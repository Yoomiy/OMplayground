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
import { getGameModule } from "@playground/game-logic";
import {
  applyIntent,
  assignPlayer,
  attachSpectator,
  canStopGame,
  deleteRoom,
  getOrCreateRoom,
  isRoomIdle,
  getRoom,
  removePlayerFromRoom,
  removeSpectatorFromRoom
} from "./room";
import {
  persistPlayerJoin,
  persistPlayerLeave
} from "./sessionPersistence";
import {
  cleanupStalePausedSessions,
  persistGameEnded,
  persistGameStopped
} from "./lifecycle";
import { createRecessSweepState, recessEndSweep } from "./recessSweep";

const PORT = Number(process.env.PORT ?? 8080);
/** localhost vs 127.0.0.1 are different origins — allow both for local Vite */
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
      "[game-server] SUPABASE_URL must include the scheme, e.g. https://YOUR_PROJECT.supabase.co\n" +
        `  Got: ${JSON.stringify(u)} (check apps/game-server/.env)`
    );
    process.exit(1);
  }
  try {
    new URL(u);
  } catch {
    console.error(
      "[game-server] SUPABASE_URL is not a valid URL. Fix apps/game-server/.env"
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
  res.json({ ok: true, service: "playground-game-server" });
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
  if (!supabaseAdmin) return [];
  const now = Date.now();
  if (now - recessCache.fetchedAt < 60_000 && recessCache.rows.length) {
    return recessCache.rows;
  }
  const { data, error } = await supabaseAdmin
    .from("recess_schedules")
    .select("day_of_week, start_time, end_time, is_active")
    .eq("is_active", true);
  if (error) {
    console.error("recess_schedules", error.message);
    return recessCache.rows;
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
      const schedules = await loadRecessSchedules();
      if (schedules.length && !isWithinRecess(new Date(), schedules)) {
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

io.on("connection", (socket) => {
  const userId = socket.data.userId as string;
  const displayName = socket.data.displayName as string;
  const gender = socket.data.gender as "boy" | "girl";

  socket.on(
    "JOIN_ROOM",
    async (
      payload: { sessionId: string },
      ack?: (r: unknown) => void
    ) => {
      const sessionId = payload?.sessionId;
      if (!sessionId) {
        ack?.({ ok: false, error: { code: "BAD_REQUEST", message: "sessionId required" } });
        return;
      }
      if (!supabaseAdmin) {
        ack?.({ ok: false, error: { code: "SERVER_CONFIG", message: "Supabase not configured" } });
        return;
      }
      const { data: session, error } = await supabaseAdmin
        .from("game_sessions")
        .select(
          "id, game_id, gender, player_ids, player_names, host_id, status, games ( game_url, min_players )"
        )
        .eq("id", sessionId)
        .maybeSingle();
      if (error || !session) {
        ack?.({ ok: false, error: { code: "NOT_FOUND", message: "Session not found" } });
        return;
      }
      if ((session.gender as string) !== gender) {
        ack?.({
          ok: false,
          error: { code: "GENDER_MISMATCH", message: "Wrong gender partition" }
        });
        return;
      }
      const gameRow = (session as { games?: { game_url?: string; min_players?: number } | null })
        .games;
      const gameKey = gameRow?.game_url ?? "";
      const gameModule = getGameModule(gameKey);
      if (!gameModule) {
        ack?.({
          ok: false,
          error: { code: "GAME_UNSUPPORTED", message: `No module for game '${gameKey}'` }
        });
        return;
      }
      const room = getOrCreateRoom(sessionId, {
        gameId: session.game_id as string,
        gameKey,
        module: gameModule,
        gender,
        hostId: session.host_id as string,
        minPlayers: gameRow?.min_players ?? gameModule.minPlayers
      });
      const role = socket.data.role as string;
      if (role === "teacher") {
        attachSpectator(room, userId, displayName);
        await socket.join(`session:${sessionId}`);
        socket.data.sessionId = sessionId;
        socket.data.isSpectator = true;
        io.to(`session:${sessionId}`).emit("ROOM_SNAPSHOT", {
          sessionId,
          gameKey: room.gameKey,
          hostId: room.hostId,
          gameState: room.state,
          players: Array.from(room.players.values())
        });
        ack?.({ ok: true, spectator: true });
        return;
      }
      const assigned = assignPlayer(room, userId, displayName);
      if ("error" in assigned) {
        ack?.({ ok: false, error: assigned.error });
        return;
      }
      socket.data.isSpectator = false;
      await socket.join(`session:${sessionId}`);
      socket.data.sessionId = sessionId;
      void persistPlayerJoin({
        supabase: supabaseAdmin,
        sessionId,
        session: {
          player_ids: (session.player_ids as string[]) ?? [],
          player_names: (session.player_names as string[]) ?? [],
          status: session.status as
            | "waiting"
            | "playing"
            | "paused"
            | "completed"
        },
        userId,
        displayName,
        roomStatusIsIdle: isRoomIdle(room)
      });
      io.to(`session:${sessionId}`).emit("ROOM_SNAPSHOT", {
        sessionId,
        gameKey: room.gameKey,
        hostId: room.hostId,
        gameState: room.state,
        players: Array.from(room.players.values())
      });
      ack?.({ ok: true, player: assigned.player });
    }
  );

  socket.on(
    "INTENT_GAME",
    (
      payload: { sessionId?: string; intent?: unknown },
      ack?: (r: unknown) => void
    ) => {
      const sessionId = payload?.sessionId;
      if (!sessionId || payload?.intent === undefined) {
        ack?.({
          ok: false,
          error: { code: "BAD_REQUEST", message: "sessionId and intent required" }
        });
        return;
      }
      if (socket.data.role === "teacher") {
        ack?.({
          ok: false,
          error: { code: "READ_ONLY", message: "Observers cannot send moves" }
        });
        return;
      }
      const room = getRoom(sessionId);
      if (!room) {
        ack?.({ ok: false, error: { code: "NOT_FOUND", message: "Room not loaded" } });
        return;
      }
      const res = applyIntent(room, userId, payload.intent);
      if (!res.ok) {
        ack?.({ ok: false, error: res.error });
        return;
      }
      io.to(`session:${sessionId}`).emit("ROOM_SNAPSHOT", {
        sessionId,
        gameKey: room.gameKey,
        hostId: room.hostId,
        gameState: res.state,
        players: Array.from(room.players.values())
      });
      if (res.outcome) {
        io.to(`session:${sessionId}`).emit("ROOM_EVENT", {
          sessionId,
          kind: "GAME_ENDED",
          outcome: res.outcome
        });
        if (supabaseAdmin) {
          void persistGameEnded({
            supabase: supabaseAdmin,
            sessionId,
            gameState: res.state
          });
        }
      }
      ack?.({ ok: true, gameState: res.state });
    }
  );

  socket.on(
    "STOP_GAME",
    async (
      payload: { sessionId?: string } | undefined,
      ack?: (r: unknown) => void
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
      io.to(`session:${sessionId}`).emit("ROOM_EVENT", {
        sessionId,
        kind: "GAME_STOPPED",
        stoppedBy: userId
      });
      if (supabaseAdmin) {
        void persistGameStopped({
          supabase: supabaseAdmin,
          sessionId,
          stoppedBy: userId,
          gameState: room.state
        });
      }
      deleteRoom(sessionId);
      ack?.({ ok: true });
    }
  );

  socket.on(
    "CHAT_MESSAGE",
    async (
      payload: { sessionId: string; message: string },
      ack?: (r: unknown) => void
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
      const text = message.trim().slice(0, 500);
      if (!text) {
        ack?.({ ok: false, error: { code: "BAD_REQUEST", message: "empty" } });
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
        ack?.({ ok: false, error: { code: "PERSIST_FAILED", message: insErr.message } });
        return;
      }
      // Chat UI uses Supabase + Realtime only (stays in sync with teacher moderation).
      ack?.({ ok: true });
    }
  );

  async function handleLeave(sessionId: string) {
    if (!userId) return;
    if (socket.data.isSpectator) {
      removeSpectatorFromRoom(sessionId, userId);
      const room = getRoom(sessionId);
      io.to(`session:${sessionId}`).emit("ROOM_SNAPSHOT", {
        sessionId,
        gameKey: room?.gameKey,
        hostId: room?.hostId,
        gameState: room?.state,
        players: room ? Array.from(room.players.values()) : []
      });
      await socket.leave(`session:${sessionId}`);
      if (socket.data.sessionId === sessionId) {
        socket.data.sessionId = undefined;
      }
      socket.data.isSpectator = false;
      return;
    }
    const result = removePlayerFromRoom(sessionId, userId);
    if (supabaseAdmin) {
      void persistPlayerLeave({ supabase: supabaseAdmin, sessionId, result });
    }
    const room = getRoom(sessionId);
    if (result.newHostId) {
      io.to(`session:${sessionId}`).emit("ROOM_EVENT", {
        sessionId,
        kind: "HOST_LEFT",
        newHostId: result.newHostId
      });
    }
    io.to(`session:${sessionId}`).emit("ROOM_SNAPSHOT", {
      sessionId,
      gameKey: room?.gameKey,
      hostId: room?.hostId,
      gameState: room?.state,
      players: room ? Array.from(room.players.values()) : []
    });
    await socket.leave(`session:${sessionId}`);
    if (socket.data.sessionId === sessionId) {
      socket.data.sessionId = undefined;
    }
  }

  socket.on(
    "LEAVE_ROOM",
    async (
      payload: { sessionId?: string } | undefined,
      ack?: (r: unknown) => void
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

/**
 * Recess-end sweep runs every 30s. The logic lives in recessSweep.ts so
 * it is unit-testable; here we only inject runtime dependencies and wire
 * the timer.
 */
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

/** Stale-pause cleanup: pause → completed for rooms untouched for >24h. */
const STALE_PAUSE_MS = 24 * 60 * 60 * 1000;
const CLEANUP_TICK_MS = 60 * 60 * 1000;
const cleanupTimer = setInterval(() => {
  if (!supabaseAdmin) return;
  void cleanupStalePausedSessions({
    supabase: supabaseAdmin,
    olderThanMs: STALE_PAUSE_MS
  });
}, CLEANUP_TICK_MS);
cleanupTimer.unref?.();

server.listen(PORT, () => {
  console.log(`game-server listening on ${PORT}`);
});
