/**
 * Animation-frame rendering, independent of the fixed-rate input/simulation pump.
 * Clamp long frame gaps and stale initial compositor timestamps.
 */

const MAX_FRAME_SEC = 0.25

export class FrameLoop {
  private readonly draw: (dt: number, nowMs: number) => void
  private lastMs = 0
  private handle = 0

  constructor(
    draw: (dt: number, nowMs: number) => void,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.draw = draw
  }

  start(): void {
    this.lastMs = this.now()
    const frame = (nowMs: number): void => {
      this.handle = globalThis.requestAnimationFrame(frame)
      // A first RAF timestamp can predate start() after a slow synchronous boot.
      // Negative time would put the physics accumulator in debt for seconds.
      const elapsed = Math.max(0, Math.min(MAX_FRAME_SEC, (nowMs - this.lastMs) / 1000))
      this.lastMs = nowMs
      this.draw(elapsed, nowMs)
    }
    this.handle = globalThis.requestAnimationFrame(frame)
  }

  stop(): void {
    globalThis.cancelAnimationFrame(this.handle)
  }
}
