import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

import http from "http";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import {
  initObservability,
  logSocketAuthenticated,
  logSocketEvent,
  logError
} from "@playground/observability";
import { Server } from "socket.io";
import { createClient } from "@supabase/supabase-js";
import { isWithinRecess } from "./recess";
import { getGameModule } from "@playground/game-logic";
import {
  applyIntent,
  assignPlayer,
  attachSpectator,
  canResumeGame,
  canStopGame,
  connectedPlayers,
  deleteRoom,
  getOrCreateRoom,
  isRoomIdle,
  getRoom,
  listRooms,
  missingPlayers,
  playersForRematch,
  removePlayerFromRoom,
  removeSpectatorFromRoom,
  roomRoster,
  type Room
} from "./room";
import {
  persistPlayerJoin,
  persistPlayerLeave,
  persistDrawingCheckpoint
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
import { getCachedAuth } from "./authCache";
import { canJoinClosedSession } from "./closedSessionAccess";
import { verifyClassroomDelegateGameToken } from "./classroomDelegateToken";
import {
  applyClassroomDrawingSocketUpdate,
  canvasFromDoc,
  clearClassroomDrawingState,
  createClassroomDrawingState,
  encodeFullClassroomDrawingState,
  markClassroomDrawingPersisted,
  snapshotClassroomDrawingState,
  type ClassroomDrawingLiveState
} from "./classroomDrawingState";

import { recordLaunch, flushLaunches } from "./launchTracker";

async function persistLaunches(supabase: any, sessionId: string, keepSession = false) {
  const records = flushLaunches(sessionId, keepSession);
  for (const record of records) {
    try {
      await supabase.rpc("increment_game_launch_server", {
        p_kid_id: record.userId,
        p_game_url: record.gameUrl,
        p_amount: record.count
      });
    } catch (e) {
      logger.error({
        message: "Failed to persist launch stats for user",
        userId: record.userId,
        protocol: "internal",
        err: logError(e)
      });
    }
  }
}

const PORT = Number(process.env.PORT ?? 8080);
/** localhost vs 127.0.0.1 are different origins — allow both for local Vite */
const CORS_ORIGIN =
  process.env.CORS_ORIGIN ??
  "http://localhost:5173,http://127.0.0.1:5173";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const MAX_LIVE_DELTA_BYTES = 8 * 1024 * 1024;

interface ClassroomDrawingPolicy {
  classroomId: string;
  allowWhiteboardDraw: boolean;
}

const classroomDrawingPolicies = new Map<string, ClassroomDrawingPolicy>();
const classroomDrawingPolicyLoads = new Map<string, Promise<ClassroomDrawingPolicy>>();
const classroomDrawingLiveStates = new Map<string, ClassroomDrawingLiveState>();
const classroomDrawingViewports = new Map<string, { scrollX: number; scrollY: number; zoom: number }>();
const classroomDrawingSyncTimers = new Map<string, ReturnType<typeof setTimeout>>();
let classroomDrawingSyncSerial = 0;

function nextClassroomDrawingSyncToken(socketId: string): string {
  classroomDrawingSyncSerial += 1;
  return `${socketId}:${Date.now()}:${classroomDrawingSyncSerial}`;
}

async function loadClassroomDrawingPolicy(roomCode: string): Promise<ClassroomDrawingPolicy> {
  const cached = classroomDrawingPolicies.get(roomCode);
  if (cached) return cached;
  const pending = classroomDrawingPolicyLoads.get(roomCode);
  if (pending) return pending;

  const load = (async () => {
    if (!supabaseAdmin) return { classroomId: "unknown", allowWhiteboardDraw: false };
    const { data, error } = await supabaseAdmin
      .from("classroom_sessions")
      .select("id, settings, status")
      .eq("room_code", roomCode)
      .maybeSingle();
    if (error) throw error;
    const policy = {
      classroomId: String(data?.id ?? "unknown"),
      allowWhiteboardDraw:
        data?.status === "active" &&
        (data.settings as { allowWhiteboardDraw?: unknown } | null)?.allowWhiteboardDraw === true
    };
    classroomDrawingPolicies.set(roomCode, policy);
    return policy;
  })();
  classroomDrawingPolicyLoads.set(roomCode, load);
  try {
    return await load;
  } finally {
    classroomDrawingPolicyLoads.delete(roomCode);
  }
}

function exitIfInvalidSupabaseUrlForClient(): void {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;
  const u = SUPABASE_URL.trim();
  if (!/^https?:\/\//i.test(u)) {
    process.stderr.write(
      "[game-server] SUPABASE_URL must include the scheme, e.g. https://YOUR_PROJECT.supabase.co\n" +
        `  Got: ${JSON.stringify(u)} (check apps/game-server/.env)\n`
    );
    process.exit(1);
  }
  try {
    new URL(u);
  } catch {
    process.stderr.write(
      "[game-server] SUPABASE_URL is not a valid URL. Fix apps/game-server/.env\n"
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
  },
  maxHttpBufferSize: 1e7,
  perMessageDeflate: true
});

let logger: ReturnType<typeof initObservability>["logger"];
let stats: ReturnType<typeof initObservability>["stats"];

const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      })
    : null;

const observability = initObservability(app, io, {
  service: "game-server",
  supabaseAdmin,
  listRooms: () =>
    listRooms().map((room) => ({
      sessionId: room.sessionId,
      gameType: room.gameKey,
      playerCount: connectedPlayers(room).length
    })),
  onAdminStatsQuery: async () => {
    if (supabaseAdmin) {
      const activeRooms = listRooms();
      for (const room of activeRooms) {
        await persistLaunches(supabaseAdmin, room.sessionId, true);
      }
    }
  }
});
logger = observability.logger;
stats = observability.stats;

const CLASSROOM_DRAWING_CHECKPOINT_MS = 60_000;
setInterval(() => {
  if (!supabaseAdmin) return;
  for (const [sessionId, state] of classroomDrawingLiveStates) {
    if (!state.dirty) continue;
    const room = getRoom(sessionId);
    if (!room) continue;
    const seats = (room.state as { seats?: Record<string, string> } | null)?.seats;
    const snapshot = snapshotClassroomDrawingState(state, seats);
    room.state = snapshot;
    void persistDrawingCheckpoint(supabaseAdmin, sessionId, snapshot)
      .then(() => {
        markClassroomDrawingPersisted(state);
        logger.info({
          sessionId,
          protocol: "socket",
          message: "Classroom drawing checkpoint persisted",
          context: { event: "CLASSROOM_DRAWING_CHECKPOINT_PERSISTED", reason: "interval" }
        });
      })
      .catch((err) => {
        logger.error({
          message: "Classroom drawing checkpoint persistence failed",
          sessionId,
          error: err instanceof Error ? err.message : String(err)
        });
      });
  }
}, CLASSROOM_DRAWING_CHECKPOINT_MS);

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
    const classroomDelegate = token.startsWith("classroom-delegate:")
      ? verifyClassroomDelegateGameToken(
          token.slice("classroom-delegate:".length),
          SUPABASE_SERVICE_ROLE_KEY
        )
      : null;
    if (token.startsWith("classroom-delegate:") && !classroomDelegate) {
      logger.warn({
        message: "Classroom delegate socket token rejected",
        context: { event: "CLASSROOM_DELEGATE_SOCKET_DENIED" }
      });
      next(new Error("UNAUTHORIZED"));
      return;
    }

    let profile;
    if (classroomDelegate) {
      const { data: delegate } = await supabaseAdmin
        .from("classroom_host_delegates")
        .select("id, classroom_id, display_name, is_active")
        .eq("id", classroomDelegate.delegateId)
        .eq("classroom_id", classroomDelegate.classroomId)
        .maybeSingle();
      const { data: classroom } = await supabaseAdmin
        .from("classroom_sessions")
        .select("id")
        .eq("id", classroomDelegate.classroomId)
        .eq("room_code", classroomDelegate.roomCode)
        .eq("status", "active")
        .maybeSingle();
      if (!delegate?.is_active || !classroom) {
        next(new Error("FORBIDDEN"));
        return;
      }
      profile = {
        userId: classroomDelegate.identity,
        role: "classroom_delegate",
        gender: "boy" as const,
        full_name: delegate.display_name,
        is_active: true
      };
      socket.data.classroomDelegate = classroomDelegate;
    } else {
      profile = await getCachedAuth(supabaseAdmin, token);
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
    socket.data.userId = profile.userId;
    socket.data.displayName = profile.full_name;
    socket.data.role = profile.role;
    socket.data.gender = profile.gender;
    logSocketAuthenticated(logger, socket);
    next();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "FORBIDDEN") {
      next(new Error("FORBIDDEN"));
    } else {
      next(new Error("UNAUTHORIZED"));
    }
  }
});

io.on("connection", (socket) => {
  const originalOn = socket.on.bind(socket);
  const HOT_SOCKET_EVENTS = new Set(["LIVE_DELTA"]);
  let lastWhiteboardRejectionAt = 0;
  socket.on = (event: string, listener: (...args: any[]) => void | Promise<void>) => {
    if (HOT_SOCKET_EVENTS.has(event)) {
      return originalOn(event, listener);
    }
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

  function trackSocket(
    event: string,
    started: number,
    result: { ok?: boolean; error?: { code?: string } },
    sessionId?: string
  ) {
    logSocketEvent(logger, stats, "game-server", socket, event, {
      ok: result.ok !== false,
      code: result.error?.code,
      sessionId,
      durationMs: Date.now() - started
    });
  }

  function wrapAck<T>(
    event: string,
    started: number,
    sessionId: string | undefined,
    ack?: (r: T) => void
  ): ((r: T) => void) | undefined {
    if (!ack) return undefined;
    return (result: T) => {
      const outcome = result as { ok?: boolean; error?: { code?: string } };
      trackSocket(event, started, outcome, sessionId);
      ack(result);
    };
  }

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
      canResume: room.paused && !isRoomIdle(room),
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

  async function hasConcurrentPlayerSocket(sessionId: string) {
    const connected = await io.in(`session:${sessionId}`).fetchSockets();
    return connected.some(
      (peer) =>
        peer.id !== socket.id &&
        peer.data.userId === userId &&
        peer.data.sessionId === sessionId &&
        peer.data.isSpectator !== true
    );
  }

  function shouldSkipFullSnapshot(gameKey: string, intent: unknown): boolean {
    if (!intent || typeof intent !== "object") return false;
    const typed = intent as { type?: string; kind?: string };
    if (gameKey === "drawing" && typed.type === "CHECKPOINT") return true;
    if (gameKey === "breakout" && typed.kind === "save-snapshot") return true;
    return false;
  }

  function estimatePayloadBytes(value: unknown): number {
    try {
      return Buffer.byteLength(JSON.stringify(value), "utf8");
    } catch {
      return Number.POSITIVE_INFINITY;
    }
  }

  async function isClassroomDrawingHost(room: Room<unknown>): Promise<boolean> {
    const classroom = socket.data.classroomDrawing as
      | { sessionId: string; roomCode: string; isHost: boolean }
      | undefined;
    if (room.gameKey !== "drawing" || !classroom || classroom.sessionId !== room.sessionId) return true;
    // Regular drawing games intentionally remain collaborative. The host-only
    // rule is the classroom policy, identified by its reserved invite code.
    return classroom.isHost;
  }

  async function canEditClassroomDrawing(room: Room<unknown>): Promise<boolean> {
    const classroom = socket.data.classroomDrawing as
      | { sessionId: string; roomCode: string; isHost: boolean }
      | undefined;
    if (room.gameKey !== "drawing") return true;
    // Teachers are ordinary-game observers even when their account is the
    // persisted host. Classroom teachers retain their policy-driven access.
    if (!classroom || classroom.sessionId !== room.sessionId) {
      return socket.data.role !== "teacher";
    }
    if (classroom.isHost) return true;
    return classroomDrawingPolicies.get(classroom.roomCode)?.allowWhiteboardDraw === true;
  }

  function isCanonicalClassroomDrawing(room: Room<unknown>): boolean {
    // Every drawing room is server-owned. Classroom policy is an additional
    // authorization layer, not a different synchronization protocol.
    return room.gameKey === "drawing";
  }

  function drawingLogContext(room: Room<unknown>, operation: string): Record<string, unknown> {
    const classroom = socket.data.classroomDrawing;
    return classroom?.sessionId === room.sessionId
      ? {
          component: "drawing-board",
          boardMode: "classroom",
          operation,
          classroomId: classroom.classroomId,
          roomCode: classroom.roomCode
        }
      : { component: "drawing-board", boardMode: "game", operation };
  }

  function liveClassroomDrawingState(room: Room<unknown>): ClassroomDrawingLiveState {
    const existing = classroomDrawingLiveStates.get(room.sessionId);
    if (existing) return existing;
    const created = createClassroomDrawingState(room.state as any);
    classroomDrawingLiveStates.set(room.sessionId, created);
    logger.info({
      userId,
      sessionId: room.sessionId,
      protocol: "socket",
      message: "Canonical drawing state initialized",
      context: {
        ...drawingLogContext(room, "canonical_state_initialize"),
        event: "DRAWING_CANONICAL_STATE_INITIALIZED",
        source: (room.state as { canvas?: { elements?: unknown[] } } | null)?.canvas?.elements?.length ? "checkpoint" : "empty",
        revision: created.revision
      }
    });
    return created;
  }

  function serveCanonicalClassroomDrawing(room: Room<unknown>, reason: string): void {
    const syncToken = nextClassroomDrawingSyncToken(socket.id);
    const operationId = `drawing-sync:${socket.id}:${Date.now()}`;
    const timerKey = `${socket.id}:${room.sessionId}`;
    const priorTimer = classroomDrawingSyncTimers.get(timerKey);
    if (priorTimer) clearTimeout(priorTimer);
    socket.data.classroomDrawingSync = {
      sessionId: room.sessionId,
      token: syncToken,
      acknowledged: false,
      revision: liveClassroomDrawingState(room).revision,
      operationId,
      startedAt: Date.now(),
      attempts: (socket.data.classroomDrawingSync?.attempts ?? 0) + 1,
      reason
    };
    socket.emit("DRAWING_SYNC", {
      sessionId: room.sessionId,
      yjsUpdate: encodeFullClassroomDrawingState(liveClassroomDrawingState(room)),
      syncToken,
      viewport: classroomDrawingViewports.get(room.sessionId)
    });
    const timer = setTimeout(() => {
      const pending = socket.data.classroomDrawingSync;
      if (pending?.operationId !== operationId || pending.acknowledged) return;
      logger.warn({
        userId,
        sessionId: room.sessionId,
        protocol: "socket",
        message: "Classroom drawing initial sync timed out",
        context: {
          ...drawingLogContext(room, "initial_sync"),
          event: "DRAWING_INITIAL_SYNC_FAILED",
          status: "failed",
          code: "SYNC_ACK_TIMEOUT",
          reason,
          attempts: pending.attempts,
          duration_ms: Date.now() - (pending.startedAt ?? Date.now())
        }
      });
    }, 15_000);
    timer.unref?.();
    classroomDrawingSyncTimers.set(timerKey, timer);
  }

  function applyLiveClassroomSnapshot(room: Room<unknown>): unknown {
    const state = liveClassroomDrawingState(room);
    const seats = (room.state as { seats?: Record<string, string> } | null)?.seats;
    const snapshot = snapshotClassroomDrawingState(state, seats);
    room.state = snapshot;
    return snapshot;
  }

  async function persistLiveClassroomDrawing(room: Room<unknown>, reason: string): Promise<void> {
    const state = classroomDrawingLiveStates.get(room.sessionId);
    if (!state?.dirty || !supabaseAdmin) return;
    const snapshot = applyLiveClassroomSnapshot(room);
    await persistDrawingCheckpoint(supabaseAdmin, room.sessionId, snapshot);
    markClassroomDrawingPersisted(state);
  }

  function connectedPayload(room: Room<unknown>) {
    const players = connectedPlayers(room);
    return {
      connectedPlayerIds: players.map((p) => p.userId),
      connectedPlayerNames: players.map((p) => p.displayName)
    };
  }

  function resetForRematch(room: Room<unknown>, rematchPlayers = connectedPlayers(room)) {
    const orderedPlayers = playersForRematch(room, rematchPlayers);
    const seats = orderedPlayers.map((p) => ({
      userId: p.userId,
      displayName: p.displayName
    }));
    let tc: any = undefined;
    if (room.module.key === "chess" && room.state && typeof room.state === "object") {
      tc = (room.state as any).timeControl;
    }
    if (room.module.key === "chess" && tc) {
      room.state = (room.module as any).initialState(seats, tc);
    } else {
      room.state = room.module.initialState(seats);
    }
    room.players = new Map(orderedPlayers.map((p) => [p.userId, p]));
    room.roster = orderedPlayers;
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
      payload: { sessionId: string; invitationCode?: string },
      ack?: (r: unknown) => void
    ) => {
      const started = Date.now();
      const sessionId = payload?.sessionId;
      const reply = wrapAck("JOIN_ROOM", started, sessionId, ack);
      if (!sessionId) {
        reply?.({ ok: false, error: { code: "BAD_REQUEST", message: "sessionId required" } });
        return;
      }
      const prevSessionId = socket.data.sessionId as string | undefined;
      if (prevSessionId && prevSessionId !== sessionId) {
        await handleLeave(prevSessionId);
      }
      if (!supabaseAdmin) {
        reply?.({ ok: false, error: { code: "SERVER_CONFIG", message: "Supabase not configured" } });
        return;
      }
      const { data: session, error } = await supabaseAdmin
        .from("game_sessions")
        .select(
          "id, game_id, gender, player_ids, player_names, host_id, status, game_state, is_open, invitation_code, peak_player_count, games ( game_url, min_players )"
        )
        .eq("id", sessionId)
        .maybeSingle();
      if (error || !session) {
        reply?.({ ok: false, error: { code: "NOT_FOUND", message: "Session not found" } });
        return;
      }
      const gameRow = (session as { games?: { game_url?: string; min_players?: number } | null })
        .games;
      const gameKey = gameRow?.game_url ?? "";
      const gameModule = getGameModule(gameKey);
      if (!gameModule) {
        reply?.({
          ok: false,
          error: { code: "GAME_UNSUPPORTED", message: `No module for game '${gameKey}'` }
        });
        return;
      }
      if (session.gender && session.gender !== "all" && (session.gender as string) !== gender) {
        reply?.({
          ok: false,
          error: { code: "GENDER_MISMATCH", message: "Wrong gender partition" }
        });
        return;
      }
      const sess = session as { status?: string; game_state?: unknown };
      const existingRoom = getRoom(sessionId);
      const playerIds = ((session.player_ids as string[]) ?? []).map(String);
      const playerNames = ((session.player_names as string[]) ?? []).map(String);
      const role = socket.data.role as string;
      const hostId = String(session.host_id ?? "");
      const isOpen = (session as { is_open?: boolean }).is_open !== false;
      const classroomRoomCode =
        gameKey === "drawing" && String(session.invitation_code ?? "").startsWith("class-draw-")
          ? String(session.invitation_code).slice("class-draw-".length)
          : null;
      if (classroomRoomCode) {
        let policy: ClassroomDrawingPolicy = {
          classroomId: "unknown",
          allowWhiteboardDraw: false
        };
        try {
          policy = await loadClassroomDrawingPolicy(classroomRoomCode);
        } catch (err) {
          logger.warn({
            message: "Classroom drawing policy load failed",
            sessionId,
            error: err instanceof Error ? err.message : String(err)
          });
        }
        const delegate = socket.data.classroomDelegate as
          | { roomCode: string; identity: string }
          | undefined;
        socket.data.classroomDrawing = {
          sessionId,
          classroomId: policy.classroomId,
          roomCode: classroomRoomCode,
          isHost:
            role === "teacher" ||
            role === "admin" ||
            hostId === userId ||
            (delegate?.roomCode === classroomRoomCode && delegate.identity === userId)
        };
        logger.info({
          userId,
          sessionId,
          protocol: "socket",
          message: "Drawing board context resolved",
          context: {
            event: "DRAWING_BOARD_CONTEXT_RESOLVED",
            component: "drawing-board",
            boardMode: "classroom",
            classroomId: policy.classroomId,
            roomCode: classroomRoomCode,
            isHost: socket.data.classroomDrawing.isHost,
            allowWhiteboardDraw: policy.allowWhiteboardDraw,
            isDelegate: Boolean(socket.data.classroomDelegate)
          }
        });
      } else {
        socket.data.classroomDrawing = undefined;
        if (gameKey === "drawing") {
          logger.info({
            userId,
            sessionId,
            protocol: "socket",
            message: "Drawing board context resolved",
            context: {
              event: "DRAWING_BOARD_CONTEXT_RESOLVED",
              component: "drawing-board",
              boardMode: "game"
            }
          });
        }
      }
      if (
        !isOpen &&
        role !== "teacher" &&
        !playerIds.includes(userId) &&
        hostId !== userId
      ) {
        const invited = await canJoinClosedSession({
          supabase: supabaseAdmin,
          sessionId,
          userId,
          sessionInvitationCode: String(
            (session as { invitation_code?: string }).invitation_code ?? ""
          ),
          invitationCode: payload?.invitationCode
        });
        if (!invited) {
          reply?.({
            ok: false,
            error: {
              code: "SESSION_CLOSED",
              message: "החדר סגור — נדרשת הזמנה"
            }
          });
          return;
        }
      }
      if (sess.status === "paused" && !playerIds.includes(userId) && !classroomRoomCode) {
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
          error: {
            code: "SESSION_COMPLETED",
            message: "המשחק כבר הסתיים"
          }
        });
        return;
      }
      const resumedState =
        sess.game_state != null && (sess.status === "paused" || gameKey === "drawing")
          ? sess.game_state
          : undefined;
      const room = getOrCreateRoom(sessionId, {
        gameId: session.game_id as string,
        gameKey,
        module: gameModule,
        gender: (session.gender as "boy" | "girl" | "all") || gender,
        hostId: session.host_id as string,
        minPlayers: gameRow?.min_players ?? gameModule.minPlayers,
        roster: playerIds.map((id, i) => ({
          userId: id,
          displayName: playerNames[i] ?? "שחקן"
        })),
        paused: sess.status === "paused",
        peakPlayerCount: (session as any).peak_player_count ?? 0,
        resumedState
      });
      if (!existingRoom) {
        stats.onRoomCreated(sessionId, gameKey);
      }
      // Teachers observe sessions rather than taking a player seat. Drawing
      // used to be the exception here, which made the teacher's drawing view
      // initialize as an editor (and could consume the last available seat).
      // Keep the host exception so a teacher who owns the session can still
      // operate their own board.
      if (role === "teacher") {
        attachSpectator(room, userId, displayName);
        await socket.join(`session:${sessionId}`);
        socket.data.sessionId = sessionId;
        socket.data.isSpectator = true;
        if (gameKey === "drawing") {
          serveCanonicalClassroomDrawing(room, "teacher-spectator-join");
        }
        emitSnapshot(room);
        const spectateAck = wrapAck("SPECTATE", started, sessionId, ack);
        spectateAck?.({ ok: true, spectator: true });
        return;
      }
      const wasIdle = isRoomIdle(room);
      const assigned = assignPlayer(room, userId, displayName);
      if ("error" in assigned) {
        reply?.({ ok: false, error: assigned.error });
        return;
      }
      if (room.paused && classroomRoomCode) {
        resumeRoom(room);
      }
      if (!isRoomIdle(room)) {
        if (wasIdle) {
          for (const p of room.players.values()) {
            recordLaunch(sessionId, p.userId, room.gameKey);
          }
        } else {
          recordLaunch(sessionId, userId, room.gameKey);
        }
      }
      socket.data.isSpectator = false;
      await socket.join(`session:${sessionId}`);
      socket.data.sessionId = sessionId;
      if (gameKey === "drawing") {
        serveCanonicalClassroomDrawing(room, "join");
      }
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
        roomStatusIsIdle: isRoomIdle(room),
        peakPlayerCount: room.peakPlayerCount
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
      reply?.({ ok: true, player: assigned.player });
    }
  );

  socket.on(
    "DRAWING_SYNC_ACK",
    (payload: { sessionId?: string; syncToken?: string }) => {
      const sessionId = payload?.sessionId;
      const room = sessionId ? getRoom(sessionId) : undefined;
      const sync = socket.data.classroomDrawingSync;
      if (
        !room ||
        !isCanonicalClassroomDrawing(room) ||
        sync?.sessionId !== sessionId ||
        sync.token !== payload?.syncToken
      ) {
        return;
      }
      sync.acknowledged = true;
      const timerKey = `${socket.id}:${sessionId}`;
      const timer = classroomDrawingSyncTimers.get(timerKey);
      if (timer) clearTimeout(timer);
      classroomDrawingSyncTimers.delete(timerKey);
      // Deltas can arrive while a browser is mounting the board and before it
      // has registered its LIVE_DELTA listener. Acknowledge only the exact
      // revision it bound; otherwise provide a fresh canonical replacement.
      // This makes a reload converge even while another player is drawing.
      if (liveClassroomDrawingState(room).revision !== sync.revision) {
        serveCanonicalClassroomDrawing(room, "changed-during-initial-sync");
        return;
      }
      logger.info({
        userId,
        sessionId,
        protocol: "socket",
        message: "Classroom drawing sync completed",
        context: {
          ...drawingLogContext(room, sync.reason === "join" || sync.reason === "teacher-spectator-join" ? "initial_sync" : "recovery_sync"),
          event: sync.reason === "join" || sync.reason === "teacher-spectator-join" ? "DRAWING_INITIAL_SYNC_COMPLETED" : "DRAWING_RECOVERY_SYNC_COMPLETED",
          status: "success",
          reason: sync.reason,
          attempts: sync.attempts,
          duration_ms: Date.now() - (sync.startedAt ?? Date.now())
        }
      });
    }
  );

  socket.on(
    "LIVE_DELTA",
    async (payload: { sessionId?: string; delta?: unknown }) => {
      const sessionId = payload?.sessionId;
      const delta = payload?.delta;
      const boundSessionId = socket.data.sessionId as string | undefined;
      if (!sessionId || delta === undefined) return;
      if (!boundSessionId || boundSessionId !== sessionId) return;
      const room = getRoom(sessionId);
      if (!room) return;
      // Authorized classroom teachers and delegates may intentionally be
      // attached as spectators so they do not consume a drawing-game seat.
      // The classroom policy below remains the authority for their edits.
      if (!room.players.has(userId) && !isCanonicalClassroomDrawing(room)) return;

      if (isCanonicalClassroomDrawing(room)) {
        const typed = typeof delta === "object" && delta !== null ? delta as Record<string, unknown> : null;
        if (!typed) return;
        if (estimatePayloadBytes(delta) > MAX_LIVE_DELTA_BYTES) {
          logger.warn({
            userId,
            sessionId,
            protocol: "socket",
            message: "Classroom drawing update rejected for payload size",
            context: {
              ...drawingLogContext(room, "apply_delta"),
              event: "DRAWING_UPDATE_REJECTED",
              status: "failed",
              code: "PAYLOAD_TOO_LARGE"
            }
          });
          socket.emit("LIVE_DELTA_REJECTED", {
            sessionId,
            code: "PAYLOAD_TOO_LARGE"
          });
          serveCanonicalClassroomDrawing(room, "payload-too-large");
          return;
        }

        const yjsUpdate = typed.yjsUpdate;
        const yjsAwareness = typed.yjsAwareness;
        const yjsAwarenessRemove = typed.yjsAwarenessRemove;
        const viewport = typed.viewport;
        if (viewport && typeof viewport === "object" && !Array.isArray(viewport)) {
          if (!(await isClassroomDrawingHost(room))) {
            logger.warn({
              userId,
              sessionId,
              protocol: "socket",
              message: "Classroom drawing viewport update denied",
              context: {
                ...drawingLogContext(room, "viewport_update"),
                event: "DRAWING_VIEWPORT_REJECTED",
                status: "failed",
                code: "WHITEBOARD_HOST_REQUIRED"
              }
            });
            return;
          }
          const candidate = viewport as Record<string, unknown>;
          const scrollX = Number(candidate.scrollX);
          const scrollY = Number(candidate.scrollY);
          const zoom = Number(candidate.zoom);
          if (
            !Number.isFinite(scrollX) || Math.abs(scrollX) > 10_000_000 ||
            !Number.isFinite(scrollY) || Math.abs(scrollY) > 10_000_000 ||
            !Number.isFinite(zoom) || zoom < 0.01 || zoom > 30
          ) {
            logger.warn({
              userId,
              sessionId,
              protocol: "socket",
              message: "Classroom drawing viewport rejected",
              context: {
                ...drawingLogContext(room, "viewport_update"),
                event: "DRAWING_VIEWPORT_REJECTED",
                status: "failed",
                code: "INVALID_VIEWPORT"
              }
            });
            return;
          }
          const nextViewport = { scrollX, scrollY, zoom };
          classroomDrawingViewports.set(room.sessionId, nextViewport);
          socket.to(`session:${room.sessionId}`).emit("LIVE_DELTA", {
            from: userId,
            delta: { viewport: nextViewport }
          });
          return;
        }
        if (Array.isArray(yjsAwarenessRemove)) {
          // A clear/recovery gives every socket a new document and token.
          // Do not let teardown or initialization awareness from the old/new
          // browser document leak into the canonical room before that exact
          // document has been bound and acknowledged.
          if (!socket.data.classroomDrawingSync?.acknowledged) return;
          const knownClientIds = socket.data.classroomDrawingAwarenessClientIds as number[] | undefined;
          const removedClientIds = yjsAwarenessRemove.filter(
            (clientId): clientId is number =>
              Number.isSafeInteger(clientId) && knownClientIds?.includes(clientId) === true
          );
          if (removedClientIds.length > 0) {
            socket.data.classroomDrawingAwarenessClientIds = knownClientIds?.filter(
              (clientId) => !removedClientIds.includes(clientId)
            );
            socket.to(`session:${room.sessionId}`).emit("LIVE_DELTA", {
              from: userId,
              delta: { yjsAwarenessRemove: removedClientIds }
            });
          }
          return;
        }
        if (typeof yjsUpdate !== "string" && typeof yjsAwareness !== "string") {
          return;
        }
        if (typeof yjsAwareness === "string" && !socket.data.classroomDrawingSync?.acknowledged) {
          return;
        }
        if (!(await canEditClassroomDrawing(room))) {
          if (Date.now() - lastWhiteboardRejectionAt >= 10_000) {
            lastWhiteboardRejectionAt = Date.now();
            logger.warn({
              userId,
              sessionId,
              protocol: "socket",
              message: "Classroom drawing update rejected",
              context: {
                ...drawingLogContext(room, "apply_delta"),
                event: "DRAWING_UPDATE_REJECTED",
                status: "failed",
                code: "WHITEBOARD_EDIT_FORBIDDEN"
              }
            });
          }
          socket.emit("LIVE_DELTA_REJECTED", {
            sessionId,
            code: "WHITEBOARD_EDIT_FORBIDDEN"
          });
          serveCanonicalClassroomDrawing(room, "permission-rejected");
          return;
        }

        if (typeof yjsUpdate === "string") {
          const liveState = liveClassroomDrawingState(room);
          const elementCountBefore = canvasFromDoc(liveState.doc).elements.length;
          const result = applyClassroomDrawingSocketUpdate(
            liveState,
            socket.data.classroomDrawingSync,
            sessionId,
            yjsUpdate
          );
          if (!result.ok) {
            if (result.code === "SYNC_NOT_ACKNOWLEDGED") {
              logger.warn({
                userId,
                sessionId,
                protocol: "socket",
                message: "Ignored classroom drawing update before canonical sync acknowledgement",
              context: {
                ...drawingLogContext(room, "apply_delta"),
                event: "DRAWING_UPDATE_REJECTED",
                status: "failed",
                code: "SYNC_NOT_ACKNOWLEDGED"
              }
              });
              serveCanonicalClassroomDrawing(room, "update-before-sync");
              return;
            }
            logger.warn({
              userId,
              sessionId,
              protocol: "socket",
              message: "Classroom drawing Yjs update rejected",
              context: {
                ...drawingLogContext(room, "apply_delta"),
                event: "DRAWING_UPDATE_REJECTED",
                status: "failed",
                code: result.code
              }
            });
            serveCanonicalClassroomDrawing(room, "invalid-update");
            return;
          }
          const elementCountAfter = canvasFromDoc(liveState.doc).elements.length;
          if (elementCountBefore > 0 && elementCountAfter === 0) {
            logger.warn({
              userId,
              sessionId,
              protocol: "socket",
              message: "Classroom drawing delta emptied the canonical board",
              context: {
                event: "CLASSROOM_DRAWING_DOCUMENT_EMPTIED_BY_DELTA",
                elementCountBefore
              }
            });
          }
          socket.to(`session:${room.sessionId}`).emit("LIVE_DELTA", {
            from: userId,
            delta: { yjsUpdate }
          });
          return;
        }

        const awarenessClientIds = Array.isArray(typed.yjsAwarenessClientIds)
          ? typed.yjsAwarenessClientIds.filter((clientId): clientId is number => Number.isSafeInteger(clientId))
          : [];
        socket.data.classroomDrawingAwarenessClientIds = awarenessClientIds;
        socket.to(`session:${room.sessionId}`).emit("LIVE_DELTA", {
          from: userId,
          delta: { yjsAwareness }
        });
        return;
      }

    }
  );

  socket.on(
    "CLASSROOM_DELEGATE_ACTIVATED",
    (payload: { sessionId?: string; delegateGameToken?: string }) => {
      const classroom = socket.data.classroomDrawing as
        | { sessionId: string; classroomId: string; roomCode: string; isHost: boolean }
        | undefined;
      const token =
        typeof payload?.delegateGameToken === "string"
          ? verifyClassroomDelegateGameToken(payload.delegateGameToken, SUPABASE_SERVICE_ROLE_KEY)
          : null;
      if (
        !classroom ||
        payload?.sessionId !== classroom.sessionId ||
        !token ||
        token.roomCode !== classroom.roomCode
      ) {
        logger.warn({
          userId,
          sessionId: payload?.sessionId,
          protocol: "socket",
          message: "Classroom delegate activation rejected",
          context: { event: "CLASSROOM_DELEGATE_ACTIVATION_REJECTED" }
        });
        return;
      }
      classroom.isHost = true;
      logger.info({
        userId,
        sessionId: classroom.sessionId,
        protocol: "socket",
        message: "Classroom delegate activated on current board socket",
        context: { event: "CLASSROOM_DELEGATE_SOCKET_ACTIVATED", roomCode: classroom.roomCode }
      });
    }
  );

  socket.on(
    "CLASSROOM_WHITEBOARD_POLICY",
    (payload: { sessionId?: string; allowWhiteboardDraw?: unknown }) => {
      const sessionId = payload?.sessionId;
      const classroom = socket.data.classroomDrawing as
        | { sessionId: string; classroomId: string; roomCode: string; isHost: boolean }
        | undefined;
      if (
        !sessionId ||
        socket.data.sessionId !== sessionId ||
        !classroom ||
        classroom.sessionId !== sessionId ||
        !classroom.isHost ||
        typeof payload.allowWhiteboardDraw !== "boolean"
      ) {
        return;
      }
      classroomDrawingPolicies.set(classroom.roomCode, {
        ...(classroomDrawingPolicies.get(classroom.roomCode) ?? { classroomId: classroom.classroomId }),
        allowWhiteboardDraw: payload.allowWhiteboardDraw
      });
    }
  );

  socket.on(
    "INTENT_GAME",
    async (
      payload: { sessionId?: string; intent?: unknown },
      ack?: (r: unknown) => void
    ) => {
      const started = Date.now();
      const sessionId = payload?.sessionId;
      const reply = wrapAck("INTENT", started, sessionId, ack);
      if (!sessionId || payload?.intent === undefined) {
        reply?.({
          ok: false,
          error: { code: "BAD_REQUEST", message: "sessionId and intent required" }
        });
        return;
      }
      const boundSessionId = socket.data.sessionId as string | undefined;
      if (!boundSessionId || boundSessionId !== sessionId) {
        reply?.({
          ok: false,
          error: { code: "NOT_IN_ROOM", message: "לא בחדר הפעיל" }
        });
        return;
      }
      const room = getRoom(sessionId);
      if (!room) {
        reply?.({ ok: false, error: { code: "NOT_FOUND", message: "Room not loaded" } });
        return;
      }
      if (room.paused) {
        reply?.({
          ok: false,
          error: { code: "GAME_PAUSED", message: "המשחק מושהה" }
        });
        return;
      }
      if (socket.data.role === "teacher" && room.gameKey !== "drawing") {
        reply?.({
          ok: false,
          error: { code: "READ_ONLY", message: "Observers cannot send moves" }
        });
        return;
      }
      const drawingIntent = payload.intent as { type?: string };
      if (isCanonicalClassroomDrawing(room)) {
        if (!(await canEditClassroomDrawing(room))) {
          reply?.({ ok: false, error: { code: "READ_ONLY", message: "Observers cannot change the board" } });
          return;
        }
        if (drawingIntent.type === "CHECKPOINT") {
          try {
            await persistLiveClassroomDrawing(room, "explicit-request");
            reply?.({ ok: true, gameState: room.state });
          } catch (err) {
            logger.error({
              message: "Classroom drawing checkpoint persistence failed",
              sessionId,
              error: err instanceof Error ? err.message : String(err)
            });
            reply?.({ ok: false, error: { code: "PERSIST_FAILED", message: "Could not save board" } });
          }
          return;
        }
        if (drawingIntent.type === "CLEAR_CANVAS") {
          if (!(await isClassroomDrawingHost(room))) {
            reply?.({ ok: false, error: { code: "UNAUTHORIZED", message: "Only a classroom host can clear the board" } });
            return;
          }
          const liveState = liveClassroomDrawingState(room);
          clearClassroomDrawingState(liveState);
          const snapshot = applyLiveClassroomSnapshot(room);
          const recipients = await io.in(`session:${sessionId}`).fetchSockets();
          const yjsUpdate = encodeFullClassroomDrawingState(liveState);
          const awarenessClientIds = [...new Set(recipients.flatMap((recipient) =>
            (recipient.data.classroomDrawingAwarenessClientIds as number[] | undefined) ?? []
          ))];
          for (const recipient of recipients) {
            // Awareness is scoped to the replaced browser documents. Remove
            // every old cursor before installing the clear document so no
            // phantom pointer remains on a peer.
            if (awarenessClientIds.length > 0) {
              recipient.emit("LIVE_DELTA", {
                from: userId,
                delta: { yjsAwarenessRemove: awarenessClientIds }
              });
            }
            recipient.data.classroomDrawingAwarenessClientIds = undefined;
            const syncToken = nextClassroomDrawingSyncToken(recipient.id);
            recipient.data.classroomDrawingSync = {
              sessionId,
              token: syncToken,
              acknowledged: false,
              revision: liveState.revision
            };
            recipient.emit("DRAWING_SYNC", { sessionId, yjsUpdate, syncToken });
          }
          try {
            await persistLiveClassroomDrawing(room, "clear");
          } catch (err) {
            logger.error({
              message: "Classroom drawing clear persistence failed",
              sessionId,
              error: err instanceof Error ? err.message : String(err)
            });
          }
          logger.info({
            userId,
            sessionId,
            protocol: "socket",
            message: "Classroom drawing board cleared",
            context: {
              ...drawingLogContext(room, "clear"),
              event: "DRAWING_BOARD_CLEARED",
              status: "success",
              revision: liveState.revision,
              clearRevision: liveState.clearRevision
            }
          });
          reply?.({ ok: true, gameState: snapshot });
          return;
        }
      }
      if (
        room.gameKey === "drawing" &&
        (drawingIntent.type === "CHECKPOINT" || drawingIntent.type === "CLEAR_CANVAS") &&
        !(await isClassroomDrawingHost(room))
      ) {
        reply?.({
          ok: false,
          error: { code: "UNAUTHORIZED", message: "Only a classroom host can change the board" }
        });
        return;
      }
      const res = applyIntent(room, userId, payload.intent);
      if (!res.ok) {
        reply?.({ ok: false, error: res.error });
        return;
      }
      const skipSnapshot = shouldSkipFullSnapshot(room.gameKey, payload.intent);
      if (!skipSnapshot) {
        emitSnapshot(room);
      }
      if (
        room.gameKey === "drawing" &&
        (drawingIntent.type === "CHECKPOINT" || drawingIntent.type === "CLEAR_CANVAS") &&
        supabaseAdmin
      ) {
        void persistDrawingCheckpoint(supabaseAdmin, sessionId, res.state).catch((err) => {
          logger.error({
            message: "Drawing checkpoint persistence failed",
            sessionId,
            error: err instanceof Error ? err.message : String(err)
          });
        });
      }
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
          void persistLaunches(supabaseAdmin, sessionId);
        }
      }
      reply?.(
        skipSnapshot
          ? { ok: true, gameState: res.state }
          : { ok: true }
      );
    }
  );

  socket.on(
    "STOP_GAME",
    async (
      payload: { sessionId?: string } | undefined,
      ack?: (r: unknown) => void
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
        void persistLaunches(supabaseAdmin, sessionId);
      }
      deleteRoom(sessionId);
      stats.onRoomDeleted(sessionId);
      reply?.({ ok: true });
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
      const guard = canResumeGame(room, userId);
      if (!guard.ok) {
        ack?.({ ok: false, error: guard.error });
        return;
      }
      resumeRoom(room);
      for (const p of room.players.values()) {
        recordLaunch(sessionId, p.userId, room.gameKey);
      }
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
      const started = Date.now();
      const sessionId =
        payload?.sessionId ?? (socket.data.sessionId as string | undefined);
      const reply = wrapAck("REMATCH", started, sessionId, ack);
      if (!sessionId) {
        reply?.({
          ok: false,
          error: { code: "BAD_REQUEST", message: "sessionId required" }
        });
        return;
      }
      if (socket.data.role === "teacher") {
        reply?.({
          ok: false,
          error: { code: "READ_ONLY", message: "צופים לא יכולים לבקש משחק חוזר" }
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
      if (room.gameKey === "breakout") {
        reply?.({
          ok: false,
          error: { code: "NO_REMATCH", message: "משחק חוזר לא נתמך במשחק זה" }
        });
        return;
      }
      const guard = canStopGame(room, userId);
      if (!guard.ok) {
        reply?.({ ok: false, error: guard.error });
        return;
      }
      if (!room.module.isTerminal(room.state)) {
        reply?.({
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
      reply?.({ ok: true });
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
      if (room.gameKey === "breakout") {
        ack?.({
          ok: false,
          error: { code: "NO_REMATCH", message: "משחק חוזר לא נתמך במשחק זה" }
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
      if (socket.data.sessionId !== sessionId) {
        ack?.({
          ok: false,
          error: { code: "NOT_IN_ROOM", message: "לא בחדר הפעיל" }
        });
        return;
      }
      const room = getRoom(sessionId);
      if (!room || !room.players.has(userId)) {
        ack?.({
          ok: false,
          error: { code: "NOT_IN_ROOM", message: "לא בחדר" }
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
    const awarenessClientIds = [
      ...(socket.data.classroomDrawingAwarenessClientIds ?? []),
      ...(socket.data.drawingAwarenessClientIds ?? [])
    ];
    if (awarenessClientIds?.length) {
      socket.to(`session:${sessionId}`).emit("LIVE_DELTA", {
        from: userId,
        delta: { yjsAwarenessRemove: [...new Set(awarenessClientIds)] }
      });
      socket.data.classroomDrawingAwarenessClientIds = undefined;
      socket.data.drawingAwarenessClientIds = undefined;
    }
    if (await hasConcurrentPlayerSocket(sessionId)) {
      await socket.leave(`session:${sessionId}`);
      if (socket.data.sessionId === sessionId) {
        socket.data.sessionId = undefined;
      }
      return;
    }
    if (socket.data.isSpectator) {
      const spectatorRoom = getRoom(sessionId);
      const isClassroomSpectator = spectatorRoom && isCanonicalClassroomDrawing(spectatorRoom);
      if (spectatorRoom && isClassroomSpectator) {
        try {
          await persistLiveClassroomDrawing(spectatorRoom, "teacher-spectator-leave");
        } catch (err) {
          logger.error({
            message: "Classroom drawing spectator leave persistence failed",
            sessionId,
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }
      removeSpectatorFromRoom(sessionId, userId);
      const room = getRoom(sessionId);
      if (room) emitSnapshot(room);
      if (!room && isClassroomSpectator) {
        classroomDrawingLiveStates.delete(sessionId);
      }
      await socket.leave(`session:${sessionId}`);
      if (socket.data.sessionId === sessionId) {
        socket.data.sessionId = undefined;
      }
      socket.data.isSpectator = false;
      return;
    }
    const before = getRoom(sessionId);
    const classroomHostId = before && isCanonicalClassroomDrawing(before) ? before.hostId : undefined;
    if (before && classroomHostId) {
      try {
        await persistLiveClassroomDrawing(before, "last-socket-leave");
      } catch (err) {
        logger.error({
          message: "Classroom drawing leave persistence failed",
          sessionId,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }
    const result = removePlayerFromRoom(sessionId, userId);
    if (classroomHostId) {
      // The drawing room is an implementation detail of the persistent
      // classroom. Do not transfer its database host to a student merely
      // because the teacher refreshed or temporarily disconnected.
      result.newHostId = undefined;
      const remainingRoom = getRoom(sessionId);
      if (remainingRoom) remainingRoom.hostId = classroomHostId;
    }
    if (result.roomEmpty) {
      stats.onRoomDeleted(sessionId);
      classroomDrawingLiveStates.delete(sessionId);
      classroomDrawingViewports.delete(sessionId);
    }
    const room = getRoom(sessionId);
    if (supabaseAdmin) {
      const connected = room
        ? connectedPayload(room)
        : { connectedPlayerIds: [], connectedPlayerNames: [] };
      await persistPlayerLeave({
        supabase: supabaseAdmin,
        sessionId,
        result,
        ...connected,
        gameState: before?.state,
        peakPlayerCount: before?.peakPlayerCount
      });
      if (result.roomEmpty) {
        void persistLaunches(supabaseAdmin, sessionId);
      }
      if (room && !room.paused && room.hasBeenActive && !room.module.isTerminal(room.state) && room.players.size < room.minPlayers) {
        room.paused = true;
        room.rematch = undefined;
        await persistGamePaused({
          supabase: supabaseAdmin,
          sessionId,
          gameState: room.state,
          ...connected
        });
        io.to(`session:${sessionId}`).emit("ROOM_EVENT", {
          sessionId,
          kind: "GAME_PAUSED"
        });
      }
    } else {
      if (room && !room.paused && room.hasBeenActive && !room.module.isTerminal(room.state) && room.players.size < room.minPlayers) {
        room.paused = true;
        room.rematch = undefined;
        io.to(`session:${sessionId}`).emit("ROOM_EVENT", {
          sessionId,
          kind: "GAME_PAUSED"
        });
      }
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
    const pendingSync = socket.data.classroomDrawingSync;
    if (pendingSync && !pendingSync.acknowledged) {
      const pendingRoom = getRoom(pendingSync.sessionId);
      if (pendingRoom && isCanonicalClassroomDrawing(pendingRoom)) {
        logger.warn({
          userId,
          sessionId: pendingSync.sessionId,
          protocol: "socket",
          message: "Classroom drawing sync interrupted by disconnect",
          context: {
            ...drawingLogContext(pendingRoom, "initial_sync"),
            event: "DRAWING_INITIAL_SYNC_FAILED",
            status: "failed",
            code: "DISCONNECTED_BEFORE_ACK",
            reason: pendingSync.reason,
            duration_ms: Date.now() - (pendingSync.startedAt ?? Date.now())
          }
        });
      }
      const timer = classroomDrawingSyncTimers.get(`${socket.id}:${pendingSync.sessionId}`);
      if (timer) clearTimeout(timer);
      classroomDrawingSyncTimers.delete(`${socket.id}:${pendingSync.sessionId}`);
    }
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
    io,
    logError: (message, err) =>
      logger.error({
        message,
        error: err instanceof Error ? err.message : String(err)
      })
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
  logger.info({ message: `game-server listening on ${PORT}`, protocol: "http" });
});
