import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }) } }
}));
vi.mock("@/lib/voxelServerUrl", () => ({ getVoxelServerUrl: () => "https://voxel.example" }));
vi.mock("@/utils/correlation", () => ({ getCorrelationId: () => "c-test" }));

import { flushTelemetry, installGlobalTelemetry, reportTelemetry } from "./telemetry";

describe("client telemetry queue", () => {
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps a batch queued after a non-2xx response and retries it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    reportTelemetry({ level: "error", message: "retry-me" }, "game-server");
    await flushTelemetry("game-server");
    await flushTelemetry("game-server");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1]?.body).toBe(fetchMock.mock.calls[1][1]?.body);
  });

  it("does not beacon-flush a queue whose head is being fetched", async () => {
    vi.useRealTimers();
    let resolveFetch: ((response: { ok: boolean; status: number }) => void) | undefined;
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => new Promise<{ ok: boolean; status: number }>((resolve) => {
        resolveFetch = resolve;
      }))
      .mockResolvedValueOnce({ ok: true, status: 200 });
    const listeners = new Map<string, () => void>();
    const sendBeacon = vi.fn(() => true);
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", {
      addEventListener: (event: string, listener: () => void) => listeners.set(event, listener),
      location: { pathname: "/test" }
    });
    vi.stubGlobal("navigator", { sendBeacon });
    installGlobalTelemetry();

    reportTelemetry({ level: "error", message: "in-flight" }, "game-server");
    const inFlight = flushTelemetry("game-server");
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    reportTelemetry({ level: "error", message: "queued-after-fetch" }, "game-server");
    listeners.get("pagehide")?.();
    expect(sendBeacon).not.toHaveBeenCalled();

    resolveFetch?.({ ok: true, status: 200 });
    await inFlight;
    await flushTelemetry("game-server");

    const secondBatch = JSON.parse(fetchMock.mock.calls[1][1]?.body as string) as {
      logs: Array<{ message: string }>;
    };
    expect(secondBatch.logs).toEqual([expect.objectContaining({ message: "queued-after-fetch" })]);
  });
});
