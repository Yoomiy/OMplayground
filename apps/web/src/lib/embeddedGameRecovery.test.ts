import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/utils/telemetry", () => ({ reportTelemetry: vi.fn() }));
import { reportTelemetry } from "@/utils/telemetry";
import { createEmbeddedRecovery } from "./embeddedGameRecovery";

function fixture(attemptId = "attempt-one") {
  const onFailure = vi.fn(),
    onStage = vi.fn(),
    abort = new AbortController();
  const recovery = createEmbeddedRecovery({
    game: "rocket",
    origin: "https://rocket.example",
    sessionId: "room",
    attemptId,
    signal: abort.signal,
    onFailure,
    onStage,
  });
  return { recovery, onFailure, onStage, abort };
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("parent-owned embedded game recovery", () => {
  it("reports an unavailable service before permitting an iframe load", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const { recovery, onFailure, onStage } = fixture();
    expect(await recovery.prepare(() => true)).toBeUndefined();
    expect(onFailure).toHaveBeenCalledWith("SERVICE_UNAVAILABLE");
    expect(onStage).not.toHaveBeenCalledWith("frame");
  });
  it("times out an error document that never sends ready, even if its load event would fire", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response("{}", { headers: { "X-Correlation-ID": "service-id" } })),
    );
    const { recovery, onFailure } = fixture();
    await recovery.prepare(() => true);
    vi.advanceTimersByTime(25_001);
    expect(onFailure).toHaveBeenCalledWith("FRAME_READY_TIMEOUT");
    expect(reportTelemetry).toHaveBeenLastCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ stage: "frame", serviceRequestId: "service-id" }),
      }),
      "game-server",
    );
  });
  it("bounds a successful launch request that never produces a valid room state", () => {
    vi.useFakeTimers();
    const { recovery, onFailure } = fixture();
    recovery.joining();
    vi.advanceTimersByTime(20_001);
    expect(onFailure).toHaveBeenCalledWith("GAME_JOIN_TIMEOUT");
  });
  it("clears startup deadlines after joining and ignores abandoned attempts", () => {
    vi.useFakeTimers();
    const first = fixture();
    first.recovery.joining();
    first.recovery.live();
    const abandoned = fixture("abandoned");
    abandoned.recovery.joining();
    abandoned.abort.abort();
    vi.advanceTimersByTime(60_000);
    expect(first.onFailure).not.toHaveBeenCalled();
    expect(abandoned.onFailure).not.toHaveBeenCalled();
  });
  it("assigns a distinct telemetry dedupe key to each user retry", () => {
    fixture("one").recovery.fail(new Error("CONNECTION_FAILED"));
    fixture("two").recovery.fail(new Error("CONNECTION_FAILED"));
    const failures = vi
      .mocked(reportTelemetry)
      .mock.calls.map(([entry]) => entry)
      .filter((entry) => entry.level === "error");
    expect(new Set(failures.map((entry) => entry.dedupeKey)).size).toBe(2);
  });
});
