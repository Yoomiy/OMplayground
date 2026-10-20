import { resolve } from "node:path"
import { createActionHost } from "./host"
import { installProcessLifecycle, logger } from "./logging"

let host: ReturnType<typeof createActionHost> | null = null
installProcessLifecycle(async () => {
  await host?.close()
})

const port = Number(process.env.ACTION_PORT ?? 19003)
const maxRooms = Number(process.env.ACTION_MAX_ROOMS ?? 4)
const seed =
  process.env.ACTION_QA_SEED === undefined ? undefined : Number(process.env.ACTION_QA_SEED)
if (seed !== undefined && (!Number.isInteger(seed) || seed < 0 || seed >= 2 ** 32))
  throw new Error("Invalid QA seed")
if (
  !Number.isInteger(port) ||
  port < 1 ||
  port > 65535 ||
  !Number.isInteger(maxRooms) ||
  maxRooms < 1 ||
  maxRooms > 32
)
  throw new Error("Invalid action host configuration")
host = createActionHost({
  staticRoot: resolve(process.env.ACTION_STATIC_ROOT ?? "dist"),
  maxRooms,
  ...(seed === undefined ? {} : { seed }),
  ...(process.env.ACTION_ORIGIN === undefined ? {} : { allowedOrigin: process.env.ACTION_ORIGIN }),
})
host.server.listen(port, "127.0.0.1", () =>
  logger.info(
    {
      protocol: "internal",
      context: { event: "ACTION_HOST_READY", status: "success", port, maxRooms },
    },
    "Action host ready",
  ),
)
