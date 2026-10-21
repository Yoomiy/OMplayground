import { expect, test } from "bun:test"
import { TwirpError } from "livekit-server-sdk"
import { revokeGameVoiceParticipant } from "../src/platform/voice"

test("voice cleanup accepts a structured missing room/participant without depending on error wording", async () => {
  const calls: string[][] = []
  await revokeGameVoiceParticipant(
    {
      async removeParticipant(room, identity) {
        calls.push([room, identity])
        throw new TwirpError("Not Found", "participant does not exist", 404, "not_found")
      },
    },
    "session",
    "racer",
  )
  expect(calls).toEqual([["game-session-session", "racer"]])
})

test("voice cleanup preserves permission, routing and network failures for diagnostics", async () => {
  for (const error of [
    new TwirpError("Unauthorized", "invalid API key", 401, "unauthenticated"),
    new TwirpError("Forbidden", "participant not found for this API key", 403, "permission_denied"),
    new TwirpError("Not Found", "unknown endpoint", 404),
    new TypeError("fetch failed"),
  ]) {
    await expect(
      revokeGameVoiceParticipant(
        {
          async removeParticipant() {
            throw error
          },
        },
        "session",
        "racer",
      ),
    ).rejects.toBe(error)
  }
})
