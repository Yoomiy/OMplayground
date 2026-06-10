import pino from "pino";

export type ServiceName = "game-server" | "minecraft-server";

export function createLogger(service: ServiceName) {
  const isProduction = process.env.NODE_ENV === "production";
  return pino({
    level: process.env.LOG_LEVEL || "info",
    base: { service, environment: process.env.NODE_ENV || "development" },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "body.password",
        "body.token",
        "context.token",
        "context.accessToken"
      ],
      censor: "[REDACTED]"
    },
    transport: !isProduction
      ? {
          target: "pino-pretty",
          options: { colorize: true, ignore: "pid,hostname" }
        }
      : undefined
  });
}
