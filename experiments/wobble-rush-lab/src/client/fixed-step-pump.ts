import { FIXED_STEP_SEC, MAX_STEPS_PER_FRAME } from "../shared/constants"

/** A bounded fixed-rate simulation pump, independent of GPU animation callbacks. */
export class FixedStepPump {
  private accumulated = 0
  constructor(private readonly step: (dt: number, lagSec: number) => void) {}

  advance(elapsedSec: number): void {
    this.accumulated += Math.max(0, Math.min(0.25, elapsedSec))
    let steps = 0
    while (this.accumulated >= FIXED_STEP_SEC && steps < MAX_STEPS_PER_FRAME) {
      this.accumulated -= FIXED_STEP_SEC
      this.step(FIXED_STEP_SEC, this.accumulated)
      steps++
    }
    if (steps === MAX_STEPS_PER_FRAME) this.accumulated = 0
  }
}
