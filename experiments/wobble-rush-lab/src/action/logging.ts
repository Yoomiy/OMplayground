/** Standalone adapter for docs/LOGGING.md; no platform workspace/services required. */
import pino from "pino"
import { ACTION_CONTENT, ACTION_PROTOCOL } from "../shared/action-protocol"

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: {
    service: "wobble-action-lab",
    environment: process.env.NODE_ENV ?? "development",
    build: ACTION_CONTENT,
    protocolVersion: ACTION_PROTOCOL,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: { level: (level) => ({ level }) },
  redact: {
    paths: ["*.authorization", "*.cookie", "*.password", "*.token", "*.accessToken"],
    censor: "[REDACTED]",
  },
})

/** Supervise fatal rejections and bound shutdown without importing platform services. */
export function installProcessLifecycle(shutdown: () => Promise<void>): void {
  let stopping = false
  const stop = async (reason: string, error?: unknown): Promise<void> => {
    if (stopping) return
    stopping = true
    const failed = reason === "uncaughtException" || reason === "unhandledRejection"
    if (failed)
      logger.fatal(
        {
          err: error,
          protocol: "internal",
          context: { event: "ACTION_PROCESS_FAILED", status: "failed", reason },
        },
        "Action host failed",
      )
    else
      logger.info(
        {
          protocol: "internal",
          context: { event: "ACTION_SHUTDOWN_STARTED", status: "started", reason },
        },
        "Stopping action host",
      )
    const timeout = setTimeout(() => {
      logger.fatal(
        { context: { event: "ACTION_SHUTDOWN_TIMED_OUT", status: "failed" } },
        "Action host shutdown timed out",
      )
      process.exit(1)
    }, 5000)
    try {
      await shutdown()
      logger.info(
        { context: { event: "ACTION_SHUTDOWN_COMPLETED", status: "success" } },
        "Action host stopped",
      )
      await new Promise<void>((done) => logger.flush(() => done()))
      clearTimeout(timeout)
      process.exit(failed ? 1 : 0)
    } catch (err) {
      logger.fatal(
        { err, context: { event: "ACTION_SHUTDOWN_FAILED", status: "failed" } },
        "Action host cleanup failed",
      )
      clearTimeout(timeout)
      process.exit(1)
    }
  }
  for (const signal of ["SIGTERM", "SIGINT"] as const)
    process.once(signal, () => {
      void stop(signal)
    })
  process.once("uncaughtException", (error) => {
    void stop("uncaughtException", error)
  })
  process.once("unhandledRejection", (error) => {
    void stop("unhandledRejection", error)
  })
}
