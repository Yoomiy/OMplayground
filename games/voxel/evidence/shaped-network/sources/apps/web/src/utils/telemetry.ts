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
const MAX_BUFFER = 100;
const FLUSH_MS = 5_000;
const MAX_RETRY_MS = 60_000;

type FlushTarget = "game-server" | "voxel-server";
let shellTarget: FlushTarget = "game-server";

const buffers: Record<FlushTarget, TelemetryEntry[]> = {
  "game-server": [],
  "voxel-server": []
};

const flushTimers: Partial<Record<FlushTarget, ReturnType<typeof setTimeout>>> = {};
const flushing: Partial<Record<FlushTarget, boolean>> = {};
const retryCounts: Record<FlushTarget, number> = { "game-server": 0, "voxel-server": 0 };
const recentFingerprints = new Map<string, number>();

function gameServerUrl(): string {
  const fromEnv = import.meta.env.VITE_GAME_SERVER_URL?.trim();
  if (fromEnv) return fromEnv;
  if (import.meta.env.DEV && typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:8080";
}

function resolveFlushTarget(target: TelemetryTarget): FlushTarget {
  if (target === "shell") return shellTarget;
  return target;
}

export function setShellTelemetryTarget(target: FlushTarget): () => void {
  const previous = shellTarget;
  shellTarget = target;
  return () => {
    if (shellTarget === target) shellTarget = previous;
  };
}

function targetBaseUrl(flushTarget: FlushTarget): string {
  if (flushTarget === "voxel-server") return getVoxelServerUrl();
  return gameServerUrl();
}

function scheduleFlush(flushTarget: FlushTarget, delayMs = FLUSH_MS): void {
  if (flushTimers[flushTarget]) return;
  flushTimers[flushTarget] = setTimeout(() => {
    flushTimers[flushTarget] = undefined;
    void flushTelemetry(flushTarget === "voxel-server" ? "voxel-server" : "game-server");
  }, delayMs);
}

export function reportTelemetry(
  entry: Omit<TelemetryEntry, "timestamp" | "correlationId"> & {
    correlationId?: string;
  },
  target: TelemetryTarget = "shell"
): void {
  const flushTarget = resolveFlushTarget(target);
  const normalized = {
    timestamp: new Date().toISOString(),
    correlationId: entry.correlationId ?? getCorrelationId(),
    level: entry.level,
    route: entry.route ?? (typeof window !== "undefined" ? window.location.pathname : undefined),
    sessionId: entry.sessionId,
    message: entry.message,
    context: entry.context,
    stack: entry.stack?.slice(0, 2000)
  } satisfies TelemetryEntry;
  const fingerprint = `${flushTarget}:${normalized.level}:${normalized.message}:${normalized.sessionId ?? ""}`;
  const now = Date.now();
  if (now - (recentFingerprints.get(fingerprint) ?? 0) < 3_000) return;
  recentFingerprints.set(fingerprint, now);
  if (recentFingerprints.size > 200) {
    for (const [key, at] of recentFingerprints) if (now - at > 60_000) recentFingerprints.delete(key);
  }
  buffers[flushTarget].push(normalized);
  if (buffers[flushTarget].length > MAX_BUFFER) buffers[flushTarget].splice(0, buffers[flushTarget].length - MAX_BUFFER);
  if (buffers[flushTarget].length >= MAX_BATCH) {
    void flushTelemetry(target);
    return;
  }
  scheduleFlush(flushTarget);
}

export function reportCaughtError(
  message: string,
  error: unknown,
  context: Record<string, unknown>,
  target: TelemetryTarget = "shell",
  level: "warn" | "error" = "error"
): void {
  reportTelemetry({
    level,
    message,
    stack: error instanceof Error ? error.stack : undefined,
    context
  }, target);
}

export async function flushTelemetry(
  target: TelemetryTarget = "shell"
): Promise<void> {
  const flushTarget = resolveFlushTarget(target);
  const buffer = buffers[flushTarget];
  if (buffer.length === 0 || flushing[flushTarget]) return;
  flushing[flushTarget] = true;
  const batch = buffer.slice(0, MAX_BATCH);
  const base = targetBaseUrl(flushTarget);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-correlation-id": getCorrelationId()
  };
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${base}/api/telemetry`, {
      method: "POST",
      headers,
      body: JSON.stringify({ logs: batch }),
      keepalive: true
    });
    if (!response.ok) throw new Error(`telemetry_http_${response.status}`);
    buffer.splice(0, batch.length);
    retryCounts[flushTarget] = 0;
  } catch {
    retryCounts[flushTarget] += 1;
  } finally {
    flushing[flushTarget] = false;
  }

  if (buffer.length > 0) {
    const retryDelay = Math.min(MAX_RETRY_MS, FLUSH_MS * 2 ** Math.min(retryCounts[flushTarget], 4));
    scheduleFlush(flushTarget, retryCounts[flushTarget] ? retryDelay + Math.floor(Math.random() * 1_000) : FLUSH_MS);
  }
}

function flushWithBeacon(flushTarget: FlushTarget): void {
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") return;
  // A fetch owns the head of this queue until it settles. Sending that same
  // batch by beacon would make the fetch's positional removal discard entries
  // appended while it was in flight.
  if (flushing[flushTarget]) return;
  const buffer = buffers[flushTarget];
  if (buffer.length === 0) return;
  const batch = buffer.slice(0, MAX_BATCH);
  const body = new Blob([JSON.stringify({ logs: batch })], { type: "text/plain;charset=UTF-8" });
  if (navigator.sendBeacon(`${targetBaseUrl(flushTarget)}/api/telemetry-beacon`, body)) {
    buffer.splice(0, batch.length);
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

  window.addEventListener("pagehide", () => {
    flushWithBeacon("game-server");
    flushWithBeacon("voxel-server");
  });
}
