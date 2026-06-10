import { supabase } from "@/lib/supabase";
import { getVoxelServerUrl } from "@/lib/voxelServerUrl";
import { getCorrelationId } from "@/utils/correlation";

export type TelemetryTarget = "game-server" | "voxel-server" | "shell";

export interface TelemetryEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  correlationId: string;
  route?: string;
  sessionId?: string;
  message: string;
  context?: Record<string, unknown>;
  stack?: string;
}

const MAX_BATCH = 10;
const FLUSH_MS = 5_000;

type FlushTarget = "game-server" | "voxel-server";

const buffers: Record<FlushTarget, TelemetryEntry[]> = {
  "game-server": [],
  "voxel-server": []
};

const flushTimers: Partial<Record<FlushTarget, ReturnType<typeof setTimeout>>> = {};

function gameServerUrl(): string {
  const fromEnv = import.meta.env.VITE_GAME_SERVER_URL?.trim();
  if (fromEnv) return fromEnv;
  if (import.meta.env.DEV && typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:8080";
}

function resolveFlushTarget(target: TelemetryTarget): FlushTarget {
  return target === "voxel-server" ? "voxel-server" : "game-server";
}

function targetBaseUrl(flushTarget: FlushTarget): string {
  if (flushTarget === "voxel-server") return getVoxelServerUrl();
  return gameServerUrl();
}

function scheduleFlush(flushTarget: FlushTarget): void {
  if (flushTimers[flushTarget]) return;
  flushTimers[flushTarget] = setTimeout(() => {
    flushTimers[flushTarget] = undefined;
    void flushTelemetry(flushTarget === "voxel-server" ? "voxel-server" : "game-server");
  }, FLUSH_MS);
}

export function reportTelemetry(
  entry: Omit<TelemetryEntry, "timestamp" | "correlationId"> & {
    correlationId?: string;
  },
  target: TelemetryTarget = "shell"
): void {
  const flushTarget = resolveFlushTarget(target);
  buffers[flushTarget].push({
    timestamp: new Date().toISOString(),
    correlationId: entry.correlationId ?? getCorrelationId(),
    level: entry.level,
    route: entry.route ?? (typeof window !== "undefined" ? window.location.pathname : undefined),
    sessionId: entry.sessionId,
    message: entry.message,
    context: entry.context,
    stack: entry.stack?.slice(0, 2000)
  });
  if (buffers[flushTarget].length >= MAX_BATCH) {
    void flushTelemetry(target);
    return;
  }
  scheduleFlush(flushTarget);
}

export async function flushTelemetry(
  target: TelemetryTarget = "shell"
): Promise<void> {
  const flushTarget = resolveFlushTarget(target);
  const buffer = buffers[flushTarget];
  if (buffer.length === 0) return;
  const batch = buffer.splice(0, MAX_BATCH);
  const base = targetBaseUrl(flushTarget);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-correlation-id": getCorrelationId()
  };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    await fetch(`${base}/api/telemetry`, {
      method: "POST",
      headers,
      body: JSON.stringify({ logs: batch }),
      keepalive: true
    });
  } catch {
    // Best-effort only; never throw into UI.
  }

  if (buffer.length > 0) {
    scheduleFlush(flushTarget);
  }
}

export function installGlobalTelemetry(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (event) => {
    reportTelemetry({
      level: "error",
      message: event.message || "Unhandled error",
      stack: event.error?.stack,
      context: { appArea: "global", filename: event.filename, lineno: event.lineno }
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    reportTelemetry({
      level: "error",
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      context: { appArea: "global", kind: "unhandledrejection" }
    });
  });
}
