/**
 * Fixed-timestep loop with a capped substep budget.
 *
 * Simulation always advances in whole `FIXED_STEP_SEC` slices so jump arcs and
 * obstacle timing are identical on every machine; rendering happens once per frame.
 * When a frame stalls, the step budget caps the catch-up instead of spiralling.
 */

import { FixedStepPump } from "./fixed-step-pump"

const MAX_FRAME_SEC = 0.25

export class FrameLoop {
  private readonly draw: (dt: number, nowMs: number) => void
  private readonly pump: FixedStepPump
  private lastMs = 0
  private handle = 0

  constructor(
    step: (dt: number, lagSec: number) => void,
    draw: (dt: number, nowMs: number) => void,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.pump = new FixedStepPump(step)
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
      this.pump.advance(elapsed)

      this.draw(elapsed, nowMs)
    }
    this.handle = globalThis.requestAnimationFrame(frame)
  }

  stop(): void {
    globalThis.cancelAnimationFrame(this.handle)
  }
}
