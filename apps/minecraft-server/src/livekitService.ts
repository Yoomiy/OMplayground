import {
  AccessToken,
  DataPacket_Kind,
  RoomServiceClient,
  TrackSource
} from "livekit-server-sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCachedAuth } from "./authCache";
import { createLogger, logError } from "@playground/observability";

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
  TrackSource.CAMERA,
  TrackSource.SCREEN_SHARE,
  TrackSource.SCREEN_SHARE_AUDIO
];

export function classroomParticipantPublishSources(settings: Record<string, unknown>): TrackSource[] {
  const sources: TrackSource[] = [];
  if (settings.allowStudentMic !== false) sources.push(TrackSource.MICROPHONE);
  if (settings.allowStudentCam !== false) sources.push(TrackSource.CAMERA);
  if (settings.allowStudentScreenShare === true) {
    sources.push(TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO);
  }
  return sources;
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

  await roomService.updateParticipant(roomName, participantIdentity, {
    metadata: JSON.stringify({ ...metadata, isHost: true }),
    permission: {
      canSubscribe: true,
      canPublish: true,
      canPublishData: true,
      canPublishSources: HOST_PUBLISH_SOURCES,
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
      isHost: metadata.isHost === true
    };
  });
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

export async function syncClassroomParticipantPermissions(
  roomCode: string,
  settings: Record<string, unknown>
): Promise<void> {
  const roomService = getRoomServiceClient();
  if (!roomService) {
    throw new LiveKitTokenError("server_config", "LiveKit is not configured on the server.");
  }
  const roomName = classroomLiveKitRoom(roomCode);
  const participants = await roomService.listParticipants(roomName);
  const sources = classroomParticipantPublishSources(settings);
  await Promise.all(
    participants.map(async (participant) => {
      let metadata: Record<string, unknown> = {};
      try {
        metadata = participant.metadata ? JSON.parse(participant.metadata) : {};
      } catch {
        metadata = {};
      }
      if (metadata.isHost === true) return;
      await roomService.updateParticipant(roomName, participant.identity, {
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
  const identities = [...new Set([previousIdentity, presenterIdentity].filter((value): value is string => Boolean(value)))];
  await Promise.all(identities.map(async (identity) => {
    let participant;
    try { participant = await roomService.getParticipant(classroomLiveKitRoom(roomCode), identity); } catch { return; }
    let metadata: Record<string, unknown> = {};
    try { metadata = participant.metadata ? JSON.parse(participant.metadata) : {}; } catch {}
    const isHost = metadata.isHost === true;
    const isPresenter = identity === presenterIdentity;
    const sources = isHost
      ? HOST_PUBLISH_SOURCES
      : classroomParticipantPublishSources(settings);
    if (isPresenter) {
      if (!sources.includes(TrackSource.SCREEN_SHARE)) sources.push(TrackSource.SCREEN_SHARE);
      if (!sources.includes(TrackSource.SCREEN_SHARE_AUDIO)) sources.push(TrackSource.SCREEN_SHARE_AUDIO);
    }
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
  }));
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

  const { data: session } = await supabaseAdmin
    .from("game_sessions")
    .select("gender, player_ids, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) {
    throw new LiveKitTokenError("session_not_found", "Session not found.");
  }
  if ((session.gender as string) !== (profile.gender as string)) {
    throw new LiveKitTokenError(
      "gender_mismatch",
      "Gender partition mismatch."
    );
  }
  const playerIds = ((session.player_ids as string[]) ?? []).map(String);
  const isTeacher = profile.role === "teacher";
  if (!isTeacher && !playerIds.includes(profile.userId)) {
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
  }
> {
  const { supabaseAdmin, roomCode, displayName, accessToken, spectateMode, delegate, presenterIdentityOverride } = args;
  const serverUrl = process.env.LIVEKIT_URL?.trim() ?? "";
  const apiKey = process.env.LIVEKIT_API_KEY?.trim() ?? "";
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim() ?? "";
  if (!serverUrl || !apiKey || !apiSecret) {
    throw new LiveKitTokenError(
      "server_config",
      "LiveKit is not configured on the server."
    );
  }

  const { data: classroom } = await supabaseAdmin
    .from("classroom_sessions")
    .select("id, room_code, teacher_id, teacher_name, status, settings")
    .eq("room_code", roomCode)
    .maybeSingle();

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
  const publishSources = isHidden
    ? []
    : isHost
      ? HOST_PUBLISH_SOURCES
      : classroomParticipantPublishSources(settings);
  if (isPresenter && !isHidden) {
    if (!publishSources.includes(TrackSource.SCREEN_SHARE)) publishSources.push(TrackSource.SCREEN_SHARE);
    if (!publishSources.includes(TrackSource.SCREEN_SHARE_AUDIO)) publishSources.push(TrackSource.SCREEN_SHARE_AUDIO);
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name: finalDisplayName,
    ttl: "4h",
    metadata: JSON.stringify({
      role,
      isHost,
      isPresenter,
      hidden: isHidden,
      spectateMode: spectateMode ?? "none"
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

  const { error: activityError } = await supabaseAdmin
    .from("classroom_sessions")
    .update({ last_activity: new Date().toISOString() })
    .eq("id", classroom.id)
    .eq("status", "active");
  if (activityError) {
    logger.warn({
      protocol: "internal",
      message: "Could not refresh classroom activity",
      context: { event: "CLASSROOM_ACTIVITY_REFRESH_FAILED", roomCode },
      err: logError(activityError)
    });
  }

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
    canPublishScreenShare: publishSources.includes(TrackSource.SCREEN_SHARE)
  };
}
