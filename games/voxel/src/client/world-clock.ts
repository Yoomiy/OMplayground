import { WORLD_HZ } from '../shared/input.ts';
/** Presentation follows room ticks; it can coast only 250 ms without a newer snapshot. */
export class WorldClock {
  private tick = 0;
  private received = 0;
  private shown = 0;
  private running = true;
  reset(tick: number, now: number, running = true): void {
    this.tick = this.shown = tick;
    this.received = now;
    this.running = running;
  }
  observe(tick: number, now: number): boolean {
    if (tick <= this.tick) return false;
    this.tick = tick;
    this.received = now;
    return true;
  }
  read(now: number): number {
    if (!this.running) return this.tick;
    const coast = Math.min(250, Math.max(0, now - this.received));
    this.shown = Math.max(this.shown, this.tick + (coast * WORLD_HZ) / 1000);
    return this.shown;
  }
}
