import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DrawingViewportPublisher,
  drawingViewportFromAppState,
  sameDrawingViewport
} from "./drawingViewportSync";

describe("drawing viewport synchronization", () => {
  afterEach(() => vi.useRealTimers());

  it("normalizes Excalidraw zoom and rejects invalid app state", () => {
    expect(drawingViewportFromAppState({ scrollX: 1, scrollY: 2, zoom: { value: 1.25 } })).toEqual({
      scrollX: 1,
      scrollY: 2,
      zoom: 1.25
    });
    expect(drawingViewportFromAppState({ scrollX: 1, scrollY: Number.NaN, zoom: 1 })).toBeNull();
  });

  it("coalesces movement and preserves the trailing viewport", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const sent: unknown[] = [];
    const publisher = new DrawingViewportPublisher((viewport) => sent.push(viewport));

    publisher.update({ scrollX: 1, scrollY: 1, zoom: 1 });
    publisher.update({ scrollX: 2, scrollY: 2, zoom: 1 });
    publisher.update({ scrollX: 3, scrollY: 3, zoom: 1 });
    expect(sent).toEqual([{ scrollX: 1, scrollY: 1, zoom: 1 }]);

    vi.advanceTimersByTime(33);
    expect(sent).toEqual([
      { scrollX: 1, scrollY: 1, zoom: 1 },
      { scrollX: 3, scrollY: 3, zoom: 1 }
    ]);
  });

  it("resends an identical viewport for a heartbeat", () => {
    vi.useFakeTimers();
    vi.setSystemTime(2_000);
    const sent: unknown[] = [];
    const viewport = { scrollX: 4, scrollY: 5, zoom: 2 };
    const publisher = new DrawingViewportPublisher((next) => sent.push(next));

    publisher.update(viewport);
    publisher.update(viewport);
    vi.advanceTimersByTime(33);
    expect(sent).toHaveLength(1);
    publisher.heartbeat(viewport);
    expect(sent).toHaveLength(2);
    expect(sameDrawingViewport(sent[0] as typeof viewport, sent[1] as typeof viewport)).toBe(true);
  });
});
