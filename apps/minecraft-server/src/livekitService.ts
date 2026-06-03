import { AccessToken } from "livekit-server-sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface GenerateTokenArgs {
  supabaseAdmin: SupabaseClient; // reuse the existing service-role client from index.ts
  accessToken: string;           // Supabase Bearer JWT (from the Authorization header)
  sessionId: string;             // Game Session ID (maps 1:1 to the voice room)
}

/**
 * Validates a user session and issues a LiveKit access token.
 * Mirrors the socket handshake auth in index.ts (getUser -> kid_profiles -> is_active).
 */
export async function generateLiveKitToken(args: GenerateTokenArgs): Promise<string> {
  const { supabaseAdmin, accessToken, sessionId } = args;

  // 1. Verify the Supabase session (same call as the socket handshake)
  const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(accessToken);
  if (authErr || !authData?.user?.id) {
    throw new Error("Unauthorized: Invalid user session token.");
  }
  const user = authData.user;

  // 2. Fetch profile details. NOTE: the column is `full_name`, not `username`.
  const { data: profile } = await supabaseAdmin
    .from("kid_profiles")
    .select("full_name, is_active, gender, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) {
    throw new Error("Profile not found or inactive.");
  }

  // 3. Authorize against the session itself. The token path must enforce the
  // same gender/roster gate that JOIN_ROOM does — otherwise a valid kid could
  // request a voice token for any sessionId (e.g. the opposite-gender cohort)
  // and bypass segregation entirely, since LiveKit connect skips the socket.
  const { data: session } = await supabaseAdmin
    .from("game_sessions")
    .select("gender, player_ids, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) {
    throw new Error("Session not found.");
  }
  if ((session.gender as string) !== (profile.gender as string)) {
    throw new Error("Gender partition mismatch.");
  }
  // Mirror JOIN_ROOM: paused sessions are restricted to their original roster.
  const playerIds = ((session.player_ids as string[]) ?? []).map(String);
  const isTeacher = profile.role === "teacher";
  if (session.status === "paused" && !isTeacher && !playerIds.includes(user.id)) {
    throw new Error("Not in session roster.");
  }
  if (session.status === "completed") {
    throw new Error("Session already completed.");
  }

  // Session is already gender-segregated by the socket layer; key purely on sessionId.
  const roomName = `voxel-session-${sessionId}`;
  const identity = user.id;
  const participantName = profile.full_name as string;

  // 4. Construct and sign the LiveKit Access Token
  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
    {
      identity,
      name: participantName,
      ttl: "2h", // Token expiry duration
    }
  );

  // Grant necessary publish & subscribe permissions for voice streams
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false, // Position updates are handled over authoritative sockets
  });

  // toJwt() is async in current livekit-server-sdk.
  return await at.toJwt();
}
