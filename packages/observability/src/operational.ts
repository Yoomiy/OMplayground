import type { Request } from "express";
import type { Logger } from "pino";
import { logError } from "./error";
import { requestCorrelationId } from "./correlation";

export function logHttpFailure(
  logger: Logger,
  req: Request,
  err: unknown,
  event: string,
  context: Record<string, unknown> = {},
  level: "warn" | "error" = "error"
): void {
  logger[level]({
    correlationId: requestCorrelationId(req),
    protocol: "http",
    message: event,
    context: { event, status: "failed", ...context },
    err: logError(err)
  });
}

export function observeBackgroundTask(
  logger: Logger,
  task: Promise<unknown>,
  event: string,
  context: Record<string, unknown> = {}
): void {
  void task.catch((err) => {
    logger.error({
      protocol: "background",
      message: event,
      context: { event, status: "failed", ...context },
      err: logError(err)
    });
  });
}
