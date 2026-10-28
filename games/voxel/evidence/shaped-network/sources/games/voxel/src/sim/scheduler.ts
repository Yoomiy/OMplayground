import { WORLD_HZ } from '../shared/input.ts';
const TICK_MS = 1000 / WORLD_HZ;
export const MAX_CATCHUP_STEPS = 4;
/** Feed a monotonic clock. A room tick always performs exactly two player movement substeps. */
export class FixedScheduler {
  private previous: number;
  private remainder = 0;
  constructor(now: number) {
    this.previous = now;
  }
  advance(now: number, tick: () => void): { steps: number; droppedMs: number } {
    if (!Number.isFinite(now) || now < this.previous) throw new Error('clock must be monotonic');
    this.remainder += now - this.previous;
    this.previous = now;
    const due = Math.floor((this.remainder + 1e-7) / TICK_MS);
    const steps = Math.min(due, MAX_CATCHUP_STEPS);
    const droppedMs = Math.max(0, due - steps) * TICK_MS;
    this.remainder = Math.max(0, this.remainder - due * TICK_MS);
    for (let i = 0; i < steps; i++) tick();
    return { steps, droppedMs };
  }
  reset(now: number): void {
    this.previous = now;
    this.remainder = 0;
  }
}
