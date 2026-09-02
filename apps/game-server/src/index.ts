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
import {
  getGameModule,
  isWithinEffectiveRecess,
  type ClassRecessException,
  type ClassRecessSchedule,
  type RecessWindow
} from "@playground/game-logic";
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
  preservesHostOnDisconnect,
  removePlayerFromRoom,
  removeSpectatorFromRoom,
  roomRoster,
  type DrawingRoomContext,
  type Room
} from "./room";
import {
  persistPlayerJoin,
  persistPlayerLeave,
  persistDrawingCheckpoint,
  persistChildSpectatorPresence
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
  matchesClassroomBoardCapability,
  shouldEnforceRecessForSocket,
  verifyClassroomBoardToken
} from "./classroomBoardToken";
import {
  applyCanonicalDrawingSocketUpdate,
  clearCanonicalDrawingState,
  createCanonicalDrawingState,
  destroyCanonicalDrawingState,
  encodeFullCanonicalDrawingState,
  isCanonicalDrawingDirty,
  markCanonicalDrawingPersisted,
  snapshotCanonicalDrawingState,
  type CanonicalDrawingLiveState
} from "./canonicalDrawingState";
import { drawingLogContext, drawingSyncPhase } from "./drawingObservability";
import { KeyedSingleFlight } from "./keyedSingleFlight";
import { createGameVoiceToken, GameVoiceConfigError } from "./gameVoiceToken";

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

function isGameInspectorRole(role: unknown): role is "teacher" | "admin" {
  return role === "teacher" || role === "admin";
}

interface ClassroomDrawingPolicy {
  classroomId: string;
  allowWhiteboardDraw: boolean;
  active: boolean;
}

const classroomDrawingPolicies = new Map<string, ClassroomDrawingPolicy>();
const classroomDrawingPolicyLoads = new Map<string, Promise<ClassroomDrawingPolicy>>();
const canonicalDrawingLiveStates = new Map<string, CanonicalDrawingLiveState>();
const canonicalDrawingPersistence = new KeyedSingleFlight();
const classroomDrawingViewports = new Map<string, { scrollX: number; scrollY: number; zoom: number }>();
const canonicalDrawingSyncTimers = new Map<string, ReturnType<typeof setTimeout>>();
let canonicalDrawingSyncSerial = 0;

function nextCanonicalDrawingSyncToken(socketId: string): string {
  canonicalDrawingSyncSerial += 1;
  return `${socketId}:${Date.now()}:${canonicalDrawingSyncSerial}`;
}

async function loadClassroomDrawingPolicy(
  roomCode: string,
  expectedClassroomId?: string,
  forceRefresh = false
): Promise<ClassroomDrawingPolicy> {
  if (!forceRefresh) {
    const cached = classroomDrawingPolicies.get(roomCode);
    if (cached) return cached;
    const pending = classroomDrawingPolicyLoads.get(roomCode);
    if (pending) return pending;
  }

  const load = (async () => {
    if (!supabaseAdmin) return { classroomId: "unknown", allowWhiteboardDraw: false, active: false };
    const { data, error } = await supabaseAdmin
      .from("classroom_sessions")
      .select("id, settings, status")
      .eq("room_code", roomCode)
      .match(expectedClassroomId ? { id: expectedClassroomId } : {})
      .maybeSingle();
    if (error) throw error;
    const policy = {
      classroomId: String(data?.id ?? "unknown"),
      active: data?.status === "active",
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

interface DrawingPersistenceActor {
  correlationId?: string;
  userId?: string;
}

async function persistCanonicalDrawing(
  room: Room<unknown>,
  reason: string,
  actor: DrawingPersistenceActor = {},
  flushLatest = false
): Promise<void> {
  const state = canonicalDrawingLiveStates.get(room.sessionId);
  if (!state || !supabaseAdmin || !isCanonicalDrawingDirty(state)) return;

  const flight = canonicalDrawingPersistence.run(room.sessionId, async () => {
    if (!isCanonicalDrawingDirty(state)) return;
    const persistedRevision = state.revision;
    const seats = (room.state as { seats?: Record<string, string> } | null)?.seats;
    const snapshot = snapshotCanonicalDrawingState(state, seats);
    room.state = snapshot;
    try {
      await persistDrawingCheckpoint(supabaseAdmin, room.sessionId, snapshot);
      markCanonicalDrawingPersisted(state, persistedRevision);
      logger.info({
        correlationId: actor.correlationId,
        userId: actor.userId,
        sessionId: room.sessionId,
        protocol: "internal",
        message: "Canonical drawing checkpoint persisted",
        context: {
          ...drawingLogContext(room, "checkpoint_persist"),
          event: "DRAWING_CHECKPOINT_PERSISTED",
          status: "success",
          reason,
          revision: persistedRevision,
          newerRevisionPending: isCanonicalDrawingDirty(state)
        }
      });
    } catch (err) {
      logger.error({
        correlationId: actor.correlationId,
        userId: actor.userId,
        sessionId: room.sessionId,
        protocol: "internal",
        message: "Canonical drawing checkpoint persistence failed",
        context: {
          ...drawingLogContext(room, "checkpoint_persist"),
          event: "DRAWING_CHECKPOINT_PERSIST_FAILED",
          status: "failed",
          reason,
          revision: persistedRevision
        },
        err: logError(err)
      });
      throw err;
    }
  });
  await flight.promise;
  if (flushLatest && isCanonicalDrawingDirty(state)) {
    await persistCanonicalDrawing(room, reason, actor, true);
  }
}

const DRAWING_CHECKPOINT_MS = 60_000;
setInterval(() => {
  if (!supabaseAdmin) return;
  for (const [sessionId, state] of canonicalDrawingLiveStates) {
    if (!isCanonicalDrawingDirty(state)) continue;
    const room = getRoom(sessionId);
    if (!room) continue;
    void persistCanonicalDrawing(room, "interval").catch(() => {});
  }
}, DRAWING_CHECKPOINT_MS);

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
  defaultWindows: RecessWindow[];
  settings: { grade: string; gender: "boy" | "girl"; override_enabled: boolean }[];
  exceptions: (ClassRecessException & { grade: string; gender: "boy" | "girl" })[];
  fetchedAt: number;
} = { defaultWindows: [], settings: [], exceptions: [], fetchedAt: 0 };

async function loadRecessScheduleData() {
  if (!supabaseAdmin) throw new Error("missing_supabase_admin");
  const now = Date.now();
  if (now - recessCache.fetchedAt < 30_000) {
    return recessCache;
  }
  const [defaults, settings, exceptions] = await Promise.all([
    supabaseAdmin.from("recess_schedules").select("day_of_week, start_time, end_time, is_active").eq("is_active", true),
    supabaseAdmin.from("class_recess_schedule_settings").select("grade, gender, override_enabled"),
    supabaseAdmin.from("class_recess_schedule_exceptions").select("grade, gender, day_of_week, start_time, end_time, mode, is_active").eq("is_active", true)
  ]);
  const error = defaults.error ?? settings.error ?? exceptions.error;
  if (error) {
    logger.error({ message: "recess schedule fetch failed", error: error.message });
    throw new Error("recess_schedules_unavailable");
  }
  recessCache = {
    defaultWindows: (defaults.data ?? []) as RecessWindow[],
    settings: (settings.data ?? []) as typeof recessCache.settings,
    exceptions: (exceptions.data ?? []) as typeof recessCache.exceptions,
    fetchedAt: now
  };
  return recessCache;
}

async function isProfileWithinRecess(profile: { grade: string | null; gender: "boy" | "girl" }): Promise<boolean> {
  if (!profile.grade) return false;
  const data = await loadRecessScheduleData();
  const setting = data.settings.find((row) => row.grade === profile.grade && row.gender === profile.gender);
  const classSchedule: ClassRecessSchedule | null = setting
    ? {
        overrideEnabled: setting.override_enabled,
        exceptions: data.exceptions.filter((row) => row.grade === profile.grade && row.gender === profile.gender)
      }
    : null;
  return isWithinEffectiveRecess(new Date(), { defaultWindows: data.defaultWindows, classSchedule });
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
    const classroomBoardCapability = token.startsWith("classroom-board:")
      ? verifyClassroomBoardToken(
          token.slice("classroom-board:".length),
          SUPABASE_SERVICE_ROLE_KEY
        )
      : null;
    if (token.startsWith("classroom-board:") && !classroomBoardCapability) {
      logger.warn({
        message: "Classroom board socket token rejected",
        context: { event: "CLASSROOM_BOARD_SOCKET_DENIED", code: "INVALID_CAPABILITY" }
      });
      next(new Error("UNAUTHORIZED"));
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

    let profile: {
      userId: string;
      role: string;
      gender: "boy" | "girl";
      grade: string | null;
      full_name: string;
      is_active: boolean;
    };
    if (classroomBoardCapability) {
      const { data: classroom } = await supabaseAdmin
        .from("classroom_sessions")
        .select("id")
        .eq("id", classroomBoardCapability.classroomId)
        .eq("room_code", classroomBoardCapability.roomCode)
        .eq("status", "active")
        .maybeSingle();
      if (!classroom) {
        next(new Error("FORBIDDEN"));
        return;
      }
      profile = {
        userId: classroomBoardCapability.identity,
        role: classroomBoardCapability.role,
        gender: "boy" as const,
        grade: null,
        full_name: classroomBoardCapability.displayName,
        is_active: true
      };
      socket.data.classroomBoardCapability = classroomBoardCapability;
    } else if (classroomDelegate) {
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
        grade: null,
        full_name: delegate.display_name,
        is_active: true
      };
      socket.data.classroomDelegate = classroomDelegate;
    } else {
      profile = await getCachedAuth(supabaseAdmin, token);
    }
    if (shouldEnforceRecessForSocket(profile.role, classroomBoardCapability)) {
      try {
        if (!await isProfileWithinRecess(profile)) {
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
    socket.data.grade = profile.grade;
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
  const lastDrawingRejectionAt = new Map<string, number>();
  const shouldLogDrawingRejection = (code: string): boolean => {
    const now = Date.now();
    const previous = lastDrawingRejectionAt.get(code) ?? 0;
    if (now - previous < 10_000) return false;
    lastDrawingRejectionAt.set(code, now);
    return true;
  };
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
      // Teacher observers remain connected for their existing sync and voice
      // behavior, but are intentionally invisible in the child-facing viewer
      // roster. Only children who overflowed player capacity are shown.
      spectators: Array.from(room.spectators.values()).filter((spectator) =>
        room.childSpectatorIds.has(spectator.userId)
      ),
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
        peer.data.isSpectator === (socket.data.isSpectator === true)
    );
  }

  async function persistChildSpectators(room: Room<unknown>): Promise<void> {
    if (!supabaseAdmin) return;
    await persistChildSpectatorPresence({
      supabase: supabaseAdmin,
      sessionId: room.sessionId,
      userIds: Array.from(room.childSpectatorIds)
    });
  }

  function shouldSkipFullSnapshot(gameKey: string, intent: unknown): boolean {
    if (!intent || typeof intent !== "object") return false;
    const typed = intent as { type?: string; kind?: string };
    if (gameKey === "breakout" && typed.kind === "save-snapshot") return true;
    return false;
  }

  function estimateCanonicalPayloadBytes(value: Record<string, unknown>): number {
    const kinds = [
      typeof value.yjsUpdate === "string",
      typeof value.yjsAwareness === "string",
      Array.isArray(value.yjsAwarenessRemove),
      value.viewport !== null && typeof value.viewport === "object" && !Array.isArray(value.viewport)
    ].filter(Boolean).length;
    if (kinds !== 1) return Number.POSITIVE_INFINITY;
    if (typeof value.yjsUpdate === "string") return Buffer.byteLength(value.yjsUpdate, "utf8");
    if (typeof value.yjsAwareness === "string") {
      return Buffer.byteLength(value.yjsAwareness, "utf8") +
        (Array.isArray(value.yjsAwarenessClientIds) ? value.yjsAwarenessClientIds.length * 16 : 0);
    }
    if (Array.isArray(value.yjsAwarenessRemove)) return value.yjsAwarenessRemove.length * 16;
    return 128;
  }

  async function canClearDrawing(room: Room<unknown>): Promise<boolean> {
    const classroom = socket.data.classroomDrawing as
      | { sessionId: string; roomCode: string; isHost: boolean }
      | undefined;
    if (room.gameKey !== "drawing") return false;
    if (room.drawingContext?.boardMode !== "classroom") return room.players.has(userId);
    return classroom?.sessionId === room.sessionId && classroom.isHost;
  }

  async function canEditDrawing(room: Room<unknown>): Promise<boolean> {
    const classroom = socket.data.classroomDrawing as
      | { sessionId: string; classroomId: string; roomCode: string; isHost: boolean }
      | undefined;
    if (room.gameKey !== "drawing") return true;
    if (room.drawingContext?.boardMode !== "classroom") {
      return !isGameInspectorRole(socket.data.role) && room.players.has(userId);
    }
    if (!classroom || classroom.sessionId !== room.sessionId) return false;
    if (classroom.isHost) return true;
    if (classroomDrawingPolicies.get(classroom.roomCode)?.allowWhiteboardDraw === true) {
      return true;
    }
    try {
      const freshPolicy = await loadClassroomDrawingPolicy(classroom.roomCode, classroom.classroomId, true);
      return freshPolicy?.allowWhiteboardDraw === true;
    } catch {
      return false;
    }
  }

  function isCanonicalDrawingRoom(room: Room<unknown>): boolean {
    // Every drawing room is server-owned. Classroom policy is an additional
    // authorization layer, not a different synchronization protocol.
    return room.gameKey === "drawing";
  }

  function liveCanonicalDrawingState(room: Room<unknown>): CanonicalDrawingLiveState {
    const existing = canonicalDrawingLiveStates.get(room.sessionId);
    if (existing) return existing;
    const created = createCanonicalDrawingState(room.state as any);
    canonicalDrawingLiveStates.set(room.sessionId, created);
    logger.info({
      correlationId: socket.data.correlationId,
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

  function serveCanonicalDrawing(room: Room<unknown>, reason: string): void {
    const syncToken = nextCanonicalDrawingSyncToken(socket.id);
    const operationId = `drawing-sync:${socket.id}:${Date.now()}`;
    const timerKey = `${socket.id}:${room.sessionId}`;
    const priorTimer = canonicalDrawingSyncTimers.get(timerKey);
    if (priorTimer) clearTimeout(priorTimer);
    socket.data.canonicalDrawingSync = {
      sessionId: room.sessionId,
      token: syncToken,
      acknowledged: false,
      revision: liveCanonicalDrawingState(room).revision,
      operationId,
      startedAt: Date.now(),
      attempts: (socket.data.canonicalDrawingSync?.attempts ?? 0) + 1,
      reason
    };
    socket.emit("DRAWING_SYNC", {
      sessionId: room.sessionId,
      yjsUpdate: encodeFullCanonicalDrawingState(liveCanonicalDrawingState(room)),
      syncToken,
      viewport: room.drawingContext?.boardMode === "classroom"
        ? classroomDrawingViewports.get(room.sessionId)
        : undefined
    });
    const timer = setTimeout(() => {
      const pending = socket.data.canonicalDrawingSync;
      if (pending?.operationId !== operationId || pending.acknowledged) return;
      const phase = drawingSyncPhase(reason);
      logger.warn({
        correlationId: socket.data.correlationId,
        userId,
        sessionId: room.sessionId,
        protocol: "socket",
        message: "Canonical drawing sync timed out",
        context: {
          ...drawingLogContext(room, phase),
          event: phase === "initial_sync" ? "DRAWING_INITIAL_SYNC_FAILED" : "DRAWING_RECOVERY_SYNC_FAILED",
          status: "failed",
          code: "SYNC_ACK_TIMEOUT",
          reason,
          attempts: pending.attempts,
          duration_ms: Date.now() - (pending.startedAt ?? Date.now())
        }
      });
    }, 15_000);
    timer.unref?.();
    canonicalDrawingSyncTimers.set(timerKey, timer);
  }

  function applyLiveCanonicalSnapshot(room: Room<unknown>): unknown {
    const state = liveCanonicalDrawingState(room);
    const seats = (room.state as { seats?: Record<string, string> } | null)?.seats;
    const snapshot = snapshotCanonicalDrawingState(state, seats);
    room.state = snapshot;
    return snapshot;
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
    "VOICE_TOKEN",
    async (
      payload: { sessionId?: string },
      ack?: (result: {
        ok: boolean;
        token?: string;
        serverUrl?: string;
        error?: { code: string; message: string };
      }) => void
    ) => {
      const started = Date.now();
      const sessionId = payload?.sessionId;
      const reply = wrapAck("VOICE_TOKEN", started, sessionId, ack);
      const room = sessionId ? getRoom(sessionId) : undefined;
      const joinedSessionId = socket.data.sessionId as string | undefined;
      const isCurrentParticipant =
        room &&
        joinedSessionId === sessionId &&
        (room.players.has(userId) || room.spectators.has(userId));
      if (!sessionId || !room || !isCurrentParticipant) {
        reply?.({
          ok: false,
          error: { code: "NOT_IN_ROOM", message: "Join the game before connecting voice chat." }
        });
        return;
      }
      if (room.drawingContext?.boardMode === "classroom") {
        reply?.({
          ok: false,
          error: { code: "CLASSROOM_VOICE", message: "Classroom audio uses the classroom voice room." }
        });
        return;
      }
      try {
        const voice = await createGameVoiceToken({ sessionId, userId, displayName });
        logger.info({
          correlationId: socket.data.correlationId,
          userId,
          sessionId,
          protocol: "socket",
          message: "Game voice token issued",
          context: {
            event: "GAME_VOICE_TOKEN_ISSUED",
            livekitRoom: voice.livekitRoom,
            status: "success"
          }
        });
        reply?.({ ok: true, token: voice.token, serverUrl: voice.serverUrl });
      } catch (err) {
        const configError = err instanceof GameVoiceConfigError;
        logger.warn({
          correlationId: socket.data.correlationId,
          userId,
          sessionId,
          protocol: "socket",
          message: "Game voice token denied",
          context: {
            event: "GAME_VOICE_TOKEN_DENIED",
            reason: configError ? "server_config" : "token_generation_failed",
            status: "failed"
          }
        });
        reply?.({
          ok: false,
          error: {
            code: configError ? "SERVER_CONFIG" : "VOICE_TOKEN_FAILED",
            message: configError
              ? "Voice chat is not configured."
              : "Could not connect voice chat."
          }
        });
      }
    }
  );

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
          "id, game_id, classroom_id, gender, player_ids, player_names, host_id, status, game_state, is_open, invitation_code, peak_player_count, games ( game_url, min_players )"
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
      if (!isGameInspectorRole(socket.data.role) && session.gender && session.gender !== "all" && (session.gender as string) !== gender) {
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
      const hostId = session.host_id ? String(session.host_id) : null;
      const isOpen = (session as { is_open?: boolean }).is_open !== false;
      const classroomId = session.classroom_id ? String(session.classroom_id) : null;
      const classroomRoomCode =
        gameKey === "drawing" && classroomId && String(session.invitation_code ?? "").startsWith("class-draw-")
          ? String(session.invitation_code).slice("class-draw-".length)
          : null;
      let drawingContext: DrawingRoomContext | undefined = gameKey === "drawing"
        ? { boardMode: "game" }
        : undefined;
      if (classroomRoomCode) {
        let policy: ClassroomDrawingPolicy = {
          classroomId: "unknown",
          allowWhiteboardDraw: false,
          active: false
        };
        try {
          policy = await loadClassroomDrawingPolicy(classroomRoomCode, classroomId ?? undefined);
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
        const boardCapability = socket.data.classroomBoardCapability;
        const hasMatchingBoardCapability = matchesClassroomBoardCapability(
          boardCapability,
          { classroomId: policy.classroomId, roomCode: classroomRoomCode },
          userId
        );
        if (!policy.active || (!hasMatchingBoardCapability && !delegate)) {
          reply?.({
            ok: false,
            error: { code: "CLASSROOM_ACCESS_REQUIRED", message: "נדרשת כניסה דרך הכיתה" }
          });
          return;
        }
        socket.data.classroomDrawing = {
          sessionId,
          classroomId: policy.classroomId,
          roomCode: classroomRoomCode,
          isHost:
            role === "teacher" ||
            role === "admin" ||
            hostId === userId ||
            (hasMatchingBoardCapability && boardCapability?.isHost === true) ||
            (delegate?.roomCode === classroomRoomCode && delegate.identity === userId)
        };
        drawingContext = {
          boardMode: "classroom",
          classroomId: policy.classroomId,
          roomCode: classroomRoomCode
        };
        logger.info({
          correlationId: socket.data.correlationId,
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
        if (socket.data.classroomBoardCapability) {
          reply?.({
            ok: false,
            error: { code: "CLASSROOM_SCOPE_MISMATCH", message: "Classroom capability cannot join a game" }
          });
          return;
        }
        socket.data.classroomDrawing = undefined;
        if (gameKey === "drawing") {
          logger.info({
            correlationId: socket.data.correlationId,
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
        !isGameInspectorRole(role) &&
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
        drawingContext,
        module: gameModule,
        gender: (session.gender as "boy" | "girl" | "all") || gender,
        hostId,
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
      if (isGameInspectorRole(role)) {
        attachSpectator(room, userId, displayName);
        await socket.join(`session:${sessionId}`);
        socket.data.sessionId = sessionId;
        socket.data.isSpectator = true;
        if (gameKey === "drawing") {
          serveCanonicalDrawing(room, "teacher-spectator-join");
        }
        emitSnapshot(room);
        const spectateAck = wrapAck("SPECTATE", started, sessionId, ack);
        spectateAck?.({ ok: true, spectator: true });
        return;
      }
      const wasIdle = isRoomIdle(room);
      const playerCountBeforeJoin = room.players.size;
      const assigned = assignPlayer(room, userId, displayName);
      if ("error" in assigned) {
        // Only a child who overflowed an otherwise joinable shared game gets
        // spectator mode. Teachers keep their established branch above, and
        // every other join rejection keeps its existing behavior.
        if (assigned.error.code === "ROOM_FULL" && role === "kid") {
          attachSpectator(room, userId, displayName, { childSpectator: true });
          try {
            await persistChildSpectators(room);
          } catch (error) {
            removeSpectatorFromRoom(sessionId, userId);
            reply?.({
              ok: false,
              error: {
                code: "PERSIST_FAILED",
                message: error instanceof Error ? error.message : "לא ניתן לחבר צופה לצ׳אט"
              }
            });
            return;
          }
          await socket.join(`session:${sessionId}`);
          socket.data.sessionId = sessionId;
          socket.data.isSpectator = true;
          if (gameKey === "drawing") {
            serveCanonicalDrawing(room, "child-spectator-join");
          }
          emitSnapshot(room);
          reply?.({ ok: true, spectator: true });
          return;
        }
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
        serveCanonicalDrawing(room, "join");
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
      if (
        isOpen &&
        playerCountBeforeJoin < room.module.maxPlayers &&
        room.players.size === room.module.maxPlayers
      ) {
        const peers = await io.in(`session:${sessionId}`).fetchSockets();
        for (const peer of peers) {
          if (peer.data.userId === room.hostId) {
            peer.emit("ROOM_EVENT", { sessionId, kind: "ROOM_FULL" });
          }
        }
      }
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
      const sync = socket.data.canonicalDrawingSync;
      if (
        !room ||
        !isCanonicalDrawingRoom(room) ||
        sync?.sessionId !== sessionId ||
        sync.token !== payload?.syncToken
      ) {
        return;
      }
      sync.acknowledged = true;
      const timerKey = `${socket.id}:${sessionId}`;
      const timer = canonicalDrawingSyncTimers.get(timerKey);
      if (timer) clearTimeout(timer);
      canonicalDrawingSyncTimers.delete(timerKey);
      // Deltas can arrive while a browser is mounting the board and before it
      // has registered its LIVE_DELTA listener. Acknowledge only the exact
      // revision it bound; otherwise provide a fresh canonical replacement.
      // This makes a reload converge even while another player is drawing.
      if (liveCanonicalDrawingState(room).revision !== sync.revision) {
        serveCanonicalDrawing(room, "changed-during-initial-sync");
        return;
      }
      logger.info({
        correlationId: socket.data.correlationId,
        userId,
        sessionId,
        protocol: "socket",
        message: "Canonical drawing sync completed",
        context: {
          ...drawingLogContext(room, drawingSyncPhase(sync.reason)),
          event: drawingSyncPhase(sync.reason) === "initial_sync" ? "DRAWING_INITIAL_SYNC_COMPLETED" : "DRAWING_RECOVERY_SYNC_COMPLETED",
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
      if (socket.data.isSpectator === true && !isGameInspectorRole(socket.data.role)) return;
      // Authorized classroom teachers and delegates may intentionally be
      // attached as spectators so they do not consume a drawing-game seat.
      // The classroom policy below remains the authority for their edits.
      if (!room.players.has(userId) && !isCanonicalDrawingRoom(room)) return;

      if (isCanonicalDrawingRoom(room)) {
        const typed = typeof delta === "object" && delta !== null ? delta as Record<string, unknown> : null;
        if (!typed) return;
        if (estimateCanonicalPayloadBytes(typed) > MAX_LIVE_DELTA_BYTES) {
          if (shouldLogDrawingRejection("PAYLOAD_TOO_LARGE")) {
            logger.warn({
              correlationId: socket.data.correlationId,
              userId,
              sessionId,
              protocol: "socket",
              message: "Canonical drawing update rejected for payload size",
              context: {
                ...drawingLogContext(room, "apply_delta"),
                event: "DRAWING_UPDATE_REJECTED",
                status: "failed",
                code: "PAYLOAD_TOO_LARGE"
              }
            });
          }
          socket.emit("LIVE_DELTA_REJECTED", {
            sessionId,
            code: "PAYLOAD_TOO_LARGE"
          });
          serveCanonicalDrawing(room, "payload-too-large");
          return;
        }

        const yjsUpdate = typed.yjsUpdate;
        const yjsAwareness = typed.yjsAwareness;
        const yjsAwarenessRemove = typed.yjsAwarenessRemove;
        const viewport = typed.viewport;
        if (viewport && typeof viewport === "object" && !Array.isArray(viewport)) {
          if (room.drawingContext?.boardMode !== "classroom") return;
          if (!(await canClearDrawing(room))) {
            if (shouldLogDrawingRejection("WHITEBOARD_HOST_REQUIRED")) {
              logger.warn({
                correlationId: socket.data.correlationId,
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
            }
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
            if (shouldLogDrawingRejection("INVALID_VIEWPORT")) {
              logger.warn({
                correlationId: socket.data.correlationId,
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
            }
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
          if (!socket.data.canonicalDrawingSync?.acknowledged) return;
          const knownClientIds = socket.data.canonicalDrawingAwarenessClientIds as number[] | undefined;
          const removedClientIds = yjsAwarenessRemove.filter(
            (clientId): clientId is number =>
              Number.isSafeInteger(clientId) && knownClientIds?.includes(clientId) === true
          );
          if (removedClientIds.length > 0) {
            socket.data.canonicalDrawingAwarenessClientIds = knownClientIds?.filter(
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
        if (typeof yjsAwareness === "string" && !socket.data.canonicalDrawingSync?.acknowledged) {
          return;
        }

        if (typeof yjsUpdate === "string") {
          if (!(await canEditDrawing(room))) {
            if (shouldLogDrawingRejection("WHITEBOARD_EDIT_FORBIDDEN")) {
              logger.warn({
                correlationId: socket.data.correlationId,
                userId,
                sessionId,
                protocol: "socket",
                message: "Canonical drawing update rejected",
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
            serveCanonicalDrawing(room, "permission-rejected");
            return;
          }

          const liveState = liveCanonicalDrawingState(room);
          const validationStarted = Date.now();
          const result = applyCanonicalDrawingSocketUpdate(
            liveState,
            socket.data.canonicalDrawingSync,
            sessionId,
            yjsUpdate
          );
          const validationDurationMs = Date.now() - validationStarted;
          if (validationDurationMs >= 25 && shouldLogDrawingRejection("SLOW_VALIDATION")) {
            logger.warn({
              correlationId: socket.data.correlationId,
              userId,
              sessionId,
              protocol: "socket",
              message: "Canonical drawing validation was slow",
              context: {
                ...drawingLogContext(room, "apply_delta"),
                event: "DRAWING_VALIDATION_SLOW",
                status: result.ok ? "success" : "failed",
                duration_ms: validationDurationMs,
                update_bytes: Buffer.byteLength(yjsUpdate, "utf8"),
                revision: liveState.revision
              }
            });
          }
          if (!result.ok) {
            if (result.code === "SYNC_NOT_ACKNOWLEDGED") {
              if (shouldLogDrawingRejection("SYNC_NOT_ACKNOWLEDGED")) {
                logger.warn({
                  correlationId: socket.data.correlationId,
                  userId,
                  sessionId,
                  protocol: "socket",
                  message: "Ignored drawing update before canonical sync acknowledgement",
                  context: {
                    ...drawingLogContext(room, "apply_delta"),
                    event: "DRAWING_UPDATE_REJECTED",
                    status: "failed",
                    code: "SYNC_NOT_ACKNOWLEDGED"
                  }
                });
              }
              serveCanonicalDrawing(room, "update-before-sync");
              return;
            }
            if (shouldLogDrawingRejection(result.code)) {
              logger.warn({
                correlationId: socket.data.correlationId,
                userId,
                sessionId,
                protocol: "socket",
                message: "Canonical drawing Yjs update rejected",
                context: {
                  ...drawingLogContext(room, "apply_delta"),
                  event: "DRAWING_UPDATE_REJECTED",
                  status: "failed",
                  code: result.code
                }
              });
            }
            serveCanonicalDrawing(room, "invalid-update");
            return;
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
        socket.data.canonicalDrawingAwarenessClientIds = awarenessClientIds;
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
        ...(classroomDrawingPolicies.get(classroom.roomCode) ?? {
          classroomId: classroom.classroomId,
          active: true
        }),
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
      // Child overflow viewers never get a gameplay path. Keep teacher
      // observers out of this guard: classroom drawing has its own existing
      // teacher/delegate authorization in canEditDrawing().
      if (socket.data.isSpectator === true && !isGameInspectorRole(socket.data.role)) {
        reply?.({
          ok: false,
          error: { code: "READ_ONLY", message: "צופים לא יכולים לבצע מהלכים" }
        });
        return;
      }
      if (room.paused) {
        reply?.({
          ok: false,
          error: { code: "GAME_PAUSED", message: "המשחק מושהה" }
        });
        return;
      }
      if (isGameInspectorRole(socket.data.role) && room.gameKey !== "drawing") {
        reply?.({
          ok: false,
          error: { code: "READ_ONLY", message: "Observers cannot send moves" }
        });
        return;
      }
      const drawingIntent = payload.intent as { type?: string };
      if (isCanonicalDrawingRoom(room)) {
        if (!(await canEditDrawing(room))) {
          reply?.({ ok: false, error: { code: "READ_ONLY", message: "Observers cannot change the board" } });
          return;
        }
        if (drawingIntent.type === "CLEAR_CANVAS") {
          if (!(await canClearDrawing(room))) {
            reply?.({ ok: false, error: { code: "UNAUTHORIZED", message: "Only a classroom host can clear the board" } });
            return;
          }
          const liveState = liveCanonicalDrawingState(room);
          clearCanonicalDrawingState(liveState);
          const snapshot = applyLiveCanonicalSnapshot(room);
          const recipients = await io.in(`session:${sessionId}`).fetchSockets();
          const yjsUpdate = encodeFullCanonicalDrawingState(liveState);
          const awarenessClientIds = [...new Set(recipients.flatMap((recipient) =>
            (recipient.data.canonicalDrawingAwarenessClientIds as number[] | undefined) ?? []
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
            recipient.data.canonicalDrawingAwarenessClientIds = undefined;
            const syncToken = nextCanonicalDrawingSyncToken(recipient.id);
            const operationId = `drawing-sync:${recipient.id}:${Date.now()}`;
            const timerKey = `${recipient.id}:${sessionId}`;
            const priorTimer = canonicalDrawingSyncTimers.get(timerKey);
            if (priorTimer) clearTimeout(priorTimer);
            recipient.data.canonicalDrawingSync = {
              sessionId,
              token: syncToken,
              acknowledged: false,
              revision: liveState.revision,
              operationId,
              startedAt: Date.now(),
              attempts: 1,
              reason: "clear"
            };
            recipient.emit("DRAWING_SYNC", { sessionId, yjsUpdate, syncToken });
            const timer = setTimeout(() => {
              const pending = recipient.data.canonicalDrawingSync;
              if (pending?.operationId !== operationId || pending.acknowledged) return;
              logger.warn({
                correlationId: recipient.data.correlationId,
                userId: recipient.data.userId,
                sessionId,
                protocol: "socket",
                message: "Canonical drawing recovery sync timed out",
                context: {
                  ...drawingLogContext(room, "recovery_sync"),
                  event: "DRAWING_RECOVERY_SYNC_FAILED",
                  status: "failed",
                  code: "SYNC_ACK_TIMEOUT",
                  reason: "clear",
                  attempts: 1,
                  duration_ms: 15_000
                }
              });
            }, 15_000);
            timer.unref?.();
            canonicalDrawingSyncTimers.set(timerKey, timer);
          }
          await persistCanonicalDrawing(
            room,
            "clear",
            { correlationId: socket.data.correlationId, userId },
            true
          ).catch(() => {});
          logger.info({
            correlationId: socket.data.correlationId,
            userId,
            sessionId,
            protocol: "socket",
            message: "Canonical drawing board cleared",
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
      const res = applyIntent(room, userId, payload.intent);
      if (!res.ok) {
        reply?.({ ok: false, error: res.error });
        return;
      }
      const skipSnapshot = shouldSkipFullSnapshot(room.gameKey, payload.intent);
      if (!skipSnapshot) {
        emitSnapshot(room);
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
      if (isGameInspectorRole(socket.data.role)) {
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
      if (isGameInspectorRole(socket.data.role)) {
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
      if (isGameInspectorRole(socket.data.role)) {
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
      const canChildSpectatorChat =
        !isGameInspectorRole(socket.data.role) && room?.childSpectatorIds.has(userId) === true;
      if (!room || (!room.players.has(userId) && !canChildSpectatorChat)) {
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
      ...(socket.data.canonicalDrawingAwarenessClientIds ?? [])
    ];
    if (awarenessClientIds?.length) {
      socket.to(`session:${sessionId}`).emit("LIVE_DELTA", {
        from: userId,
        delta: { yjsAwarenessRemove: [...new Set(awarenessClientIds)] }
      });
      socket.data.canonicalDrawingAwarenessClientIds = undefined;
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
      const isClassroomSpectator = spectatorRoom?.drawingContext?.boardMode === "classroom";
      const wasChildSpectator = spectatorRoom?.childSpectatorIds.has(userId) === true;
      if (spectatorRoom && isClassroomSpectator) {
        await persistCanonicalDrawing(
          spectatorRoom,
          "teacher-spectator-leave",
          { correlationId: socket.data.correlationId, userId },
          true
        ).catch(() => {});
      }
      removeSpectatorFromRoom(sessionId, userId);
      if (wasChildSpectator && supabaseAdmin) {
        await persistChildSpectatorPresence({
          supabase: supabaseAdmin,
          sessionId,
          userIds: spectatorRoom ? Array.from(spectatorRoom.childSpectatorIds) : []
        }).catch((error) => {
          logger.warn({
            userId,
            sessionId,
            protocol: "socket",
            message: "Child spectator presence cleanup failed",
            error: error instanceof Error ? error.message : String(error)
          });
        });
      }
      const room = getRoom(sessionId);
      if (room) emitSnapshot(room);
      if (!room && isClassroomSpectator) {
        const liveState = canonicalDrawingLiveStates.get(sessionId);
        if (liveState) destroyCanonicalDrawingState(liveState);
        canonicalDrawingLiveStates.delete(sessionId);
        classroomDrawingViewports.delete(sessionId);
      }
      await socket.leave(`session:${sessionId}`);
      if (socket.data.sessionId === sessionId) {
        socket.data.sessionId = undefined;
      }
      socket.data.isSpectator = false;
      return;
    }
    const before = getRoom(sessionId);
    const classroomHostId = before && preservesHostOnDisconnect(before)
      ? before.hostId
      : undefined;
    if (before && isCanonicalDrawingRoom(before)) {
      await persistCanonicalDrawing(
        before,
        "last-socket-leave",
        { correlationId: socket.data.correlationId, userId },
        true
      ).catch(() => {});
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
    if (result.roomDeleted) {
      stats.onRoomDeleted(sessionId);
      const liveState = canonicalDrawingLiveStates.get(sessionId);
      if (liveState) destroyCanonicalDrawingState(liveState);
      canonicalDrawingLiveStates.delete(sessionId);
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
    const pendingSync = socket.data.canonicalDrawingSync;
    if (pendingSync && !pendingSync.acknowledged) {
      const pendingRoom = getRoom(pendingSync.sessionId);
      if (pendingRoom && isCanonicalDrawingRoom(pendingRoom)) {
        const phase = drawingSyncPhase(pendingSync.reason);
        logger.warn({
          correlationId: socket.data.correlationId,
          userId,
          sessionId: pendingSync.sessionId,
          protocol: "socket",
          message: "Canonical drawing sync interrupted by disconnect",
          context: {
            ...drawingLogContext(pendingRoom, phase),
            event: phase === "initial_sync" ? "DRAWING_INITIAL_SYNC_FAILED" : "DRAWING_RECOVERY_SYNC_FAILED",
            status: "failed",
            code: "DISCONNECTED_BEFORE_ACK",
            reason: pendingSync.reason,
            duration_ms: Date.now() - (pendingSync.startedAt ?? Date.now())
          }
        });
      }
      const timer = canonicalDrawingSyncTimers.get(`${socket.id}:${pendingSync.sessionId}`);
      if (timer) clearTimeout(timer);
      canonicalDrawingSyncTimers.delete(`${socket.id}:${pendingSync.sessionId}`);
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
    io,
    isKidAllowed: (grade, gender) => isProfileWithinRecess({ grade, gender }),
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
