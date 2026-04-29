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
  connectedPlayers,
  deleteRoom,
  getOrCreateRoom,
  isRoomIdle,
  getRoom,
  missingPlayers,
  removePlayerFromRoom,
  removeSpectatorFromRoom,
  roomRoster,
  type Room
} from "./room";
import {
  persistPlayerJoin,
  persistPlayerLeave
} from "./sessionPersistence";
import {
  cleanupStalePausedSessions,
  persistGameEnded,
  persistGamePaused,
  persistGameRematch,
  persistGameResumed,
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

io.on("connection", (socket) => {
  const userId = socket.data.userId as string;
  const displayName = socket.data.displayName as string;
  const gender = socket.data.gender as "boy" | "girl";

  function roomSnapshot(room: Room<unknown>) {
    const players = connectedPlayers(room);
    const roster = roomRoster(room);
    return {
      sessionId: room.sessionId,
      gameKey: room.gameKey,
      hostId: room.hostId,
      gameState: room.state,
      players,
      roster,
      missingPlayers: missingPlayers(room),
      paused: room.paused,
      canResume: room.paused && roster.length > 0 && roster.length === players.length,
      rematch: room.rematch
        ? {
            requestedBy: room.rematch.requestedBy,
            accepted: Array.from(room.rematch.accepted),
            refused: Array.from(room.rematch.refused)
          }
        : null
    };
  }

  function emitSnapshot(room: Room<unknown>) {
    io.to(`session:${room.sessionId}`).emit("ROOM_SNAPSHOT", roomSnapshot(room));
  }

  function connectedPayload(room: Room<unknown>) {
    const players = connectedPlayers(room);
    return {
      connectedPlayerIds: players.map((p) => p.userId),
      connectedPlayerNames: players.map((p) => p.displayName)
    };
  }

  function resetForRematch(room: Room<unknown>, rematchPlayers = connectedPlayers(room)) {
    const seats = rematchPlayers.map((p) => ({
      userId: p.userId,
      displayName: p.displayName
    }));
    room.state = room.module.initialState(seats);
    room.players = new Map(rematchPlayers.map((p) => [p.userId, p]));
    room.roster = rematchPlayers;
    room.paused = false;
    room.rematch = undefined;
  }

  function resumeRoom(room: Room<unknown>) {
    room.paused = false;
    if (supabaseAdmin) {
      void persistGameResumed({
        supabase: supabaseAdmin,
        sessionId: room.sessionId,
        ...connectedPayload(room)
      });
    }
    io.to(`session:${room.sessionId}`).emit("ROOM_EVENT", {
      sessionId: room.sessionId,
      kind: "GAME_RESUMED"
    });
  }

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
          "id, game_id, gender, player_ids, player_names, host_id, status, game_state, games ( game_url, min_players )"
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
      const sess = session as { status?: string; game_state?: unknown };
      const existingRoom = getRoom(sessionId);
      const playerIds = ((session.player_ids as string[]) ?? []).map(String);
      const playerNames = ((session.player_names as string[]) ?? []).map(String);
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
      if (sess.status === "completed" && !existingRoom) {
        ack?.({
          ok: false,
          error: {
            code: "SESSION_COMPLETED",
            message: "המשחק כבר הסתיים"
          }
        });
        return;
      }
      const resumedState =
        sess.status === "paused" && sess.game_state != null ? sess.game_state : undefined;
      const room = getOrCreateRoom(sessionId, {
        gameId: session.game_id as string,
        gameKey,
        module: gameModule,
        gender,
        hostId: session.host_id as string,
        minPlayers: gameRow?.min_players ?? gameModule.minPlayers,
        roster: playerIds.map((id, i) => ({
          userId: id,
          displayName: playerNames[i] ?? "שחקן"
        })),
        paused: sess.status === "paused",
        resumedState
      });
      const role = socket.data.role as string;
      if (role === "teacher") {
        attachSpectator(room, userId, displayName);
        await socket.join(`session:${sessionId}`);
        socket.data.sessionId = sessionId;
        socket.data.isSpectator = true;
        emitSnapshot(room);
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
        ...connectedPayload(room),
        roomStatusIsIdle: isRoomIdle(room)
      });
      io.to(`session:${sessionId}`).emit("ROOM_EVENT", {
        sessionId,
        kind: "PLAYER_JOINED",
        player: assigned.player
      });
      if (room.paused && missingPlayers(room).length === 0) {
        resumeRoom(room);
      }
      emitSnapshot(room);
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
      if (room.paused) {
        ack?.({
          ok: false,
          error: { code: "GAME_PAUSED", message: "המשחק מושהה" }
        });
        return;
      }
      const res = applyIntent(room, userId, payload.intent);
      if (!res.ok) {
        ack?.({ ok: false, error: res.error });
        return;
      }
      emitSnapshot(room);
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
            gameState: res.state,
            ...connectedPayload(room)
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
    "PAUSE_GAME",
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
      room.paused = true;
      room.rematch = undefined;
      if (supabaseAdmin) {
        void persistGamePaused({
          supabase: supabaseAdmin,
          sessionId,
          gameState: room.state,
          ...connectedPayload(room)
        });
      }
      io.to(`session:${sessionId}`).emit("ROOM_EVENT", {
        sessionId,
        kind: "GAME_PAUSED"
      });
      emitSnapshot(room);
      ack?.({ ok: true });
    }
  );

  socket.on(
    "RESUME_GAME",
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
      const missing = missingPlayers(room);
      if (missing.length > 0) {
        ack?.({
          ok: false,
          error: {
            code: "PLAYERS_MISSING",
            message: `ממתינים ל־${missing.map((p) => p.displayName).join(", ")}`
          }
        });
        return;
      }
      resumeRoom(room);
      emitSnapshot(room);
      ack?.({ ok: true });
    }
  );

  socket.on(
    "REMATCH",
    (
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
      if (socket.data.role === "teacher") {
        ack?.({
          ok: false,
          error: { code: "READ_ONLY", message: "צופים לא יכולים לבקש משחק חוזר" }
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
      if (!room.module.isTerminal(room.state)) {
        ack?.({
          ok: false,
          error: {
            code: "NOT_TERMINAL",
            message: "אפשר לבקש משחק חוזר רק אחרי שהמשחק מסתיים"
          }
        });
        return;
      }
      room.rematch = {
        requestedBy: userId,
        accepted: new Set([userId]),
        refused: new Set()
      };
      io.to(`session:${sessionId}`).emit("ROOM_EVENT", {
        sessionId,
        kind: "REMATCH_REQUESTED",
        requestedBy: userId
      });
      emitSnapshot(room);
      ack?.({ ok: true });
    }
  );

  socket.on(
    "REMATCH_RESPONSE",
    (
      payload: { sessionId?: string; accept?: boolean } | undefined,
      ack?: (r: unknown) => void
    ) => {
      const sessionId =
        payload?.sessionId ?? (socket.data.sessionId as string | undefined);
      if (!sessionId || typeof payload?.accept !== "boolean") {
        ack?.({
          ok: false,
          error: { code: "BAD_REQUEST", message: "חסרים פרטי תגובה למשחק חוזר" }
        });
        return;
      }
      if (socket.data.role === "teacher") {
        ack?.({
          ok: false,
          error: { code: "READ_ONLY", message: "צופים לא יכולים להשתתף במשחק חוזר" }
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
      if (!room.rematch || !room.module.isTerminal(room.state)) {
        ack?.({
          ok: false,
          error: { code: "NO_REMATCH", message: "אין בקשת משחק חוזר פעילה" }
        });
        return;
      }
      if (!roomRoster(room).some((p) => p.userId === userId)) {
        ack?.({
          ok: false,
          error: { code: "NOT_IN_ROOM", message: "השחקן לא נמצא בחדר" }
        });
        return;
      }

      if (payload.accept) {
        room.rematch.refused.delete(userId);
        room.rematch.accepted.add(userId);
      } else {
        room.rematch.accepted.delete(userId);
        room.rematch.refused.add(userId);
      }

      const possiblePlayers = roomRoster(room).filter(
        (p) => !room.rematch?.refused.has(p.userId) && room.players.has(p.userId)
      );
      if (possiblePlayers.length < room.minPlayers) {
        room.rematch = undefined;
        io.to(`session:${sessionId}`).emit("ROOM_EVENT", {
          sessionId,
          kind: "REMATCH_CANCELLED"
        });
        emitSnapshot(room);
        ack?.({ ok: true });
        return;
      }

      const acceptedConnected = connectedPlayers(room).filter((p) =>
        room.rematch?.accepted.has(p.userId)
      );
      const connectedVoters = connectedPlayers(room);
      const everyoneAnswered = connectedVoters.every(
        (p) =>
          room.rematch?.accepted.has(p.userId) ||
          room.rematch?.refused.has(p.userId)
      );
      if (everyoneAnswered && acceptedConnected.length >= room.minPlayers) {
        resetForRematch(room, acceptedConnected);
        if (supabaseAdmin) {
          void persistGameRematch({
            supabase: supabaseAdmin,
            sessionId,
            gameState: room.state,
            playerIds: acceptedConnected.map((p) => p.userId),
            playerNames: acceptedConnected.map((p) => p.displayName),
            ...connectedPayload(room)
          });
        }
        io.to(`session:${sessionId}`).emit("ROOM_EVENT", {
          sessionId,
          kind: "REMATCH_STARTED"
        });
      }
      emitSnapshot(room);
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
      if (room) emitSnapshot(room);
      await socket.leave(`session:${sessionId}`);
      if (socket.data.sessionId === sessionId) {
        socket.data.sessionId = undefined;
      }
      socket.data.isSpectator = false;
      return;
    }
    const before = getRoom(sessionId);
    const result = removePlayerFromRoom(sessionId, userId);
    const room = getRoom(sessionId);
    if (supabaseAdmin) {
      const connected = room
        ? connectedPayload(room)
        : { connectedPlayerIds: [], connectedPlayerNames: [] };
      void persistPlayerLeave({
        supabase: supabaseAdmin,
        sessionId,
        result,
        ...connected,
        gameState: before?.state
      });
    }
    if (result.newHostId) {
      io.to(`session:${sessionId}`).emit("ROOM_EVENT", {
        sessionId,
        kind: "HOST_LEFT",
        newHostId: result.newHostId
      });
    }
    io.to(`session:${sessionId}`).emit("ROOM_EVENT", {
      sessionId,
      kind: "PLAYER_LEFT",
      player: { userId, displayName }
    });
    if (room) emitSnapshot(room);
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
