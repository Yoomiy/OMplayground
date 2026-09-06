import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLegacyWasmExitGuard,
  teardownLegacyWasmIframe,
  type LegacyWasmIframe,
  type LegacyWasmMessageHost
} from "./legacyWasmTeardown";

class FakeMessageHost implements LegacyWasmMessageHost {
  private listeners = new Set<(event: MessageEvent) => void>();

  addEventListener(_type: "message", listener: (event: MessageEvent) => void) {
    this.listeners.add(listener);
  }

  removeEventListener(_type: "message", listener: (event: MessageEvent) => void) {
    this.listeners.delete(listener);
  }

  emit(event: Partial<MessageEvent>) {
    for (const listener of this.listeners) listener(event as MessageEvent);
  }
}

class FakeIframe implements LegacyWasmIframe {
  readonly contentWindow = { postMessage: vi.fn() };
  private loadListeners = new Set<() => void>();
  private currentSrc = "/legacy/gravvity/index.html";

  get src() {
    return this.currentSrc;
  }

  set src(value: string) {
    this.currentSrc = value;
  }

  addEventListener(_type: "load", listener: () => void) {
    this.loadListeners.add(listener);
  }

  removeEventListener(_type: "load", listener: () => void) {
    this.loadListeners.delete(listener);
  }

  emitLoad() {
    for (const listener of this.loadListeners) listener();
  }
}

const origin = "https://playground.test";

describe("legacy WASM teardown", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("waits for the matching acknowledgement and then blanks the iframe", async () => {
    const host = new FakeMessageHost();
    const iframe = new FakeIframe();
    const cleanup = teardownLegacyWasmIframe(iframe, "gravvity", {
      messageHost: host,
      origin
    });

    expect(iframe.contentWindow.postMessage).toHaveBeenCalledWith(
      { source: "playground-board", gameKey: "gravvity", type: "teardown" },
      origin
    );
    host.emit({
      origin,
      source: iframe.contentWindow as unknown as MessageEventSource,
      data: { source: "playground-legacy-game", gameKey: "gravvity", type: "teardown-complete" }
    });
    await Promise.resolve();
    expect(iframe.src).toBe("about:blank");
    iframe.emitLoad();

    await expect(cleanup).resolves.toEqual({
      acknowledgment: "acknowledged",
      fallback: "blank-loaded"
    });
  });

  it("continues to blanking when the acknowledgement is missing", async () => {
    const host = new FakeMessageHost();
    const iframe = new FakeIframe();
    const cleanup = teardownLegacyWasmIframe(iframe, "gravvity", {
      messageHost: host,
      origin,
      acknowledgmentTimeoutMs: 20
    });

    await vi.advanceTimersByTimeAsync(20);
    iframe.emitLoad();
    await expect(cleanup).resolves.toEqual({
      acknowledgment: "timed-out",
      fallback: "blank-loaded"
    });
  });

  it("bounds the wait for about:blank to load", async () => {
    const host = new FakeMessageHost();
    const iframe = new FakeIframe();
    const cleanup = teardownLegacyWasmIframe(iframe, "gravvity", {
      messageHost: host,
      origin,
      blankTimeoutMs: 30
    });
    host.emit({
      origin,
      source: iframe.contentWindow as unknown as MessageEventSource,
      data: { source: "playground-legacy-game", gameKey: "gravvity", type: "teardown-complete" }
    });

    await vi.advanceTimersByTimeAsync(30);
    await expect(cleanup).resolves.toEqual({
      acknowledgment: "acknowledged",
      fallback: "blank-timed-out"
    });
  });

  it("ignores unrelated window messages", async () => {
    const host = new FakeMessageHost();
    const iframe = new FakeIframe();
    const cleanup = teardownLegacyWasmIframe(iframe, "gravvity", {
      messageHost: host,
      origin,
      acknowledgmentTimeoutMs: 20
    });
    host.emit({
      origin,
      source: iframe.contentWindow as unknown as MessageEventSource,
      data: { source: "playground-legacy-game", gameKey: "ball2box", type: "teardown-complete" }
    });

    await vi.advanceTimersByTimeAsync(20);
    iframe.emitLoad();
    await expect(cleanup).resolves.toMatchObject({ acknowledgment: "timed-out" });
  });

  it("does nothing when no iframe is present", async () => {
    await expect(teardownLegacyWasmIframe(null, "gravvity", { messageHost: new FakeMessageHost(), origin }))
      .resolves.toEqual({ acknowledgment: "not-requested", fallback: "not-needed" });
  });

  it("allows only the first Home action to start", () => {
    const guard = createLegacyWasmExitGuard();
    expect(guard.tryStart()).toBe(true);
    expect(guard.tryStart()).toBe(false);
  });
});
