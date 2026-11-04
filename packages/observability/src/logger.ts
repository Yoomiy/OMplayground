import pino from "pino";

export type ServiceName =
  | "game-server"
  | "classroom-server"
  | "voxel-server"
  | "rocket-server"
  | "wobble-server"
  | "document-converter";

// Railway recognizes textual severity labels, while Pino's default numeric
// levels are displayed there as info regardless of their actual severity.
export function formatLogLevelLabel(label: string): { level: string } {
  return { level: label };
}

export function createLogger(service: ServiceName) {
  const isProduction = process.env.NODE_ENV === "production";
  return pino({
    level: process.env.LOG_LEVEL || "info",
    base: { service, environment: process.env.NODE_ENV || "development" },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: formatLogLevelLabel,
    },
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "*.authorization",
        "*.cookie",
        "*.password",
        "*.token",
        "*.accessToken",
        "*.access_token",
        "*.presenterToken",
        "*.ticket",
        "*.accessTokenHash",
        "context.*.password",
        "context.*.token",
        "context.*.accessToken",
        "context.*.access_token",
        "context.*.presenterToken",
        "context.*.ticket",
        "body.password",
        "body.token",
        "context.token",
        "context.accessToken",
        "context.presenterToken",
        "context.ticket",
        "context.accessTokenHash",
      ],
      censor: "[REDACTED]",
    },
    ...(!isProduction
      ? {
          transport: {
            target: "pino-pretty",
            options: { colorize: true, ignore: "pid,hostname" },
          },
        }
      : {}),
  });
}
