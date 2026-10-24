import { resolve } from "node:path"
import { RoomServiceClient } from "livekit-server-sdk"
import { createGameVoiceToken } from "../../../../apps/game-server/src/gameVoiceToken"
import { installProcessLifecycle } from "../../../../packages/observability/src/processLifecycle"
import { PlatformGateway } from "./gateway"
import { platformLog, platformLogger } from "./logging"
import { createPlatformService } from "./service"
import { revokeGameVoiceParticipant } from "./voice"

declare const WOBBLE_BUILD: string
const release = typeof WOBBLE_BUILD === "string" ? WOBBLE_BUILD : "development-unbuilt"
const port = Number(process.env.PORT ?? 3000)
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT must be a valid port")
const voiceUrl = process.env.LIVEKIT_URL
const voice =
  voiceUrl && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET
    ? new RoomServiceClient(
        voiceUrl.replace(/^ws/, "http"),
        process.env.LIVEKIT_API_KEY,
        process.env.LIVEKIT_API_SECRET,
      )
    : null
const service = createPlatformService({
  gateway: new PlatformGateway(
    process.env.SUPABASE_URL ?? "",
    process.env.SUPABASE_SECRET_KEY ?? "",
  ),
  secret: process.env.WOBBLE_TICKET_SECRET ?? "",
  origins: (process.env.APP_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  clientDir: resolve(process.env.WOBBLE_CLIENT_DIR ?? "dist/client"),
  release,
  createVoiceToken: createGameVoiceToken,
  ...(voice
    ? {
        revokeVoice: (sessionId: string, userId: string) =>
          revokeGameVoiceParticipant(voice, sessionId, userId),
      }
    : {}),
})
installProcessLifecycle({
  logger: platformLogger,
  shutdown: () => service.close(),
  timeoutMs: 30_000,
})
service.server.listen(port, process.env.HOST ?? "127.0.0.1", () =>
  platformLog("info", "WOBBLE_SERVICE_READY", { port, release, activeRooms: service.rooms.size }),
)
