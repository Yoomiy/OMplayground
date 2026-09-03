import type { Logger } from "pino";
import { logError } from "./error";

export interface ProcessLifecycleOptions {
  logger: Logger;
  shutdown: (signal: NodeJS.Signals | "unhandledRejection") => Promise<void>;
  timeoutMs?: number;
}
export function installProcessLifecycle(options: ProcessLifecycleOptions): () => void {
  const timeoutMs = options.timeoutMs ?? 10_000;
  let shuttingDown = false;

  const shutdown = (signal: NodeJS.Signals | "unhandledRejection", exitCode: number) => {
    if (shuttingDown) return;
    shuttingDown = true;
    options.logger.info({
      message: "Service shutdown started",
      context: { event: "SERVICE_SHUTDOWN_STARTED", signal, status: "started" }
    });

    const hardStop = setTimeout(() => {
      options.logger.fatal({
        message: "Service shutdown timed out",
        context: { event: "SERVICE_SHUTDOWN_TIMEOUT", signal, timeout_ms: timeoutMs, status: "failed" }
      });
      process.exit(exitCode);
    }, timeoutMs);
    hardStop.unref();

    void options.shutdown(signal).then(
      () => {
        clearTimeout(hardStop);
        options.logger.info({
          message: "Service shutdown completed",
          context: { event: "SERVICE_SHUTDOWN_COMPLETED", signal, status: "success" }
        });
        process.exit(exitCode);
      },
      (err) => {
        clearTimeout(hardStop);
        options.logger.fatal({
          message: "Service shutdown failed",
          context: { event: "SERVICE_SHUTDOWN_FAILED", signal, status: "failed" },
          err: logError(err)
        });
        process.exit(1);
      }
    );
  };

  const onSigterm = () => shutdown("SIGTERM", 0);
  const onSigint = () => shutdown("SIGINT", 0);
  const onUnhandledRejection = (reason: unknown) => {
    options.logger.fatal({
      message: "Unhandled promise rejection",
      context: { event: "UNHANDLED_REJECTION", status: "failed" },
      err: logError(reason)
    });
    shutdown("unhandledRejection", 1);
  };
  const onUncaughtExceptionMonitor = (err: Error, origin: string) => {
    // Observation only: Node retains its normal fatal uncaught-exception behavior.
    options.logger.fatal({
      message: "Uncaught exception",
      context: { event: "UNCAUGHT_EXCEPTION", origin, status: "failed" },
      err
    });
  };

  process.once("SIGTERM", onSigterm);
  process.once("SIGINT", onSigint);
  process.once("unhandledRejection", onUnhandledRejection);
  process.on("uncaughtExceptionMonitor", onUncaughtExceptionMonitor);

  return () => {
    process.off("SIGTERM", onSigterm);
    process.off("SIGINT", onSigint);
    process.off("unhandledRejection", onUnhandledRejection);
    process.off("uncaughtExceptionMonitor", onUncaughtExceptionMonitor);
  };
}
