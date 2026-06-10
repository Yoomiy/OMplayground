import type { Express, Request, Response, NextFunction } from "express";
import type { Logger } from "pino";
import type { SupabaseClient } from "@supabase/supabase-js";
import rateLimit from "express-rate-limit";

export interface ClientTelemetryEntry {
  timestamp?: string;
  level?: string;
  correlationId?: string;
  route?: string;
  sessionId?: string;
  message?: string;
  context?: Record<string, unknown>;
  stack?: string;
}

export interface TelemetryIngestOptions {
  logger: Logger;
  supabaseAdmin: SupabaseClient | null;
}

const MAX_BATCH = 10;
const MAX_STACK_LEN = 2000;
const MAX_CONTEXT_JSON = 4000;

const SENSITIVE_KEY = /^(token|password|authorization|accessToken|access_token|jwt)$/i;

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

export function redactSensitive(
  value: unknown,
  depth = 0
): unknown {
  if (depth > 4) return "[REDACTED_DEPTH]";
  if (Array.isArray(value)) {
    return value.map((v) => redactSensitive(v, depth + 1));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactSensitive(child, depth + 1);
    }
    return out;
  }
  return value;
}

function sanitizeContext(
  ctx: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!ctx) return undefined;
  const redacted = redactSensitive(ctx) as Record<string, unknown>;
  const json = JSON.stringify(redacted);
  if (json.length <= MAX_CONTEXT_JSON) return redacted;
  return { truncated: true, preview: json.slice(0, MAX_CONTEXT_JSON) };
}

const telemetryLimiter = rateLimit({
  windowMs: 60_000,
  max: (req: Request) => {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    const jwtPattern = /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/;
    const isValidJwt = token ? jwtPattern.test(token) : false;
    return isValidJwt ? 100 : 20;
  },
  keyGenerator: (req: Request) => {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    const jwtPattern = /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/;
    const isValidJwt = token ? jwtPattern.test(token) : false;
    if (isValidJwt && token) {
      return `auth:${token.slice(-20)}`;
    }
    return `ip:${req.ip}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limited" }
});

export function mountTelemetryRoutes(
  app: Express,
  options: TelemetryIngestOptions
): void {
  const ingest = async (req: Request, res: Response) => {
    const body = req.body as { logs?: ClientTelemetryEntry[] };
    const logs = Array.isArray(body?.logs) ? body.logs.slice(0, MAX_BATCH) : [];
    if (logs.length === 0) {
      res.status(400).json({ error: "empty_batch" });
      return;
    }

    let userId: string | undefined;
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (token && options.supabaseAdmin) {
      const { data } = await options.supabaseAdmin.auth.getUser(token);
      userId = data?.user?.id;
    }

    const correlationId =
      (req as Request & { correlationId?: string }).correlationId ??
      req.headers["x-correlation-id"];

    for (const entry of logs) {
      const level = entry.level === "warn" ? "warn" : entry.level === "error" ? "error" : "info";
      options.logger[level]({
        source: "client",
        protocol: "client",
        correlationId: entry.correlationId ?? correlationId,
        userId,
        sessionId: entry.sessionId,
        message: entry.message ?? "client telemetry",
        context: {
          route: entry.route,
          ...sanitizeContext(entry.context)
        },
        stack: entry.stack ? truncate(entry.stack, MAX_STACK_LEN) : undefined
      });
    }

    res.json({ ok: true, accepted: logs.length });
  };

  app.post("/api/telemetry", telemetryLimiter, ingest);
  app.post("/api/telemetry-beacon", telemetryLimiter, (req, res) => {
    void ingest(req, res);
  });
}
