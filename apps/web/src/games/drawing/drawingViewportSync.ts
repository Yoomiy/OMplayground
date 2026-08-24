import type { DrawingViewport } from "./drawingMode";

export const VIEWPORT_PUBLISH_INTERVAL_MS = 33;
export const VIEWPORT_HEARTBEAT_INTERVAL_MS = 2_000;

export function drawingViewportFromAppState(appState: {
  scrollX?: unknown;
  scrollY?: unknown;
  zoom?: unknown;
}): DrawingViewport | null {
  const zoom = typeof appState.zoom === "number"
    ? appState.zoom
    : (appState.zoom as { value?: unknown } | null)?.value;
  if (!Number.isFinite(appState.scrollX) || !Number.isFinite(appState.scrollY) || !Number.isFinite(zoom)) {
    return null;
  }
  return {
    scrollX: Number(appState.scrollX),
    scrollY: Number(appState.scrollY),
    zoom: Number(zoom)
  };
}

export function sameDrawingViewport(
  left: DrawingViewport | null | undefined,
  right: DrawingViewport | null | undefined
): boolean {
  return Boolean(
    left && right &&
    left.scrollX === right.scrollX &&
    left.scrollY === right.scrollY &&
    left.zoom === right.zoom
  );
}

/** Coalesces active movement while retaining an explicit trailing update. */
export class DrawingViewportPublisher {
  private pending: DrawingViewport | null = null;
  private lastSent: DrawingViewport | null = null;
  private lastSentAt = Number.NEGATIVE_INFINITY;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly send: (viewport: DrawingViewport) => void,
    private readonly intervalMs = VIEWPORT_PUBLISH_INTERVAL_MS
  ) {}

  update(viewport: DrawingViewport): void {
    this.pending = viewport;
    const wait = Math.max(0, this.intervalMs - (Date.now() - this.lastSentAt));
    if (wait === 0) {
      this.flush(false);
      return;
    }
    if (this.timer === null) {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.flush(false);
      }, wait);
    }
  }

  heartbeat(viewport: DrawingViewport): void {
    this.pending = viewport;
    this.flush(true);
  }

  dispose(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
  }

  private flush(force: boolean): void {
    const viewport = this.pending;
    this.pending = null;
    if (!viewport || (!force && sameDrawingViewport(this.lastSent, viewport))) return;
    this.lastSent = viewport;
    this.lastSentAt = Date.now();
    this.send(viewport);
  }
}
