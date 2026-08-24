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
  logError,
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
import {
  isWithinEffectiveRecess,
  type ClassRecessException,
  type ClassRecessSchedule,
  type RecessWindow
} from "@playground/game-logic";
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
  markPlayerDirty,
  removePlayerFromRoom,
  roomRoster,
  snapshotPersistedState,
  spawnFor,
  type PersistedRoomState
} from "./room";
import { startTickLoop } from "./tick";
import {
  persistGameAutosave,
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
  generateClassroomToken,
  deleteLiveKitRoom,
  evictClassroomParticipants,
  promoteClassroomParticipant,
  getClassroomParticipantBlockTarget,
  removeClassroomParticipant,
  sendClassroomDelegateEnrollment,
  broadcastClassroomData,
  sendClassroomDataToParticipant,
  listClassroomParticipants,
  syncClassroomPresenterPermissions,
  syncClassroomParticipantPermissions,
  type ClassroomLiveAttendance,
  LiveKitTokenError
} from "./livekitService";
import {
  classroomGuestAttendanceKey,
  finalizeClassroomAttendance,
  reconcileClassroomAttendance,
  recordClassroomAttendanceWebhook,
  summarizeAttendanceVisits
} from "./classroomAttendance";
import { blockClassroomParticipant } from "./classroomParticipantBlocks";
import {
  createDocumentConversionTicket,
  createPresenterCapability,
  readPresenterCapability
} from "./classroomPresentation";
import {
  CLASSROOM_DELEGATE_SCOPES,
  createClassroomDelegateGameToken,
  delegateCookieName,
  findClassroomDelegateAuthority,
  newOpaqueSecret,
  secretHash,
  type ClassroomDelegateAuthority,
  type ClassroomDelegateScope
} from "./classroomDelegates";
import { createClassroomBoardToken } from "./classroomBoardToken";
import {
  classroomDrawingSessionInsert,
  isPostgresUniqueViolation,
  type ClassroomDrawingOwner
} from "./classroomDrawingSession";
import { getCachedAuth } from "./authCache";
import { canJoinClosedSession } from "./closedSessionAccess";
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
const DOCUMENT_CONVERTER_URL = (process.env.DOCUMENT_CONVERTER_URL ?? "http://localhost:8082").replace(/\/$/, "");
const DOCUMENT_CONVERTER_SHARED_SECRET = process.env.DOCUMENT_CONVERTER_SHARED_SECRET ?? "";

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

import { recordLaunch, flushLaunches } from "./launchTracker";
import { ingestFpsBatch, flushFps } from "./fpsAggregator";

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
        error: e instanceof Error ? e.message : String(e)
      });
    }
  }
}

async function persistFps(supabase: any, sessionId: string, keepSession = false) {
  const records = flushFps(sessionId, keepSession);
  for (const record of records) {
    try {
      await supabase.from("minecraft_fps_stats").upsert({
        kid_id: record.userId,
        session_id: sessionId,
        loading_avg_fps: record.loadingAvg,
        loading_sample_count: record.loadingCount,
        runtime_avg_fps: record.runtimeAvg,
        runtime_sample_count: record.runtimeCount,
        recorded_at: new Date().toISOString()
      });
    } catch (e) {
      logger.error({
        message: "Failed to persist FPS stats for user",
        userId: record.userId,
        error: e instanceof Error ? e.message : String(e)
      });
    }
  }
}

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

let attendanceReconciliationRunning = false;
async function reconcileActiveClassroomAttendance(): Promise<void> {
  if (!supabaseAdmin || attendanceReconciliationRunning) return;
  attendanceReconciliationRunning = true;
  try {
    const { data: classrooms, error } = await supabaseAdmin
      .from("classroom_sessions")
      .select("id, room_code")
      .eq("status", "active");
    if (error) throw error;
    await reconcileClassroomAttendance(supabaseAdmin, classrooms ?? []);
  } catch (err) {
    logger.warn({
      protocol: "internal",
      message: "Classroom attendance reconciliation failed",
      context: { event: "CLASSROOM_ATTENDANCE_RECONCILIATION_FAILED" },
      err: logError(err)
    });
  } finally {
    attendanceReconciliationRunning = false;
  }
}

if (LIVEKIT_API_KEY && LIVEKIT_API_SECRET) {
  mountLiveKitWebhook(app, {
    logger,
    stats,
    apiKey: LIVEKIT_API_KEY,
    apiSecret: LIVEKIT_API_SECRET,
    onVerifiedEvent: supabaseAdmin
      ? (event) => recordClassroomAttendanceWebhook(supabaseAdmin, event)
      : undefined
  });
}
// The signed LiveKit route above must receive the untouched raw request body.
// Parse JSON only after it has been mounted.
app.use(express.json());

const CLASSROOM_CLEANUP_MIN_DAYS = 1;
const CLASSROOM_CLEANUP_MAX_DAYS = 365;
const CLASSROOM_DELEGATE_ENROLLMENT_MS = 2 * 60_000;
const CLASSROOM_DELEGATE_SESSION_MS = 365 * 24 * 60 * 60_000;

async function completeClassroomDrawingSessions(roomCodes: string[]): Promise<void> {
  if (!supabaseAdmin || roomCodes.length === 0) return;
  const { data: classrooms, error: classroomError } = await supabaseAdmin
    .from("classroom_sessions")
    .select("id")
    .in("room_code", roomCodes);
  if (classroomError) throw classroomError;
  const classroomIds = (classrooms ?? []).map((classroom) => classroom.id);
  if (classroomIds.length === 0) return;
  const { error } = await supabaseAdmin
    .from("game_sessions")
    .update({
      status: "completed",
      game_state: null,
      connected_player_ids: [],
      connected_player_names: [],
      last_activity: new Date().toISOString()
    })
    .in("classroom_id", classroomIds)
    .in("status", ["waiting", "playing", "paused"]);
  if (error) throw error;
}

async function requireClassroomManager(req: express.Request, res: express.Response) {
  const accessToken = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!accessToken || !supabaseAdmin) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }

  const actor = await getCachedAuth(supabaseAdmin, accessToken).catch(() => null);
  if (!actor || (actor.role !== "teacher" && actor.role !== "admin")) {
    res.status(403).json({ error: "forbidden" });
    return null;
  }
  return actor;
}

async function requireClassroomAdmin(req: express.Request, res: express.Response) {
  const accessToken = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!accessToken || !supabaseAdmin) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }

  const actor = await getCachedAuth(supabaseAdmin, accessToken).catch(() => null);
  if (!actor || actor.role !== "admin") {
    res.status(403).json({ error: "forbidden" });
    return null;
  }
  return actor;
}

function isTrustedBrowserOrigin(req: express.Request): boolean {
  const origin = req.headers.origin;
  return Boolean(origin && CORS_ORIGIN.split(",").map((value) => value.trim()).includes(origin));
}

type ClassroomAuthority =
  | {
      kind: "user";
      userId: string;
      actorKind: "admin" | "teacher";
    }
  | {
      kind: "delegate";
      delegate: ClassroomDelegateAuthority;
    };

async function requireClassroomAuthority(
  req: express.Request,
  res: express.Response,
  classroomId: string,
  requiredScope: ClassroomDelegateScope
): Promise<ClassroomAuthority | null> {
  const accessToken = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (accessToken && supabaseAdmin) {
    const actor = await getCachedAuth(supabaseAdmin, accessToken).catch(() => null);
    if (actor?.role === "teacher" || actor?.role === "admin") {
      return {
        kind: "user",
        userId: actor.userId,
        actorKind: actor.role === "admin" ? "admin" : "teacher"
      };
    }
  }

  if (!supabaseAdmin || !isTrustedBrowserOrigin(req)) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }
  const delegate = await findClassroomDelegateAuthority(
    supabaseAdmin,
    req,
    classroomId,
    requiredScope
  );
  if (!delegate) {
    res.status(403).json({ error: "forbidden" });
    return null;
  }
  return { kind: "delegate", delegate };
}

async function getActiveClassroom(roomCode: string) {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from("classroom_sessions")
    .select("id, room_code, teacher_id, teacher_name, settings, status")
    .eq("room_code", roomCode)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return data;
}

let drawingGameIdPromise: Promise<string> | null = null;

async function classroomDrawingGameId(): Promise<string> {
  if (!supabaseAdmin) throw new Error("server_config");
  if (drawingGameIdPromise) return drawingGameIdPromise;
  const pending = (async () => {
    const { data, error } = await supabaseAdmin
      .from("games")
      .select("id")
      .eq("game_url", "drawing")
      .maybeSingle();
    if (error || !data?.id) throw error ?? new Error("drawing_game_not_found");
    return String(data.id);
  })();
  drawingGameIdPromise = pending;
  try {
    return await pending;
  } catch (error) {
    drawingGameIdPromise = null;
    throw error;
  }
}

async function ensureClassroomDrawingSession(classroom: ClassroomDrawingOwner): Promise<string> {
  if (!supabaseAdmin) throw new Error("server_config");
  const findExisting = async () => {
    const { data, error } = await supabaseAdmin
      .from("game_sessions")
      .select("id")
      .eq("classroom_id", classroom.id)
      .maybeSingle();
    if (error) throw error;
    return data?.id ? String(data.id) : null;
  };
  const existing = await findExisting();
  if (existing) return existing;

  const gameId = await classroomDrawingGameId();
  const { data: created, error } = await supabaseAdmin
    .from("game_sessions")
    .insert(classroomDrawingSessionInsert(classroom, gameId))
    .select("id")
    .maybeSingle();
  if (created?.id) return String(created.id);
  if (isPostgresUniqueViolation(error)) {
    const raced = await findExisting();
    if (raced) return raced;
  }
  throw error ?? new Error("classroom_drawing_session_create_failed");
}

function classroomSettings(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

interface PresentationRoomState {
  presenterIdentity: string | null;
  presenterEpoch: number;
  visible: boolean;
  title: string | null;
  mediaKind: "document" | "image" | "video" | "audio" | null;
}

function presentationRoomState(settings: unknown): PresentationRoomState {
  const value = classroomSettings(settings);
  const kind = value.presentationMediaKind;
  return {
    presenterIdentity: typeof value.presentationPresenterIdentity === "string" ? value.presentationPresenterIdentity : null,
    presenterEpoch: Number.isInteger(value.presentationPresenterEpoch) ? Number(value.presentationPresenterEpoch) : 0,
    visible: value.presentationVisible === true,
    title: typeof value.presentationTitle === "string" ? value.presentationTitle : null,
    mediaKind: kind === "document" || kind === "image" || kind === "video" || kind === "audio" ? kind : null
  };
}

function presentationStatePatch(state: PresentationRoomState): Record<string, unknown> {
  return {
    presentationPresenterIdentity: state.presenterIdentity,
    presentationPresenterEpoch: state.presenterEpoch,
    presentationVisible: state.visible,
    presentationTitle: state.title,
    presentationMediaKind: state.mediaKind
  };
}

async function patchClassroomSettings(
  classroom: { id: string; settings: unknown },
  patch: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!supabaseAdmin) throw new Error("supabase_not_configured");
  const { data, error } = await supabaseAdmin.rpc("patch_classroom_session_settings", {
    p_session_id: classroom.id,
    p_patch: patch
  });
  if (error) throw error;
  const settings = Array.isArray(data) ? data[0] : data;
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    throw new Error("classroom_settings_patch_failed");
  }
  classroom.settings = settings;
  return settings as Record<string, unknown>;
}

async function persistPresentationState(classroom: { id: string; settings: unknown }, state: PresentationRoomState) {
  await patchClassroomSettings(classroom, presentationStatePatch(state));
}

function authorityIdentity(authority: ClassroomAuthority): string | null {
  return authority.kind === "delegate"
    ? `delegate:${authority.delegate.delegateId}`
    : authority.userId;
}

async function appendClassroomAudit(
  req: express.Request,
  classroom: { id: string; room_code: string },
  authority: ClassroomAuthority,
  action: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  if (!supabaseAdmin) return;
  const actorId = authority.kind === "user" ? authority.userId : null;
  const actorKind = authority.kind === "user" ? authority.actorKind : "delegate";
  const correlationId = (req as express.Request & { correlationId?: string }).correlationId;
  const { error } = await supabaseAdmin.rpc("append_audit_log", {
    p_actor_id: actorId ?? null,
    p_actor_kind: actorKind,
    p_action: action,
    p_entity_type: "classroom_session",
    p_entity_id: classroom.id,
    p_metadata: auditMetadata(correlationId, { room_code: classroom.room_code, ...metadata })
  });
  if (error) {
    logger.error({
      correlationId,
      protocol: "internal",
      err: logError(error),
      message: "Classroom audit write failed",
      context: { event: "CLASSROOM_AUDIT_WRITE_FAILED", action, classroomId: classroom.id, roomCode: classroom.room_code }
    });
  }
}

function presenterCapabilityFor(roomCode: string, state: PresentationRoomState): string | null {
  if (!state.presenterIdentity || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createPresenterCapability(roomCode, state.presenterIdentity, state.presenterEpoch, SUPABASE_SERVICE_ROLE_KEY);
}

function requirePresenterCapability(
  req: express.Request,
  res: express.Response,
  classroom: { room_code: string; settings: unknown }
): { identity: string; epoch: number } | null {
  const capability = readPresenterCapability(req.body?.presenterToken, SUPABASE_SERVICE_ROLE_KEY);
  const state = presentationRoomState(classroom.settings);
  if (
    !capability ||
    capability.roomCode !== classroom.room_code ||
    capability.identity !== state.presenterIdentity ||
    capability.epoch !== state.presenterEpoch ||
    Number(req.body?.presenterEpoch) !== state.presenterEpoch
  ) {
    res.status(403).json({ error: "presenter_required" });
    return null;
  }
  return { identity: capability.identity, epoch: capability.epoch };
}

async function assignPresenter(
  classroom: { id: string; room_code: string; settings: unknown },
  identity: string | null,
  keepVisibility = true
): Promise<PresentationRoomState> {
  const previous = presentationRoomState(classroom.settings);
  const next: PresentationRoomState = {
    ...previous,
    presenterIdentity: identity,
    presenterEpoch: previous.presenterEpoch + 1,
    visible: identity ? keepVisibility && previous.visible : false,
    title: identity ? previous.title : null,
    mediaKind: identity ? previous.mediaKind : null
  };
  await persistPresentationState(classroom, next);
  await syncClassroomPresenterPermissions(
    classroom.room_code,
    classroomSettings(classroom.settings),
    previous.presenterIdentity,
    identity
  );
  const token = presenterCapabilityFor(classroom.room_code, next);
  await broadcastClassroomData(classroom.room_code, {
    type: "PRESENTER_ASSIGNED",
    presenterIdentity: identity,
    presenterEpoch: next.presenterEpoch,
    visible: next.visible
  });
  if (identity && token) {
    await sendClassroomDataToParticipant(classroom.room_code, identity, {
      type: "PRESENTER_CAPABILITY",
      presenterIdentity: identity,
      presenterEpoch: next.presenterEpoch,
      presenterToken: token
    });
  }
  return next;
}

async function electPresenter(
  classroom: { id: string; room_code: string; teacher_id: string | null; settings: unknown },
  excludedIdentity?: string
) {
  const participants = (await listClassroomParticipants(classroom.room_code))
    .filter((participant) => participant.identity !== excludedIdentity);
  const identities = new Set(participants.map((participant) => participant.identity));
  const current = presentationRoomState(classroom.settings);
  if (current.presenterIdentity && identities.has(current.presenterIdentity)) return current;
  const creator = classroom.teacher_id && identities.has(classroom.teacher_id) ? classroom.teacher_id : null;
  const fallback = participants.filter((participant) => participant.isHost).map((participant) => participant.identity).sort()[0] ?? null;
  return assignPresenter(classroom, creator || fallback, true);
}

function setDelegateCookie(
  res: express.Response,
  delegateId: string,
  sessionId: string,
  secret: string
): void {
  res.cookie(delegateCookieName(delegateId), `${sessionId}.${secret}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    maxAge: CLASSROOM_DELEGATE_SESSION_MS
  });
}

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

app.post("/rtc/classroom-token", async (req, res) => {
  const correlationId = (req as express.Request & { correlationId?: string })
    .correlationId;
  try {
    const accessToken = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    const { roomCode, displayName, spectateMode, presenterToken: reconnectPresenterToken, guestAttendanceKey } = req.body as {
      roomCode?: string;
      displayName?: string;
      spectateMode?: "invisible" | "visible";
      presenterToken?: string;
      guestAttendanceKey?: string;
    };

    if (!roomCode) {
      res.status(400).json({ error: "missing_room_code" });
      return;
    }
    if (!supabaseAdmin) {
      res.status(503).json({ error: "server_config" });
      return;
    }

    const classroom = await getActiveClassroom(roomCode);
    if (!classroom) {
      res.status(404).json({ error: "classroom_not_found" });
      return;
    }
    let drawingSessionId: string;
    try {
      drawingSessionId = await ensureClassroomDrawingSession(classroom);
    } catch (error) {
      logger.error({
        correlationId,
        roomCode,
        protocol: "http",
        message: "Classroom drawing session provisioning failed",
        context: { event: "CLASSROOM_DRAWING_SESSION_PROVISION_FAILED", status: "failed" },
        err: logError(error)
      });
      res.status(503).json({
        error: "classroom_board_unavailable",
        message: "לוח הכיתה אינו זמין כרגע; נסו להתחבר שוב."
      });
      return;
    }
    const delegate = isTrustedBrowserOrigin(req)
      ? await findClassroomDelegateAuthority(supabaseAdmin, req, classroom.id)
      : null;
    const reconnectCapability = readPresenterCapability(reconnectPresenterToken, SUPABASE_SERVICE_ROLE_KEY);
    const reconnectState = presentationRoomState(classroom.settings);
    const presenterIdentityOverride = reconnectCapability &&
      reconnectCapability.roomCode === classroom.room_code &&
      reconnectCapability.identity === reconnectState.presenterIdentity &&
      reconnectCapability.epoch === reconnectState.presenterEpoch
        ? reconnectCapability.identity
        : undefined;

    const result = await generateClassroomToken({
      supabaseAdmin,
      roomCode,
      displayName: displayName ?? "משתתף",
      accessToken,
      spectateMode,
      delegate: delegate ? { id: delegate.delegateId, displayName: delegate.displayName } : null,
      presenterIdentityOverride,
      guestAttendanceKey: classroomGuestAttendanceKey(roomCode, guestAttendanceKey)
    });
    let presentation = presentationRoomState(classroom.settings);
    if (!presentation.presenterIdentity && result.isHost && spectateMode !== "invisible") {
      presentation = {
        presenterIdentity: result.userId,
        presenterEpoch: presentation.presenterEpoch + 1,
        visible: false,
        title: null,
        mediaKind: null
      };
      await persistPresentationState(classroom, presentation);
    }
    const delegateGameToken = delegate
      ? createClassroomDelegateGameToken(
          {
            delegateId: delegate.delegateId,
            classroomId: classroom.id,
            roomCode,
            identity: result.userId
          },
          SUPABASE_SERVICE_ROLE_KEY
        )
      : undefined;
    const classroomBoardToken = createClassroomBoardToken(
      {
        classroomId: classroom.id,
        roomCode,
        identity: result.userId,
        displayName: result.displayName,
        role: result.role as "kid" | "student" | "teacher" | "admin" | "classroom_delegate",
        isHost: result.isHost
      },
      SUPABASE_SERVICE_ROLE_KEY
    );

    logger.info({
      correlationId,
      userId: result.userId,
      roomCode,
      protocol: "http",
      message: "Classroom LiveKit token issued",
      context: {
        event: "CLASSROOM_RTC_TOKEN_ISSUED",
        livekitRoom: result.livekitRoom,
        isHost: result.isHost,
        role: result.role,
        status: "success"
      }
    });

    res.json({
      token: result.token,
      serverUrl: result.serverUrl,
      livekitRoom: result.livekitRoom,
      userId: result.userId,
      isHost: result.isHost,
      role: result.role,
      isDelegate: result.isDelegate,
      canPublishMicrophone: result.canPublishMicrophone,
      canPublishCamera: result.canPublishCamera,
      canPublishScreenShare: result.canPublishScreenShare,
      delegateScopes: delegate?.scopes ?? [],
      delegateGameToken,
      classroomBoardToken,
      classroomSessionId: classroom.id,
      drawingSessionId,
      isClassCreator: classroom.teacher_id === result.userId,
      presenterIdentity: presentation.presenterIdentity,
      presenterEpoch: presentation.presenterEpoch,
      presentationVisible: presentation.visible,
      presentationTitle: presentation.title,
      presentationMediaKind: presentation.mediaKind,
      presenterToken: presentation.presenterIdentity === result.userId
        ? presenterCapabilityFor(classroom.room_code, presentation)
        : null
    });
  } catch (err) {
    const reason =
      err instanceof LiveKitTokenError ? err.reason : "unauthorized";
    logger.warn({
      correlationId,
      protocol: "http",
      message: "Classroom LiveKit token denied",
      context: {
        event: "CLASSROOM_RTC_TOKEN_DENIED",
        reason,
        status: "failed"
      }
    });
    const status = reason === "server_config" ? 503 : reason === "classroom_blocked" ? 403 : 400;
    res.status(status).json({
      error: reason,
      message: err instanceof Error ? err.message : "token generation failed"
    });
  }
});

app.post("/rtc/classroom-end", async (req, res) => {
  try {
    const { roomCode } = req.body || {};
    if (typeof roomCode !== "string" || !roomCode.trim()) {
      res.status(400).json({ error: "missing_room_code" });
      return;
    }
    const actor = await requireClassroomManager(req, res);
    if (!actor || !supabaseAdmin) return;

    const normalizedRoomCode = roomCode.trim();
    const { data: classroom, error: classroomError } = await supabaseAdmin
      .from("classroom_sessions")
      .select("id, room_code, settings, status")
      .eq("room_code", normalizedRoomCode)
      .maybeSingle();
    if (classroomError || !classroom) {
      res.status(404).json({ error: "classroom_not_found" });
      return;
    }

    const closedAt = new Date().toISOString();
    try {
      await reconcileClassroomAttendance(supabaseAdmin, [classroom]);
    } catch (attendanceError) {
      logger.warn({
        protocol: "http",
        message: "Could not snapshot attendance before classroom close",
        context: { event: "CLASSROOM_ATTENDANCE_PRE_CLOSE_FAILED", roomCode: normalizedRoomCode },
        err: logError(attendanceError)
      });
    }

    const { error: updateError } = await supabaseAdmin
      .from("classroom_sessions")
      .update({
        status: "ended",
        ended_at: closedAt,
        whiteboard_data: null,
        last_activity: closedAt
      })
      .eq("id", classroom.id);
    if (updateError) {
      throw updateError;
    }

    // LiveKit uses PARTICIPANT_REMOVED for this deliberate class-wide eviction
    // too. Send a reliable server message first so clients preserve the actual
    // cause when their disconnect event arrives.
    try {
      await broadcastClassroomData(normalizedRoomCode, { type: "CLASSROOM_ENDED" });
      await new Promise((resolve) => setTimeout(resolve, 150));
    } catch (broadcastError) {
      logger.warn({
        protocol: "webrtc",
        message: "Could not announce classroom closure before eviction",
        context: { event: "CLASSROOM_END_ANNOUNCEMENT_FAILED", roomCode: normalizedRoomCode },
        err: logError(broadcastError)
      });
    }
    await completeClassroomDrawingSessions([normalizedRoomCode]);
    const evictedParticipantCount = await evictClassroomParticipants(normalizedRoomCode);
    const livekitDeleted = await deleteLiveKitRoom(normalizedRoomCode);
    await finalizeClassroomAttendance(supabaseAdmin, classroom, closedAt);
    await appendClassroomAudit(
      req,
      classroom,
      {
        kind: "user",
        userId: actor.userId,
        actorKind: actor.role === "admin" ? "admin" : "teacher"
      },
      "classroom_ended",
      { livekit_deleted: livekitDeleted, evicted_participant_count: evictedParticipantCount }
    );
    logger.info({
      userId: actor.userId,
      protocol: "http",
      message: "Classroom ended",
      context: {
        event: "CLASSROOM_ENDED",
        roomCode: normalizedRoomCode,
        livekitDeleted,
        evictedParticipantCount
      }
    });
    res.json({ success: true, roomCode: normalizedRoomCode, livekitDeleted, evictedParticipantCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "failed to end classroom" });
  }
});

app.post("/rtc/classroom-cleanup", async (req, res) => {
  try {
    const actor = await requireClassroomAdmin(req, res);
    if (!actor || !supabaseAdmin) return;
    const requestedDays = Number((req.body || {}).daysOld ?? 7);
    if (
      !Number.isInteger(requestedDays) ||
      requestedDays < CLASSROOM_CLEANUP_MIN_DAYS ||
      requestedDays > CLASSROOM_CLEANUP_MAX_DAYS
    ) {
      res.status(400).json({ error: "invalid_days_old" });
      return;
    }

    const cutoffDate = new Date(Date.now() - requestedDays * 86400000).toISOString();
    const { data: roomsToClean, error: queryError } = await supabaseAdmin
      .from("classroom_sessions")
      .select("id, room_code")
      .eq("is_persistent", false)
      .eq("status", "active")
      .lt("last_activity", cutoffDate);
    if (queryError) throw queryError;

    const staleClassrooms = roomsToClean ?? [];
    try {
      await reconcileClassroomAttendance(supabaseAdmin, staleClassrooms);
    } catch (attendanceError) {
      logger.warn({
        protocol: "http",
        message: "Could not snapshot attendance before classroom cleanup",
        context: { event: "CLASSROOM_ATTENDANCE_PRE_CLEANUP_FAILED" },
        err: logError(attendanceError)
      });
    }
    const roomCodes = staleClassrooms.map((room) => room.room_code);
    await completeClassroomDrawingSessions(roomCodes);
    await Promise.all(roomCodes.map((roomCode) => deleteLiveKitRoom(roomCode)));
    await Promise.all(staleClassrooms.map((classroom) => finalizeClassroomAttendance(supabaseAdmin, classroom)));

    const { data: endedCount, error: cleanupError } = await supabaseAdmin.rpc(
      "cleanup_old_classroom_sessions",
      { p_days_old: requestedDays }
    );
    if (cleanupError) throw cleanupError;
    logger.info({
      userId: actor.userId,
      protocol: "http",
      message: "Classroom cleanup completed",
      context: { event: "CLASSROOM_CLEANUP", endedCount: endedCount ?? 0, requestedDays }
    });
    res.json({ success: true, endedCount: endedCount ?? 0 });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "cleanup failed" });
  }
});

app.get("/rtc/admin/classroom-records", async (req, res) => {
  try {
    const actor = await requireClassroomAdmin(req, res);
    if (!actor || !supabaseAdmin) return;
    const status = typeof req.query.status === "string" ? req.query.status : "all";
    const search = typeof req.query.search === "string" ? req.query.search.trim().toLocaleLowerCase() : "";
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
    const pageSize = Math.min(100, Math.max(10, Number.parseInt(String(req.query.pageSize ?? "50"), 10) || 50));
    let matchingClassroomIds: string[] | null = null;
    if (search) {
      const { data: matches, error: searchError } = await supabaseAdmin.rpc("find_classroom_record_ids", { p_search: search });
      if (searchError) throw searchError;
      const matchedIds = (matches ?? []).map((match: { id: string }) => match.id);
      if (!matchedIds.length) {
        res.json({ items: [], page, pageSize, total: 0 });
        return;
      }
      matchingClassroomIds = matchedIds;
    }
    let query = supabaseAdmin
      .from("classroom_sessions")
      .select("id, title, subject, teacher_name, room_code, status, is_persistent, created_at, ended_at, last_activity", { count: "exact" })
      .order("last_activity", { ascending: false })
      .order("id", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (status === "active" || status === "ended") query = query.eq("status", status);
    if (matchingClassroomIds) query = query.in("id", matchingClassroomIds);
    const { data: classroomRows, error: classroomError, count } = await query;
    if (classroomError) throw classroomError;
    const classrooms = classroomRows ?? [];
    let liveAttendanceByRoomCode = new Map<string, ClassroomLiveAttendance | null>();
    try {
      liveAttendanceByRoomCode = await reconcileClassroomAttendance(
        supabaseAdmin,
        classrooms.filter((classroom) => classroom.status === "active")
      );
    } catch (attendanceError) {
      logger.warn({
        protocol: "http",
        message: "Could not refresh live attendance for classroom records",
        context: { event: "CLASSROOM_ADMIN_LIVE_ATTENDANCE_FAILED" },
        err: logError(attendanceError)
      });
    }
    const classroomIds = classrooms.map((row) => row.id);
    const { data: meetings, error: meetingsError } = classroomIds.length
      ? await supabaseAdmin.from("classroom_meetings").select("id, classroom_id, ended_at").in("classroom_id", classroomIds)
      : { data: [], error: null };
    if (meetingsError) throw meetingsError;
    const meetingIds = (meetings ?? []).map((meeting) => meeting.id);
    const { data: participants, error: participantsError } = meetingIds.length
      ? await supabaseAdmin.from("classroom_meeting_participants").select("meeting_id, participant_key, display_name, roles_held").in("meeting_id", meetingIds)
      : { data: [], error: null };
    if (participantsError) throw participantsError;
    const { data: delegates, error: delegatesError } = classroomIds.length
      ? await supabaseAdmin.from("classroom_host_delegates").select("classroom_id, display_name, is_active").in("classroom_id", classroomIds)
      : { data: [], error: null };
    if (delegatesError) throw delegatesError;

    const meetingClassroom = new Map((meetings ?? []).map((meeting) => [meeting.id, meeting.classroom_id]));
    const summary = new Map<string, { sessionCount: number; participants: Map<string, string>; cohosts: Set<string> }>();
    for (const classroom of classrooms) summary.set(classroom.id, { sessionCount: 0, participants: new Map(), cohosts: new Set() });
    for (const meeting of meetings ?? []) {
      const item = summary.get(meeting.classroom_id);
      if (item) item.sessionCount += 1;
    }
    for (const participant of participants ?? []) {
      const classroomId = meetingClassroom.get(participant.meeting_id);
      const item = classroomId ? summary.get(classroomId) : undefined;
      if (!item) continue;
      item.participants.set(participant.participant_key, participant.display_name);
      if ((participant.roles_held ?? []).includes("cohost")) item.cohosts.add(participant.display_name);
    }
    for (const delegate of delegates ?? []) {
      if (delegate.is_active) summary.get(delegate.classroom_id)?.cohosts.add(delegate.display_name);
    }

    const items = classrooms
      .map((classroom) => {
        const item = summary.get(classroom.id)!;
        const liveParticipants = (liveAttendanceByRoomCode.get(classroom.room_code)?.participants ?? []).flatMap((participant) => {
          let metadata: Record<string, unknown> = {};
          try { metadata = participant.metadata ? JSON.parse(participant.metadata) : {}; } catch {}
          const attendanceRole = typeof metadata.attendanceRole === "string" ? metadata.attendanceRole : "participant";
          return attendanceRole === "hidden" ? [] : [{ attendanceRole }];
        });
        return {
          ...classroom,
          sessionCount: item.sessionCount,
          participantCount: item.participants.size,
          livePresenceKnown: classroom.status !== "active" || liveAttendanceByRoomCode.has(classroom.room_code),
          liveParticipantCount: liveParticipants.length,
          liveHostConnected: liveParticipants.some((participant) => participant.attendanceRole === "host"),
          liveCohostCount: liveParticipants.filter((participant) => participant.attendanceRole === "cohost").length,
          cohosts: [...item.cohosts].sort()
        };
      });
    res.json({ items, page, pageSize, total: count ?? 0 });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "classroom_records_failed" });
  }
});

app.get("/rtc/admin/classroom-records/:classroomId", async (req, res) => {
  try {
    const actor = await requireClassroomAdmin(req, res);
    if (!actor || !supabaseAdmin) return;
    const { data: classroom, error: classroomError } = await supabaseAdmin
      .from("classroom_sessions")
      .select("id, title, subject, teacher_name, room_code, status, is_persistent, created_at, ended_at, last_activity")
      .eq("id", req.params.classroomId)
      .maybeSingle();
    if (classroomError) throw classroomError;
    if (!classroom) {
      res.status(404).json({ error: "classroom_not_found" });
      return;
    }
    let livePresenceKnown = classroom.status !== "active";
    if (classroom.status === "active") {
      try {
        const liveAttendance = await reconcileClassroomAttendance(supabaseAdmin, [classroom]);
        livePresenceKnown = liveAttendance.has(classroom.room_code);
      } catch (attendanceError) {
        logger.warn({
          protocol: "http",
          message: "Could not refresh live attendance for classroom detail",
          context: { event: "CLASSROOM_ADMIN_DETAIL_LIVE_ATTENDANCE_FAILED", roomCode: classroom.room_code },
          err: logError(attendanceError)
        });
      }
    }
    const { data: meetings, error: meetingsError } = await supabaseAdmin
      .from("classroom_meetings")
      .select("id, started_at, ended_at, close_reason")
      .eq("classroom_id", classroom.id)
      .order("started_at", { ascending: false });
    if (meetingsError) throw meetingsError;
    const meetingIds = (meetings ?? []).map((meeting) => meeting.id);
    const { data: participants, error: participantsError } = meetingIds.length
      ? await supabaseAdmin.from("classroom_meeting_participants").select("id, meeting_id, participant_key, display_name, roles_held, first_joined_at").in("meeting_id", meetingIds)
      : { data: [], error: null };
    if (participantsError) throw participantsError;
    const participantIds = (participants ?? []).map((participant) => participant.id);
    const { data: visits, error: visitsError } = participantIds.length
      ? await supabaseAdmin.from("classroom_participant_visits").select("id, participant_id, joined_at, left_at").in("participant_id", participantIds).order("joined_at", { ascending: true })
      : { data: [], error: null };
    if (visitsError) throw visitsError;
    const snapshotAt = new Date().toISOString();
    const visitsByParticipant = new Map<string, Array<{ id: string; participant_id: string; joined_at: string; left_at: string | null }>>();
    for (const visit of visits ?? []) {
      visitsByParticipant.set(visit.participant_id, [...(visitsByParticipant.get(visit.participant_id) ?? []), visit]);
    }
    const participantSummaries = (participants ?? []).map((participant) => {
      const participantVisits = visitsByParticipant.get(participant.id) ?? [];
      const attendance = summarizeAttendanceVisits(participantVisits, snapshotAt);
      return {
        ...participant,
        connected_now: livePresenceKnown && attendance.connectedNow,
        current_visit_started_at: attendance.currentVisitStartedAt,
        total_seconds: attendance.totalSeconds
      };
    });
    const { data: delegates, error: delegatesError } = await supabaseAdmin
      .from("classroom_host_delegates")
      .select("display_name, is_active, created_at, last_used_at")
      .eq("classroom_id", classroom.id)
      .order("created_at", { ascending: true });
    if (delegatesError) throw delegatesError;
    res.json({ classroom, meetings: meetings ?? [], participants: participantSummaries, delegates: delegates ?? [], snapshotAt, livePresenceKnown });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "classroom_record_failed" });
  }
});

app.delete("/rtc/admin/classroom-records/:classroomId", async (req, res) => {
  try {
    const actor = await requireClassroomAdmin(req, res);
    if (!actor || !supabaseAdmin) return;
    const { data: classroom, error: classroomError } = await supabaseAdmin
      .from("classroom_sessions")
      .select("id, room_code, status")
      .eq("id", req.params.classroomId)
      .maybeSingle();
    if (classroomError) throw classroomError;
    if (!classroom) {
      res.status(404).json({ error: "classroom_not_found" });
      return;
    }
    if (classroom.status === "active") {
      res.status(409).json({ error: "close_classroom_before_removing_record" });
      return;
    }
    await completeClassroomDrawingSessions([classroom.room_code]);
    const { error: deleteError } = await supabaseAdmin.from("classroom_sessions").delete().eq("id", classroom.id);
    if (deleteError) throw deleteError;
    await appendClassroomAudit(req, classroom, { kind: "user", userId: actor.userId, actorKind: "admin" }, "classroom_record_deleted", {});
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "classroom_record_delete_failed" });
  }
});

app.post("/rtc/classroom-delegate/activate", async (req, res) => {
  try {
    const { roomCode, enrollmentCode } = req.body || {};
    if (
      !isTrustedBrowserOrigin(req) ||
      typeof roomCode !== "string" ||
      !roomCode.trim() ||
      typeof enrollmentCode !== "string" ||
      enrollmentCode.length < 32 ||
      !supabaseAdmin
    ) {
      res.status(400).json({ error: "invalid_delegate_enrollment" });
      return;
    }

    const classroom = await getActiveClassroom(roomCode.trim());
    if (!classroom) {
      res.status(404).json({ error: "classroom_not_found" });
      return;
    }
    const { data: enrollment } = await supabaseAdmin
      .from("classroom_delegate_enrollments")
      .select("id, delegate_id, expires_at, used_at")
      .eq("code_hash", secretHash(enrollmentCode))
      .maybeSingle();
    if (
      !enrollment ||
      enrollment.used_at ||
      new Date(enrollment.expires_at).getTime() <= Date.now()
    ) {
      res.status(401).json({ error: "delegate_enrollment_expired" });
      return;
    }
    const { data: delegate } = await supabaseAdmin
      .from("classroom_host_delegates")
      .select("id, classroom_id, display_name, scopes, is_active")
      .eq("id", enrollment.delegate_id)
      .eq("classroom_id", classroom.id)
      .maybeSingle();
    if (!delegate?.is_active) {
      res.status(403).json({ error: "delegate_not_active" });
      return;
    }
    const { data: consumed } = await supabaseAdmin
      .from("classroom_delegate_enrollments")
      .update({ used_at: new Date().toISOString() })
      .eq("id", enrollment.id)
      .is("used_at", null)
      .select("id")
      .maybeSingle();
    if (!consumed) {
      res.status(409).json({ error: "delegate_enrollment_already_used" });
      return;
    }

    const sessionSecret = newOpaqueSecret();
    const expiresAt = new Date(Date.now() + CLASSROOM_DELEGATE_SESSION_MS).toISOString();
    const { data: delegateSession, error: sessionError } = await supabaseAdmin
      .from("classroom_delegate_sessions")
      .insert({
        delegate_id: delegate.id,
        token_hash: secretHash(sessionSecret),
        expires_at: expiresAt
      })
      .select("id")
      .single();
    if (sessionError || !delegateSession) throw sessionError ?? new Error("session_create_failed");

    setDelegateCookie(res, delegate.id, delegateSession.id, sessionSecret);
    const identity = `delegate:${delegate.id}`;
    res.json({
      success: true,
      delegateScopes: Array.isArray(delegate.scopes) ? delegate.scopes : [],
      delegateGameToken: createClassroomDelegateGameToken(
        { delegateId: delegate.id, classroomId: classroom.id, roomCode: classroom.room_code, identity },
        SUPABASE_SERVICE_ROLE_KEY
      )
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "delegate_activation_failed" });
  }
});

app.post("/rtc/classroom-settings", async (req, res) => {
  try {
    const { roomCode, settings } = req.body || {};
    if (
      typeof roomCode !== "string" ||
      !roomCode.trim() ||
      !settings ||
      typeof settings !== "object" ||
      Array.isArray(settings)
    ) {
      res.status(400).json({ error: "invalid_classroom_settings" });
      return;
    }
    const classroom = await getActiveClassroom(roomCode.trim());
    if (!classroom) {
      res.status(404).json({ error: "classroom_not_found" });
      return;
    }
    const authority = await requireClassroomAuthority(
      req,
      res,
      classroom.id,
      "manage_settings"
    );
    if (!authority || !supabaseAdmin) return;

    const allowedKeys = [
      "allowStudentChat",
      "allowStudentScreenShare",
      "allowStudentMic",
      "allowStudentCam",
      "allowWhiteboardDraw",
      "whiteboardVisible"
    ];
    const changed = Object.fromEntries(
      Object.entries(settings).filter(
        ([key, value]) => allowedKeys.includes(key) && typeof value === "boolean"
      )
    );
    if (Object.keys(changed).length === 0) {
      res.status(400).json({ error: "no_valid_classroom_settings" });
      return;
    }
    const nextSettings = await patchClassroomSettings(classroom, changed);
    await syncClassroomParticipantPermissions(classroom.room_code, nextSettings);
    await appendClassroomAudit(req, classroom, authority, "classroom_settings_changed", { changed_keys: Object.keys(changed) });
    res.json({ success: true, settings: nextSettings, delegated: authority.kind === "delegate" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "classroom_settings_failed" });
  }
});

app.post("/rtc/classroom-presentation-state", async (req, res) => {
  try {
    const { roomCode, action, title, mediaKind, presenterIdentity } = req.body || {};
    if (
      typeof roomCode !== "string" ||
      !roomCode.trim() ||
      !["started", "hidden", "stopped"].includes(action) ||
      (action === "started" && (
        typeof title !== "string" ||
        title.length > 100 ||
        !["document", "image", "video", "audio"].includes(mediaKind) ||
        typeof presenterIdentity !== "string" ||
        !presenterIdentity.trim() ||
        presenterIdentity.length > 256
      ))
    ) {
      res.status(400).json({ error: "invalid_presentation_state" });
      return;
    }
    const classroom = await getActiveClassroom(roomCode.trim());
    if (!classroom) {
      res.status(404).json({ error: "classroom_not_found" });
      return;
    }
    const presenter = requirePresenterCapability(req, res, classroom);
    if (!presenter) return;
    if (action === "started" && presenterIdentity.trim() !== presenter.identity) {
      res.status(403).json({ error: "presenter_identity_mismatch" });
      return;
    }

    const current = presentationRoomState(classroom.settings);
    const next: PresentationRoomState = {
      ...current,
      visible: action === "started",
      title: action === "started" ? title.trim() : action === "stopped" ? null : current.title,
      mediaKind: action === "started" ? mediaKind : action === "stopped" ? null : current.mediaKind
    };
    await persistPresentationState(classroom, next);

    await broadcastClassroomData(classroom.room_code, {
      type: "PRESENTATION_STATE",
      action,
      title: action === "started" ? title.trim() : undefined,
      mediaKind: action === "started" ? mediaKind : undefined,
      presenterIdentity: next.presenterIdentity,
      presenterEpoch: next.presenterEpoch
    });
    logger.info({
      userId: presenter.identity,
      protocol: "http",
      message: "Classroom presentation state changed",
      context: {
        event: "CLASSROOM_PRESENTATION_STATE",
        roomCode: classroom.room_code,
        action,
        mediaKind: action === "started" ? mediaKind : undefined
      }
    });
    res.json({ success: true, presenterEpoch: next.presenterEpoch });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "classroom_presentation_state_failed" });
  }
});

app.post("/rtc/classroom-presentation-visibility", async (req, res) => {
  try {
    const { roomCode, visible } = req.body || {};
    if (typeof roomCode !== "string" || typeof visible !== "boolean") {
      res.status(400).json({ error: "invalid_presentation_visibility" });
      return;
    }
    const classroom = await getActiveClassroom(roomCode.trim());
    if (!classroom) return void res.status(404).json({ error: "classroom_not_found" });
    const authority = await requireClassroomAuthority(req, res, classroom.id, "control_presentation");
    if (!authority) return;
    const current = presentationRoomState(classroom.settings);
    if (visible && !current.presenterIdentity) {
      res.status(409).json({ error: "presenter_unavailable" });
      return;
    }
    const next = { ...current, visible };
    await persistPresentationState(classroom, next);
    await broadcastClassroomData(classroom.room_code, {
      type: "PRESENTATION_VISIBILITY",
      visible,
      presenterIdentity: next.presenterIdentity,
      presenterEpoch: next.presenterEpoch
    });
    await appendClassroomAudit(req, classroom, authority, "classroom_presentation_visibility_changed", { visible });
    res.json({ success: true, visible });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "presentation_visibility_failed" });
  }
});

app.post("/rtc/classroom-presenter-ready", async (req, res) => {
  try {
    const { roomCode, hasMedia } = req.body || {};
    if (typeof roomCode !== "string" || typeof hasMedia !== "boolean") {
      res.status(400).json({ error: "invalid_presenter_readiness" });
      return;
    }
    const classroom = await getActiveClassroom(roomCode.trim());
    if (!classroom) return void res.status(404).json({ error: "classroom_not_found" });
    if (!requirePresenterCapability(req, res, classroom)) return;
    // A host may intentionally open an empty media board while the presenter
    // prepares a file. Visibility remains host-controlled; readiness only
    // confirms that the presenter's local library has finished loading.
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "presenter_readiness_failed" });
  }
});

app.post("/rtc/classroom-presenter-transfer", async (req, res) => {
  try {
    const { roomCode, targetIdentity } = req.body || {};
    if (typeof roomCode !== "string" || typeof targetIdentity !== "string" || !targetIdentity.trim()) {
      res.status(400).json({ error: "invalid_presenter_transfer" });
      return;
    }
    const classroom = await getActiveClassroom(roomCode.trim());
    if (!classroom) return void res.status(404).json({ error: "classroom_not_found" });
    const authority = await requireClassroomAuthority(req, res, classroom.id, "control_presentation");
    if (!authority) return;
    const actorIdentity = authorityIdentity(authority);
    const current = presentationRoomState(classroom.settings);
    const isCreator =
      authority.kind === "user" && authority.userId === classroom.teacher_id;
    if (!isCreator && actorIdentity !== current.presenterIdentity) {
      res.status(403).json({ error: "presenter_transfer_forbidden" });
      return;
    }
    const participants = await listClassroomParticipants(classroom.room_code);
    if (!participants.some((participant) => participant.identity === targetIdentity.trim())) {
      res.status(404).json({ error: "participant_not_found" });
      return;
    }
    const next = await assignPresenter(classroom, targetIdentity.trim(), true);
    await appendClassroomAudit(req, classroom, authority, "classroom_presenter_transferred", { target_identity: targetIdentity.trim() });
    res.json({ success: true, presenterIdentity: next.presenterIdentity, presenterEpoch: next.presenterEpoch });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "presenter_transfer_failed" });
  }
});

app.post("/rtc/classroom-presenter-leave", async (req, res) => {
  try {
    const { roomCode } = req.body || {};
    if (typeof roomCode !== "string") return void res.status(400).json({ error: "invalid_presenter_leave" });
    const classroom = await getActiveClassroom(roomCode.trim());
    if (!classroom) return void res.status(404).json({ error: "classroom_not_found" });
    const presenter = requirePresenterCapability(req, res, classroom);
    if (!presenter) return;
    const next = await electPresenter(classroom, presenter.identity);
    res.json({ success: true, presenterIdentity: next.presenterIdentity, presenterEpoch: next.presenterEpoch });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "presenter_leave_failed" });
  }
});

app.post("/rtc/classroom-presenter-elect", async (req, res) => {
  try {
    const { roomCode, expectedPresenterIdentity, expectedPresenterEpoch } = req.body || {};
    if (typeof roomCode !== "string" || typeof expectedPresenterIdentity !== "string" || !Number.isInteger(expectedPresenterEpoch)) {
      res.status(400).json({ error: "invalid_presenter_election" });
      return;
    }
    const classroom = await getActiveClassroom(roomCode.trim());
    if (!classroom) return void res.status(404).json({ error: "classroom_not_found" });
    const authority = await requireClassroomAuthority(req, res, classroom.id, "control_presentation");
    if (!authority) return;
    const current = presentationRoomState(classroom.settings);
    if (current.presenterIdentity !== expectedPresenterIdentity || current.presenterEpoch !== expectedPresenterEpoch) {
      return void res.json({ success: true, stale: true, presenterIdentity: current.presenterIdentity, presenterEpoch: current.presenterEpoch });
    }
    const participants = await listClassroomParticipants(classroom.room_code);
    if (participants.some((participant) => participant.identity === current.presenterIdentity)) {
      return void res.json({ success: true, reconnected: true });
    }
    const next = await electPresenter(classroom);
    res.json({ success: true, presenterIdentity: next.presenterIdentity, presenterEpoch: next.presenterEpoch });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "presenter_election_failed" });
  }
});

app.post("/rtc/classroom-document-conversion-ticket", async (req, res) => {
  try {
    const { roomCode, fileName, sizeBytes, sourceFormat } = req.body || {};
    if (
      typeof roomCode !== "string" ||
      typeof fileName !== "string" ||
      !fileName.trim() ||
      fileName.length > 180 ||
      !Number.isInteger(sizeBytes) ||
      sizeBytes < 1 ||
      sizeBytes > 50 * 1024 * 1024 ||
      !["pdf", "ppt", "pptx"].includes(sourceFormat)
    ) {
      res.status(400).json({ error: "invalid_conversion_request" });
      return;
    }
    if (!DOCUMENT_CONVERTER_SHARED_SECRET) return void res.status(503).json({ error: "converter_not_configured" });
    const classroom = await getActiveClassroom(roomCode.trim());
    if (!classroom) return void res.status(404).json({ error: "classroom_not_found" });
    if (!requirePresenterCapability(req, res, classroom)) return;
    const ticket = createDocumentConversionTicket({
      roomCode: classroom.room_code,
      fileName: fileName.trim(),
      sizeBytes,
      sourceFormat,
      correlationId: (req as express.Request & { correlationId?: string }).correlationId
    }, DOCUMENT_CONVERTER_SHARED_SECRET);
    res.json({ converterUrl: DOCUMENT_CONVERTER_URL, ticket, expiresInSeconds: 300 });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "conversion_ticket_failed" });
  }
});

app.post("/rtc/classroom-stage-layout", async (req, res) => {
  try {
    const { roomCode, presentationPercent } = req.body || {};
    if (
      typeof roomCode !== "string" ||
      !roomCode.trim() ||
      !Number.isInteger(presentationPercent) ||
      presentationPercent < 30 ||
      presentationPercent > 70
    ) {
      res.status(400).json({ error: "invalid_stage_layout" });
      return;
    }
    const classroom = await getActiveClassroom(roomCode.trim());
    if (!classroom) {
      res.status(404).json({ error: "classroom_not_found" });
      return;
    }
    const authority = await requireClassroomAuthority(req, res, classroom.id, "manage_whiteboard");
    if (!authority) return;
    const nextSettings = await patchClassroomSettings(classroom, { presentationPercent });
    await broadcastClassroomData(classroom.room_code, {
      type: "STAGE_LAYOUT",
      presentationPercent
    });
    res.json({ success: true, presentationPercent });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "classroom_stage_layout_failed" });
  }
});

app.post("/rtc/classroom-remove-participant", async (req, res) => {
  try {
    const { roomCode, targetIdentity, blockRejoin = false } = req.body || {};
    if (
      typeof roomCode !== "string" ||
      !roomCode.trim() ||
      typeof targetIdentity !== "string" ||
      !targetIdentity.trim() ||
      targetIdentity.length > 256 ||
      typeof blockRejoin !== "boolean"
    ) {
      res.status(400).json({ error: "invalid_remove_request" });
      return;
    }
    const classroom = await getActiveClassroom(roomCode.trim());
    if (!classroom) {
      res.status(404).json({ error: "classroom_not_found" });
      return;
    }
    const authority = await requireClassroomAuthority(
      req,
      res,
      classroom.id,
      "remove_participants"
    );
    if (!authority || !supabaseAdmin) return;
    if (blockRejoin) {
      const target = await getClassroomParticipantBlockTarget(
        classroom.room_code,
        targetIdentity.trim()
      );
      await blockClassroomParticipant(supabaseAdmin, classroom.id, target);
    }
    await removeClassroomParticipant(classroom.room_code, targetIdentity.trim());
    await appendClassroomAudit(req, classroom, authority, "classroom_participant_removed", {
      target_identity: targetIdentity.trim(),
      block_rejoin: blockRejoin
    });
    res.json({ success: true, delegated: authority.kind === "delegate", blockRejoin });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "participant_remove_failed" });
  }
});

app.post("/rtc/classroom-promote", async (req, res) => {
  try {
    const { roomCode, targetIdentity } = req.body || {};
    if (
      typeof roomCode !== "string" ||
      !roomCode.trim() ||
      typeof targetIdentity !== "string" ||
      !targetIdentity.trim() ||
      targetIdentity.length > 256
    ) {
      res.status(400).json({ error: "invalid_promotion_request" });
      return;
    }
    const normalizedRoomCode = roomCode.trim();
    const classroom = await getActiveClassroom(normalizedRoomCode);
    if (!classroom) {
      res.status(404).json({ error: "classroom_not_found" });
      return;
    }
    const authority = await requireClassroomAuthority(
      req,
      res,
      classroom.id,
      "manage_delegates"
    );
    if (!authority || !supabaseAdmin) return;

    const promoted = await promoteClassroomParticipant(normalizedRoomCode, targetIdentity.trim());
    const { data: delegate, error: delegateError } = await supabaseAdmin
      .from("classroom_host_delegates")
      .insert({
        classroom_id: classroom.id,
        display_name: promoted.displayName.slice(0, 120),
        scopes: CLASSROOM_DELEGATE_SCOPES,
        created_by: authority.kind === "user" ? authority.userId : null
      })
      .select("id")
      .single();
    if (delegateError || !delegate) throw delegateError ?? new Error("delegate_create_failed");

    const enrollmentCode = newOpaqueSecret();
    const { error: enrollmentError } = await supabaseAdmin
      .from("classroom_delegate_enrollments")
      .insert({
        delegate_id: delegate.id,
        code_hash: secretHash(enrollmentCode),
        target_livekit_identity: targetIdentity.trim(),
        expires_at: new Date(Date.now() + CLASSROOM_DELEGATE_ENROLLMENT_MS).toISOString()
      });
    if (enrollmentError) throw enrollmentError;
    await sendClassroomDelegateEnrollment(normalizedRoomCode, targetIdentity.trim(), enrollmentCode);
    await appendClassroomAudit(req, classroom, authority, "classroom_participant_promoted", { target_identity: targetIdentity.trim() });
    logger.info({
      userId: authority.kind === "user" ? authority.userId : authority.delegate.delegateId,
      protocol: "http",
      message: "Classroom participant promoted",
      context: {
        event: "CLASSROOM_PARTICIPANT_PROMOTED",
        roomCode: normalizedRoomCode,
        targetIdentity: targetIdentity.trim()
      }
    });
    res.json({ success: true, delegated: authority.kind === "delegate" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "promotion failed" });
  }
});

// Periodic Background Classroom Cleanup (runs every 6 hours)
setInterval(async () => {
  if (!supabaseAdmin) return;
  try {
    const cutoffDate = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: roomsToClean } = await supabaseAdmin
      .from("classroom_sessions")
      .select("id, room_code")
      .eq("is_persistent", false)
      .eq("status", "active")
      .lt("last_activity", cutoffDate);

    const staleClassrooms = roomsToClean ?? [];
    try {
      await reconcileClassroomAttendance(supabaseAdmin, staleClassrooms);
    } catch (attendanceError) {
      logger.warn({
        protocol: "internal",
        message: "Could not snapshot attendance before background classroom cleanup",
        context: { event: "CLASSROOM_ATTENDANCE_PRE_BACKGROUND_CLEANUP_FAILED" },
        err: logError(attendanceError)
      });
    }
    const roomCodes = staleClassrooms.map((room) => room.room_code);
    await completeClassroomDrawingSessions(roomCodes);
    await Promise.all(roomCodes.map((roomCode) => deleteLiveKitRoom(roomCode)));
    await Promise.all(staleClassrooms.map((classroom) => finalizeClassroomAttendance(supabaseAdmin!, classroom)));
    const { error } = await supabaseAdmin.rpc("cleanup_old_classroom_sessions", { p_days_old: 7 });
    if (error) throw error;
  } catch (e) {
    logger.warn({
      protocol: "internal",
      message: "Background classroom cleanup failed",
      err: logError(e),
      context: { event: "CLASSROOM_BACKGROUND_CLEANUP_FAILED" }
    });
  }
}, 6 * 3600 * 1000);

// LiveKit webhooks update this immediately; this independent reconciliation is
// the durable fallback and also closes visits when a client vanishes abruptly.
setInterval(() => { void reconcileActiveClassroomAttendance(); }, 30_000);
void reconcileActiveClassroomAttendance();

app.post("/api/fps-batch", async (req, res) => {
  const correlationId = (req as express.Request & { correlationId?: string }).correlationId;
  try {
    const accessToken = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!accessToken) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!supabaseAdmin) {
      res.status(503).json({ error: "server_config" });
      return;
    }
    const profile = await getCachedAuth(supabaseAdmin, accessToken);
    if (!profile || profile.role !== "kid") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const { sessionId, phase, avgFps, sampleCount } = req.body as {
      sessionId: string;
      phase: "loading" | "runtime";
      avgFps: number;
      sampleCount: number;
    };
    if (!sessionId || !phase || typeof avgFps !== "number" || typeof sampleCount !== "number") {
      res.status(400).json({ error: "missing_or_invalid_params" });
      return;
    }
    ingestFpsBatch(sessionId, profile.userId, phase, avgFps, sampleCount);
    res.json({ ok: true });
  } catch (err) {
    logger.error({
      correlationId,
      message: "Failed to ingest FPS batch",
      error: err instanceof Error ? err.message : String(err)
    });
    res.status(500).json({ error: "internal_server_error" });
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
    fetchLiveKitVoiceStats(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET),
  onAdminStatsQuery: async () => {
    if (supabaseAdmin) {
      const activeRooms = listRooms();
      for (const room of activeRooms) {
        await persistLaunches(supabaseAdmin, room.sessionId, true);
        await persistFps(supabaseAdmin, room.sessionId, true);
      }
    }
  }
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
    const profile = await getCachedAuth(supabaseAdmin, token);
    if (profile.role === "kid") {
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
  const HOT_SOCKET_EVENTS = new Set(["INPUT", "ARM_SWING"]);
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
      payload: { sessionId: string; invitationCode?: string },
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
          "id, game_id, gender, player_ids, player_names, host_id, status, game_state, is_open, invitation_code, peak_player_count, games ( game_url, min_players, max_players )"
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
        peakPlayerCount: (session as any).peak_player_count ?? 0,
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
      if (socket.data.role !== "teacher" && !wasAlreadyInRoom) {
        recordLaunch(sessionId, userId, "minecraft");
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
        roomStatusIsIdle: false,
        peakPlayerCount: room.peakPlayerCount
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
        markPlayerDirty(room, userId);
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
    markPlayerDirty(room, userId);
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
      for (const p of room.players.values()) {
        if (!p.isTeacherObserver) {
          recordLaunch(sessionId, p.userId, "minecraft");
        }
      }
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
        void persistLaunches(supabaseAdmin, sessionId);
        void persistFps(supabaseAdmin, sessionId);
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
        peakPlayerCount: before.peakPlayerCount,
        ...(result.roomEmpty
          ? { gameState: snapshotPersistedState(before) }
          : {})
      });
      if (result.roomEmpty) {
        setTimeout(() => {
          void persistLaunches(supabaseAdmin, sessionId);
          void persistFps(supabaseAdmin, sessionId);
        }, 1000);
      }
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

const AUTOSAVE_INTERVAL_MS = 2 * 60_000; // 2 minutes

setInterval(() => {
  if (!supabaseAdmin) return;
  const activeRooms = listRooms().filter((room) => !room.paused && room.players.size > 0);
  for (const room of activeRooms) {
    const state = snapshotPersistedState(room);
    persistGameAutosave({
      supabase: supabaseAdmin,
      sessionId: room.sessionId,
      gameState: state
    }).catch((err) => {
      logger.error({
        message: `Autosave failed for session ${room.sessionId}`,
        error: err instanceof Error ? err.message : String(err)
      });
    });
  }
}, AUTOSAVE_INTERVAL_MS);

server.listen(PORT, () => {
  logger.info({ message: `minecraft-server listening on ${PORT}`, protocol: "http" });
});
