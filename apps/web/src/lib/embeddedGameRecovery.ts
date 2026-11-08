import { reportTelemetry } from "@/utils/telemetry";

export type EmbeddedStage = "service" | "frame" | "join" | "live" | "failed";
export class EmbeddedGameError extends Error {
  constructor(
    readonly code: string,
    readonly status?: number,
  ) {
    super(code);
  }
}
export function embeddedErrorCode(error: unknown): string {
  return error instanceof Error && /^[A-Z][A-Z0-9_]{0,63}$/.test(error.message)
    ? error.message
    : "SERVICE_UNAVAILABLE";
}

/** Parent-owned readiness is authoritative; iframe load/error events cannot identify error documents. */
export function createEmbeddedRecovery(options: {
  game: "rocket" | "wobble";
  origin: string;
  sessionId: string;
  attemptId: string;
  signal: AbortSignal;
  onStage(stage: EmbeddedStage): void;
  onFailure(code: string): void;
}) {
  let stage: EmbeddedStage = "service";
  let timer: ReturnType<typeof setTimeout> | undefined;
  let failed = false;
  let settled = false;
  let responseId: string | undefined;
  const began = Date.now();
  const emit = (
    level: "info" | "warn" | "error",
    message: string,
    code?: string,
    status?: number,
  ) => {
    if (options.signal.aborted) return;
    reportTelemetry(
      {
        level,
        message,
        sessionId: options.sessionId,
        dedupeKey: `${options.attemptId}:${stage}:${code ?? message}`,
        context: {
          appArea: "embedded-game",
          protocol: "iframe",
          game: options.game,
          stage,
          attemptId: options.attemptId,
          serviceOrigin: options.origin,
          elapsedMs: Date.now() - began,
          ...(code ? { code } : {}),
          ...(status ? { httpStatus: status } : {}),
          ...(responseId ? { serviceRequestId: responseId } : {}),
        },
      },
      "game-server",
    );
  };
  const stop = () => clearTimeout(timer);
  const fail = (error: unknown) => {
    if (options.signal.aborted || failed) return;
    const code = embeddedErrorCode(error);
    emit(
      "error",
      settled ? "Embedded game connection failed" : "Embedded game startup failed",
      code,
      error instanceof EmbeddedGameError ? error.status : undefined,
    );
    failed = true;
    stop();
    stage = "failed";
    options.onStage(stage);
    options.onFailure(code);
  };
  const watch = (next: EmbeddedStage, ms = 20_000) => {
    if (options.signal.aborted || failed) return;
    stop();
    stage = next;
    options.onStage(next);
    timer = setTimeout(
      () =>
        fail(new EmbeddedGameError(next === "frame" ? "FRAME_READY_TIMEOUT" : "GAME_JOIN_TIMEOUT")),
      ms,
    );
  };
  const request = async (path: string, init: RequestInit = {}) => {
    const response = await fetch(`${options.origin}${path}`, {
      ...init,
      signal: AbortSignal.any([options.signal, AbortSignal.timeout(10_000)]),
    });
    const id = response.headers.get("X-Correlation-ID");
    responseId = id && /^[A-Za-z0-9_-]{1,100}$/.test(id) ? id : undefined;
    return response;
  };
  options.signal.addEventListener("abort", stop, { once: true });
  emit("info", "Embedded game startup started");
  return {
    async prepare(validate: (value: unknown) => boolean): Promise<unknown> {
      try {
        const response = await request(`/api/${options.game}/config`, { cache: "no-store" });
        if (!response.ok) throw new EmbeddedGameError("SERVICE_UNAVAILABLE", response.status);
        const config: unknown = await response.json();
        if (!validate(config)) throw new EmbeddedGameError("SERVICE_OUTDATED");
        if (options.signal.aborted) return;
        watch("frame", 25_000);
        return config;
      } catch (error) {
        fail(error);
      }
    },
    request,
    joining() {
      if (stage === "live") emit("warn", "Embedded game connection interrupted", "CONNECTION_LOST");
      watch("join");
    },
    live() {
      if (options.signal.aborted || failed) return;
      const recovering = settled && stage === "join";
      stop();
      stage = "live";
      options.onStage(stage);
      if (!settled || recovering)
        emit(
          "info",
          recovering ? "Embedded game connection recovered" : "Embedded game startup ready",
        );
      settled = true;
    },
    fail,
    report(code: string) {
      emit(
        "warn",
        "Embedded game operation failed",
        /^[A-Z][A-Z0-9_]{0,63}$/.test(code) ? code : "CONNECTION_FAILED",
      );
    },
    stop,
    get failed() {
      return failed;
    },
  };
}
