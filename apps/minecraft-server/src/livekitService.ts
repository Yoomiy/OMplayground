import {
  AccessToken,
  DataPacket_Kind,
  RoomServiceClient,
  TrackSource
} from "livekit-server-sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCachedAuth } from "./authCache";
import { createLogger, logError } from "@playground/observability";
import {
  classroomParticipantKeyFromMetadata,
  isClassroomParticipantBlocked,
  type ClassroomParticipantBlockTarget
} from "./classroomParticipantBlocks";

const logger = createLogger("minecraft-server");

function getRoomServiceClient(): RoomServiceClient | null {
  const host = process.env.LIVEKIT_URL?.trim();
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!host || !apiKey || !apiSecret) return null;

  const httpHost = host.replace(/^ws:/, "http:").replace(/^wss:/, "https:");
  return new RoomServiceClient(httpHost, apiKey, apiSecret);
}

function classroomLiveKitRoom(roomCode: string): string {
  return `classroom-${roomCode}`;
}

const HOST_PUBLISH_SOURCES = [
  TrackSource.MICROPHONE,
  TrackSource.CAMERA
];

export function classroomParticipantPublishSources(settings: Record<string, unknown>): TrackSource[] {
  const sources: TrackSource[] = [];
  if (settings.allowStudentMic !== false) sources.push(TrackSource.MICROPHONE);
  if (settings.allowStudentCam !== false) sources.push(TrackSource.CAMERA);
  return sources;
}

function addPresenterPublishSources(sources: TrackSource[], isPresenter: boolean): TrackSource[] {
  const next = [...sources];
  if (isPresenter) next.push(TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO);
  return next;
}

export function classroomPublishSourcesForRole(
  settings: Record<string, unknown>,
  isHost: boolean,
  isPresenter: boolean
): TrackSource[] {
  return addPresenterPublishSources(
    isHost ? HOST_PUBLISH_SOURCES : classroomParticipantPublishSources(settings),
    isPresenter
  );
}

async function classroomWhiteboardAllowed(
  supabaseAdmin: SupabaseClient,
  classroomId: string,
  participantKey: string,
  baseline: boolean
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("classroom_whiteboard_permissions")
    .select("allowed")
    .eq("classroom_id", classroomId)
    .eq("participant_key", participantKey)
    .maybeSingle();
  if (error) throw error;
  return typeof data?.allowed === "boolean" ? data.allowed : baseline;
}

export async function deleteLiveKitRoom(roomCode: string): Promise<boolean> {
  try {
    const roomService = getRoomServiceClient();
    if (!roomService) return false;
    await roomService.deleteRoom(classroomLiveKitRoom(roomCode));
    return true;
  } catch (err: unknown) {
    logger.warn({
      protocol: "webrtc",
      err: logError(err),
      message: "LiveKit classroom room cleanup failed",
      context: { event: "CLASSROOM_LIVEKIT_ROOM_CLEANUP_FAILED", roomCode }
    });
    return false;
  }
}

/**
 * Disconnect every current classroom attendee and revoke their tokens before
 * deleting the room. Deleting a room drops the current connection, but does
 * not invalidate a token that could otherwise be used to reconnect while it
 * is still valid.
 */
export async function evictClassroomParticipants(roomCode: string): Promise<number> {
  try {
    const roomService = getRoomServiceClient();
    if (!roomService) return 0;

    const roomName = classroomLiveKitRoom(roomCode);
    const participants = await roomService.listParticipants(roomName);
    if (participants.length === 0) return 0;

    const revokeTokenTs = BigInt(Math.floor(Date.now() / 1000));
    const results = await Promise.allSettled(
      participants.map((participant) =>
        roomService.removeParticipant(roomName, participant.identity, { revokeTokenTs })
      )
    );
    const evictedCount = results.filter((result) => result.status === "fulfilled").length;
    const failedCount = results.length - evictedCount;
    if (failedCount > 0) {
      logger.warn({
        protocol: "webrtc",
        message: "Some classroom participants could not be evicted",
        context: {
          event: "CLASSROOM_PARTICIPANT_EVICTION_PARTIAL_FAILURE",
          roomCode,
          evictedCount,
          failedCount
        }
      });
    }
    return evictedCount;
  } catch (err: unknown) {
    logger.warn({
      protocol: "webrtc",
      err: logError(err),
      message: "LiveKit classroom participant eviction failed",
      context: { event: "CLASSROOM_PARTICIPANT_EVICTION_FAILED", roomCode }
    });
    return 0;
  }
}

export async function promoteClassroomParticipant(
  roomCode: string,
  participantIdentity: string
): Promise<{ displayName: string }> {
  const roomService = getRoomServiceClient();
  if (!roomService) {
    throw new LiveKitTokenError("server_config", "LiveKit is not configured on the server.");
  }

  const roomName = classroomLiveKitRoom(roomCode);
  const participant = await roomService.getParticipant(roomName, participantIdentity);
  let metadata: Record<string, unknown> = {};
  try {
    metadata = participant.metadata ? JSON.parse(participant.metadata) : {};
  } catch {
    metadata = {};
  }

  const isPresenter = metadata.isPresenter === true;
  await roomService.updateParticipant(roomName, participantIdentity, {
    metadata: JSON.stringify({ ...metadata, isHost: true }),
    permission: {
      canSubscribe: true,
      canPublish: true,
      canPublishData: true,
      canPublishSources: addPresenterPublishSources(HOST_PUBLISH_SOURCES, isPresenter),
      canUpdateMetadata: false
    }
  });
  return { displayName: participant.name || participantIdentity };
}

export async function sendClassroomDelegateEnrollment(
  roomCode: string,
  participantIdentity: string,
  enrollmentCode: string
): Promise<void> {
  const roomService = getRoomServiceClient();
  if (!roomService) {
    throw new LiveKitTokenError("server_config", "LiveKit is not configured on the server.");
  }
  const payload = new TextEncoder().encode(
    JSON.stringify({ type: "CLASSROOM_DELEGATE_ENROLLMENT", roomCode, enrollmentCode })
  );
  await roomService.sendData(classroomLiveKitRoom(roomCode), payload, DataPacket_Kind.RELIABLE, {
    destinationIdentities: [participantIdentity],
    topic: "classroom-delegate-enrollment"
  });
}

export async function broadcastClassroomData(
  roomCode: string,
  message: Record<string, unknown>
): Promise<void> {
  const roomService = getRoomServiceClient();
  if (!roomService) {
    throw new LiveKitTokenError("server_config", "LiveKit is not configured on the server.");
  }
  await roomService.sendData(
    classroomLiveKitRoom(roomCode),
    new TextEncoder().encode(JSON.stringify(message)),
    DataPacket_Kind.RELIABLE,
    { topic: "classroom-presentation" }
  );
}

export async function sendClassroomDataToParticipant(
  roomCode: string,
  participantIdentity: string,
  message: Record<string, unknown>
): Promise<void> {
  const roomService = getRoomServiceClient();
  if (!roomService) {
    throw new LiveKitTokenError("server_config", "LiveKit is not configured on the server.");
  }
  await roomService.sendData(
    classroomLiveKitRoom(roomCode),
    new TextEncoder().encode(JSON.stringify(message)),
    DataPacket_Kind.RELIABLE,
    { destinationIdentities: [participantIdentity], topic: "classroom-presentation" }
  );
}

export async function listClassroomParticipants(roomCode: string): Promise<Array<{
  identity: string;
  name: string;
  isHost: boolean;
  attendanceRole: string;
}>> {
  const roomService = getRoomServiceClient();
  if (!roomService) {
    throw new LiveKitTokenError("server_config", "LiveKit is not configured on the server.");
  }
  const participants = await roomService.listParticipants(classroomLiveKitRoom(roomCode));
  return participants.map((participant) => {
    let metadata: Record<string, unknown> = {};
    try { metadata = participant.metadata ? JSON.parse(participant.metadata) : {}; } catch {}
    return {
      identity: participant.identity,
      name: participant.name || participant.identity,
      isHost: metadata.isHost === true,
      attendanceRole: typeof metadata.attendanceRole === "string" ? metadata.attendanceRole : "participant"
    };
  });
}

export type ClassroomLiveAttendance = {
  roomSid: string;
  startedAt: string;
  participants: Array<{
    sid: string;
    identity: string;
    name: string;
    metadata: string;
    joinedAt: string;
  }>;
};

function liveKitTimestamp(milliseconds: bigint | number | undefined, seconds: bigint | number | undefined): string {
  const millisecondsValue = Number(milliseconds);
  if (Number.isFinite(millisecondsValue) && millisecondsValue > 0) return new Date(millisecondsValue).toISOString();
  const secondsValue = Number(seconds);
  if (Number.isFinite(secondsValue) && secondsValue > 0) return new Date(secondsValue * 1000).toISOString();
  return new Date().toISOString();
}

/**
 * A missing map entry means LiveKit could not read that existing room and the
 * caller must leave its stored attendance untouched. A null entry means the
 * room was definitively absent.
 */
export async function getClassroomsLiveAttendance(roomCodes: string[]): Promise<Map<string, ClassroomLiveAttendance | null>> {
  const roomService = getRoomServiceClient();
  if (!roomService) throw new LiveKitTokenError("server_config", "LiveKit is not configured on the server.");
  const uniqueCodes = [...new Set(roomCodes)];
  const roomCodeByName = new Map(uniqueCodes.map((roomCode) => [classroomLiveKitRoom(roomCode), roomCode]));
  const result = new Map<string, ClassroomLiveAttendance | null>(uniqueCodes.map((roomCode) => [roomCode, null]));
  const rooms = await roomService.listRooms([...roomCodeByName.keys()]);
  for (let offset = 0; offset < rooms.length; offset += 8) {
    await Promise.all(rooms.slice(offset, offset + 8).map(async (room) => {
      const roomCode = roomCodeByName.get(room.name);
      if (!roomCode) return;
      try {
        const participants = await roomService.listParticipants(room.name);
        result.set(roomCode, {
          roomSid: room.sid,
          startedAt: liveKitTimestamp(room.creationTimeMs, room.creationTime),
          participants: participants.map((participant) => ({
            sid: participant.sid,
            identity: participant.identity,
            name: participant.name || participant.identity,
            metadata: participant.metadata,
            joinedAt: liveKitTimestamp(participant.joinedAtMs, participant.joinedAt)
          }))
        });
      } catch (err) {
        result.delete(roomCode);
        logger.warn({
          protocol: "webrtc",
          err: logError(err),
          message: "LiveKit classroom attendance snapshot failed",
          context: { event: "CLASSROOM_ATTENDANCE_SNAPSHOT_FAILED", roomCode }
        });
      }
    }));
  }
  return result;
}

export async function getClassroomLiveAttendance(roomCode: string): Promise<ClassroomLiveAttendance | null> {
  const snapshots = await getClassroomsLiveAttendance([roomCode]);
  if (!snapshots.has(roomCode)) throw new Error("LiveKit classroom snapshot unavailable");
  return snapshots.get(roomCode) ?? null;
}

export async function removeClassroomParticipant(
  roomCode: string,
  participantIdentity: string
): Promise<void> {
  const roomService = getRoomServiceClient();
  if (!roomService) {
    throw new LiveKitTokenError("server_config", "LiveKit is not configured on the server.");
  }
  await roomService.removeParticipant(classroomLiveKitRoom(roomCode), participantIdentity, {
    revokeTokenTs: BigInt(Math.floor(Date.now() / 1000))
  });
}

export async function getClassroomParticipantBlockTarget(
  roomCode: string,
  participantIdentity: string
): Promise<ClassroomParticipantBlockTarget> {
  const roomService = getRoomServiceClient();
  if (!roomService) {
    throw new LiveKitTokenError("server_config", "LiveKit is not configured on the server.");
  }
  const participant = await roomService.getParticipant(
    classroomLiveKitRoom(roomCode),
    participantIdentity
  );
  let metadata: Record<string, unknown> = {};
  try {
    metadata = participant.metadata ? JSON.parse(participant.metadata) : {};
  } catch {
    metadata = {};
  }
  if (metadata.isHost === true) {
    throw new Error("cannot_block_classroom_host");
  }
  const participantKey = classroomParticipantKeyFromMetadata(metadata, participant.identity);
  if (!participantKey) {
    throw new Error("participant_admission_key_missing");
  }
  return {
    participantKey,
    identity: participant.identity,
    displayName: participant.name || participant.identity
  };
}

export async function setClassroomWhiteboardPermission(
  supabaseAdmin: SupabaseClient,
  classroom: { id: string; room_code: string },
  participantIdentity: string,
  allowed: boolean
): Promise<{ participantKey: string; identity: string; allowed: boolean }> {
  const roomService = getRoomServiceClient();
  if (!roomService) {
    throw new LiveKitTokenError("server_config", "LiveKit is not configured on the server.");
  }
  const roomName = classroomLiveKitRoom(classroom.room_code);
  const participant = await roomService.getParticipant(roomName, participantIdentity);
  let metadata: Record<string, unknown> = {};
  try { metadata = participant.metadata ? JSON.parse(participant.metadata) : {}; } catch {}
  if (metadata.isHost === true) throw new Error("cannot_restrict_classroom_host");
  const participantKey = classroomParticipantKeyFromMetadata(metadata, participant.identity);
  if (!participantKey) throw new Error("participant_permission_key_missing");

  const { error } = await supabaseAdmin
    .from("classroom_whiteboard_permissions")
    .upsert({
      classroom_id: classroom.id,
      participant_key: participantKey,
      participant_identity: participant.identity,
      display_name: participant.name || participant.identity,
      allowed,
      updated_at: new Date().toISOString()
    }, { onConflict: "classroom_id,participant_key" });
  if (error) throw error;

  await roomService.updateParticipant(roomName, participant.identity, {
    metadata: JSON.stringify({ ...metadata, canDrawWhiteboard: allowed })
  });
  await broadcastClassroomData(classroom.room_code, {
    type: "WHITEBOARD_PERMISSION_CHANGED",
    targetIdentity: participant.identity,
    allowed
  });
  return { participantKey, identity: participant.identity, allowed };
}

export async function syncClassroomParticipantPermissions(
  roomCode: string,
  settings: Record<string, unknown>,
  supabaseAdmin?: SupabaseClient,
  classroomId?: string
): Promise<void> {
  const roomService = getRoomServiceClient();
  if (!roomService) {
    throw new LiveKitTokenError("server_config", "LiveKit is not configured on the server.");
  }
  const roomName = classroomLiveKitRoom(roomCode);
  const participants = await roomService.listParticipants(roomName);
  const participantRows = participants.map((participant) => {
    let metadata: Record<string, unknown> = {};
    try { metadata = participant.metadata ? JSON.parse(participant.metadata) : {}; } catch {}
    return { participant, metadata, participantKey: classroomParticipantKeyFromMetadata(metadata, participant.identity) };
  });
  const overrideByKey = new Map<string, boolean>();
  const participantKeys = participantRows.flatMap(({ participantKey }) => participantKey ? [participantKey] : []);
  if (supabaseAdmin && classroomId && participantKeys.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("classroom_whiteboard_permissions")
      .select("participant_key, allowed")
      .eq("classroom_id", classroomId)
      .in("participant_key", participantKeys);
    if (error) throw error;
    for (const row of data ?? []) overrideByKey.set(String(row.participant_key), row.allowed === true);
  }
  const baseline = settings.allowWhiteboardDraw === true;
  await Promise.all(
    participantRows.map(async ({ participant, metadata, participantKey }) => {
      if (metadata.isHost === true) return;
      const isPresenter = metadata.isPresenter === true;
      const sources = classroomPublishSourcesForRole(settings, false, isPresenter);
      const canDrawWhiteboard = participantKey && overrideByKey.has(participantKey)
        ? overrideByKey.get(participantKey) === true
        : baseline;
      await roomService.updateParticipant(roomName, participant.identity, {
        metadata: JSON.stringify({ ...metadata, canDrawWhiteboard }),
        permission: {
          canSubscribe: true,
          canPublish: true,
          canPublishData: true,
          canPublishSources: sources,
          canUpdateMetadata: false
        }
      });
    })
  );
}

export async function syncClassroomPresenterPermissions(
  roomCode: string,
  settings: Record<string, unknown>,
  previousIdentity: string | null,
  presenterIdentity: string | null
): Promise<void> {
  const roomService = getRoomServiceClient();
  if (!roomService) {
    throw new LiveKitTokenError("server_config", "LiveKit is not configured on the server.");
  }
  const updateIdentity = async (identity: string) => {
    let participant;
    try { participant = await roomService.getParticipant(classroomLiveKitRoom(roomCode), identity); } catch { return; }
    let metadata: Record<string, unknown> = {};
    try { metadata = participant.metadata ? JSON.parse(participant.metadata) : {}; } catch {}
    const isHost = metadata.isHost === true;
    const isPresenter = identity === presenterIdentity;
    const sources = classroomPublishSourcesForRole(settings, isHost, isPresenter);
    await roomService.updateParticipant(classroomLiveKitRoom(roomCode), identity, {
      metadata: JSON.stringify({ ...metadata, isPresenter }),
      permission: {
        canSubscribe: true,
        canPublish: true,
        canPublishData: true,
        canPublishSources: sources,
        canUpdateMetadata: false
      }
    });
  };
  // Revoke the old presenter's screen source before granting it to the next
  // presenter so there is never a server-authorized overlap window.
  if (previousIdentity && previousIdentity !== presenterIdentity) await updateIdentity(previousIdentity);
  if (presenterIdentity) await updateIdentity(presenterIdentity);
}

export interface GenerateTokenArgs {
  supabaseAdmin: SupabaseClient;
  accessToken: string;
  sessionId: string;
}

export type LiveKitDenialReason =
  | "unauthorized"
  | "profile_inactive"
  | "session_not_found"
  | "gender_mismatch"
  | "paused_roster_block"
  | "roster_block"
  | "session_completed"
  | "classroom_blocked"
  | "server_config";

export class LiveKitTokenError extends Error {
  readonly reason: LiveKitDenialReason;

  constructor(reason: LiveKitDenialReason, message: string) {
    super(message);
    this.reason = reason;
  }
}

export interface LiveKitTokenResult {
  token: string;
  serverUrl: string;
  livekitRoom: string;
  userId: string;
}

/**
 * Validates a user session and issues a LiveKit access token.
 * Mirrors the socket handshake auth in index.ts (getUser -> kid_profiles -> is_active).
 */
export async function generateLiveKitToken(
  args: GenerateTokenArgs
): Promise<LiveKitTokenResult> {
  const { supabaseAdmin, accessToken, sessionId } = args;
  const serverUrl = process.env.LIVEKIT_URL?.trim() ?? "";
  const apiKey = process.env.LIVEKIT_API_KEY?.trim() ?? "";
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim() ?? "";
  if (!serverUrl || !apiKey || !apiSecret) {
    throw new LiveKitTokenError(
      "server_config",
      "LiveKit is not configured on the server."
    );
  }

  let profile;
  try {
    profile = await getCachedAuth(supabaseAdmin, accessToken);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "FORBIDDEN") {
      throw new LiveKitTokenError(
        "profile_inactive",
        "Profile not found or inactive."
      );
    }
    throw new LiveKitTokenError(
      "unauthorized",
      "Unauthorized: Invalid user session token."
    );
  }

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("game_sessions")
    .select("gender, player_ids, status")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError) throw sessionError;

  if (!session) {
    throw new LiveKitTokenError("session_not_found", "Session not found.");
  }
  const isGameInspector = profile.role === "teacher" || profile.role === "admin";
  if (!isGameInspector && (session.gender as string) !== (profile.gender as string)) {
    throw new LiveKitTokenError(
      "gender_mismatch",
      "Gender partition mismatch."
    );
  }
  const playerIds = ((session.player_ids as string[]) ?? []).map(String);
  if (!isGameInspector && !playerIds.includes(profile.userId)) {
    throw new LiveKitTokenError(
      "roster_block",
      "Not in session roster."
    );
  }
  if (session.status === "completed") {
    throw new LiveKitTokenError(
      "session_completed",
      "Session already completed."
    );
  }

  const livekitRoom = `voxel-session-${sessionId}`;
  const identity = profile.userId;
  const participantName = profile.full_name;

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name: participantName,
    ttl: "2h"
  });

  at.addGrant({
    roomJoin: true,
    room: livekitRoom,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false
  });

  const token = await at.toJwt();
  return { token, serverUrl, livekitRoom, userId: profile.userId };
}

export interface GenerateClassroomTokenArgs {
  supabaseAdmin: SupabaseClient;
  roomCode: string;
  displayName: string;
  accessToken?: string;
  spectateMode?: "invisible" | "visible";
  delegate?: { id: string; displayName: string } | null;
  presenterIdentityOverride?: string;
  guestAttendanceKey?: string | null;
}

export async function generateClassroomToken(
  args: GenerateClassroomTokenArgs
): Promise<
  LiveKitTokenResult & {
    isHost: boolean;
    role: string;
    isDelegate: boolean;
    canPublishMicrophone: boolean;
    canPublishCamera: boolean;
    canPublishScreenShare: boolean;
    canDrawWhiteboard: boolean;
    attendanceKey: string;
    attendanceRole: string;
    displayName: string;
    isHidden: boolean;
  }
> {
  const { supabaseAdmin, roomCode, displayName, accessToken, spectateMode, delegate, presenterIdentityOverride, guestAttendanceKey } = args;
  const serverUrl = process.env.LIVEKIT_URL?.trim() ?? "";
  const apiKey = process.env.LIVEKIT_API_KEY?.trim() ?? "";
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim() ?? "";
  if (!serverUrl || !apiKey || !apiSecret) {
    throw new LiveKitTokenError(
      "server_config",
      "LiveKit is not configured on the server."
    );
  }

  const { data: classroom, error: classroomError } = await supabaseAdmin
    .from("classroom_sessions")
    .select("id, room_code, teacher_id, teacher_name, status, settings")
    .eq("room_code", roomCode)
    .maybeSingle();
  if (classroomError) throw classroomError;

  if (!classroom || classroom.status !== "active") {
    throw new LiveKitTokenError("session_completed", "Classroom session not active.");
  }

  let profile: any = null;
  if (accessToken) {
    try {
      profile = await getCachedAuth(supabaseAdmin, accessToken);
    } catch {
      profile = null;
    }
  }

  const livekitRoom = classroomLiveKitRoom(roomCode);
  const isAdmin = profile?.role === "admin";
  const isTeacher = profile?.role === "teacher" || isAdmin;
  const isCreatorTeacher = profile && classroom.teacher_id === profile.userId;
  const isDelegate = Boolean(delegate);
  const isHost = isTeacher || isCreatorTeacher || isAdmin || isDelegate;
  const role = isDelegate ? "classroom_delegate" : profile?.role ?? "student";
  const finalDisplayName = (delegate?.displayName ?? profile?.full_name ?? displayName ?? "משתתף").trim().slice(0, 80) || "משתתף";
  const identity = delegate
    ? `delegate:${delegate.id}`
    : profile?.userId ?? presenterIdentityOverride ?? `guest-${Math.random().toString(36).substring(2, 9)}`;
  const settings = classroom.settings && typeof classroom.settings === "object"
    ? (classroom.settings as Record<string, unknown>)
    : {};
  const isPresenter = settings.presentationPresenterIdentity === identity;

  const isHidden = isAdmin && spectateMode === "invisible";
  const attendanceKey = delegate
    ? `delegate:${delegate.id}`
    : profile?.userId
      ? `user:${profile.userId}`
      : guestAttendanceKey ?? `guest:${roomCode}:${identity}`;
  const attendanceRole = isHidden
    ? "hidden"
    : isCreatorTeacher
      ? "host"
      : isDelegate || isTeacher
        ? "cohost"
        : "participant";
  if (!isHost) {
    let isBlocked: boolean;
    try {
      isBlocked = await isClassroomParticipantBlocked(supabaseAdmin, classroom.id, attendanceKey);
    } catch (error) {
      logger.error({
        protocol: "http",
        message: "Classroom participant admission check failed",
        context: { event: "CLASSROOM_PARTICIPANT_BLOCK_CHECK_FAILED", roomCode },
        err: logError(error)
      });
      throw new LiveKitTokenError(
        "server_config",
        "לא ניתן לבדוק כרגע את הרשאת הכניסה לכיתה."
      );
    }
    if (isBlocked) {
      throw new LiveKitTokenError(
        "classroom_blocked",
        "הוצאת מהכיתה ולא ניתן להצטרף אליה שוב."
      );
    }
  }
  const publishSources = isHidden ? [] : classroomPublishSourcesForRole(settings, isHost, isPresenter);
  const canDrawWhiteboard = isHost || await classroomWhiteboardAllowed(
    supabaseAdmin,
    classroom.id,
    attendanceKey,
    settings.allowWhiteboardDraw === true
  );

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name: finalDisplayName,
    ttl: "4h",
    metadata: JSON.stringify({
      role,
      isHost,
      isPresenter,
      hidden: isHidden,
      spectateMode: spectateMode ?? "none",
      attendanceKey,
      attendanceRole,
      canDrawWhiteboard
    })
  });

  at.addGrant({
    roomJoin: true,
    room: livekitRoom,
    canPublish: !isHidden,
    canPublishSources: publishSources,
    canSubscribe: true,
    canPublishData: true,
    roomAdmin: isHost,
    hidden: isHidden
  });

  const token = await at.toJwt();
  return {
    token,
    serverUrl,
    livekitRoom,
    userId: identity,
    isHost,
    role,
    isDelegate,
    canPublishMicrophone: publishSources.includes(TrackSource.MICROPHONE),
    canPublishCamera: publishSources.includes(TrackSource.CAMERA),
    canPublishScreenShare: publishSources.includes(TrackSource.SCREEN_SHARE),
    canDrawWhiteboard,
    attendanceKey,
    attendanceRole,
    displayName: finalDisplayName,
    isHidden
  };
}
