import express, { type Express, type Request, type Response } from "express";
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
const MAX_MESSAGE_LEN = 500;
const MAX_ROUTE_LEN = 300;
const MAX_ID_LEN = 128;
const MAX_STACK_LEN = 2000;
const MAX_CONTEXT_JSON = 4000;

const SENSITIVE_KEY = /(token|password|authorization|cookie|secret|ticket|jwt)/i;

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

function sanitizeText(value: string, max: number): string {
  return truncate(value, max)
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(/[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/g, "[REDACTED_JWT]")
    .replace(/([?&](?:token|ticket|access_token)=)[^&\s]+/gi, "$1[REDACTED]");
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
  return typeof value === "string" ? sanitizeText(value, 500) : value;
}

function sanitizeContext(
  ctx: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!ctx) return undefined;
  const redacted = redactSensitive(ctx) as Record<string, unknown>;
  const json = JSON.stringify(redacted);
  if (json.length <= MAX_CONTEXT_JSON) return redacted;
  return { truncated: true };
}

const telemetryLimiter = rateLimit({
  windowMs: 60_000,
  // Do not grant a higher limit merely because a string looks like a JWT.
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limited" }
});

export function mountTelemetryRoutes(
  app: Express,
  options: TelemetryIngestOptions
): void {
  const ingest = async (req: Request, res: Response) => {
    let body: { logs?: ClientTelemetryEntry[] };
    try {
      body = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) as { logs?: ClientTelemetryEntry[] };
    } catch {
      res.status(400).json({ error: "invalid_json" });
      return;
    }
    const logs = Array.isArray(body?.logs) ? body.logs.slice(0, MAX_BATCH) : [];
    if (logs.length === 0) {
      res.status(400).json({ error: "empty_batch" });
      return;
    }

    let userId: string | undefined;
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (token && options.supabaseAdmin) {
      try {
        const { data, error } = await options.supabaseAdmin.auth.getUser(token);
        if (!error) userId = data?.user?.id;
      } catch {
        // Telemetry remains usable during transient auth-service failures.
      }
    }

    const correlationId =
      (req as Request & { correlationId?: string }).correlationId ??
      req.headers["x-correlation-id"];

    for (const entry of logs) {
      const level = entry.level === "warn" ? "warn" : entry.level === "error" ? "error" : "info";
      options.logger[level]({
        source: "client",
        protocol: "client",
        correlationId: safeId(entry.correlationId) ?? safeId(correlationId),
        userId,
        sessionId: safeId(entry.sessionId),
        message: entry.message ? sanitizeText(entry.message, MAX_MESSAGE_LEN) : "client telemetry",
        context: {
          route: entry.route ? sanitizeText(entry.route, MAX_ROUTE_LEN) : undefined,
          ...sanitizeContext(entry.context)
        },
        stack: entry.stack ? sanitizeText(entry.stack, MAX_STACK_LEN) : undefined
      });
    }

    res.json({ ok: true, accepted: logs.length });
  };

  app.post("/api/telemetry", telemetryLimiter, ingest);
  app.post("/api/telemetry-beacon", express.text({ type: "text/plain", limit: "64kb" }), telemetryLimiter, (req, res) => {
    void ingest(req, res);
  });
}


function safeId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_ID_LEN) return undefined;
  return /^[a-zA-Z0-9._:-]+$/.test(trimmed) ? trimmed : undefined;
}
