import { AccessToken } from "livekit-server-sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCachedAuth } from "./authCache";

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
}

export async function generateClassroomToken(
  args: GenerateClassroomTokenArgs
): Promise<LiveKitTokenResult & { isHost: boolean; role: string }> {
  const { supabaseAdmin, roomCode, displayName, accessToken, spectateMode } = args;
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

  const livekitRoom = `classroom-${roomCode}`;
  const isTeacher = profile?.role === "teacher" || profile?.role === "admin";
  const isCreatorTeacher = profile && classroom.teacher_id === profile.userId;
  const isHost = isTeacher || isCreatorTeacher;
  const role = profile?.role ?? "student";
  const finalDisplayName = (profile?.full_name ?? displayName ?? "משתתף").trim();
  const identity = profile?.userId ?? `guest-${Math.random().toString(36).substring(2, 9)}`;

  const isHidden = role === "admin" && spectateMode === "invisible";

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name: finalDisplayName,
    ttl: "4h",
    metadata: JSON.stringify({
      role,
      isHost,
      hidden: isHidden,
      spectateMode: spectateMode ?? "none"
    })
  });

  at.addGrant({
    roomJoin: true,
    room: livekitRoom,
    canPublish: !isHidden,
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
    role
  };
}

