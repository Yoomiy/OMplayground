import { type RoomServiceClient, TwirpError } from "livekit-server-sdk"

/** A missing room/participant already satisfies cleanup; other failures must be reported. */
export async function revokeGameVoiceParticipant(
  voice: Pick<RoomServiceClient, "removeParticipant">,
  sessionId: string,
  userId: string,
): Promise<void> {
  try {
    await voice.removeParticipant(`game-session-${sessionId}`, userId)
  } catch (error) {
    if (error instanceof TwirpError && error.code === "not_found") return
    throw error
  }
}
