/** Packet timestamps steer a continuous clock; they never directly move the scene. */
export class NetworkTimeline {
  private monoMs: number
  private timeSec: number
  private offsetSec: number

  constructor(timeSec: number, nowMs: number) {
    this.monoMs = nowMs
    this.timeSec = timeSec
    this.offsetSec = timeSec - nowMs / 1000
  }

  sync(timeSec: number, nowMs: number): void {
    this.read(nowMs)
    const sample = timeSec - nowMs / 1000
    this.offsetSec += (sample - this.offsetSec) * 0.1
  }

  read(nowMs: number): number {
    const elapsed = Math.max(0, (nowMs - this.monoMs) / 1000)
    const predicted = this.timeSec + elapsed
    const error = nowMs / 1000 + this.offsetSec - predicted
    // At most 10% speed adjustment, in either direction. Even a delayed batch
    // cannot reverse a sweeper or teleport a moving platform between draws.
    const correction = Math.max(-elapsed * 0.1, Math.min(elapsed * 0.1, error))
    this.timeSec = predicted + correction
    this.monoMs = Math.max(this.monoMs, nowMs)
    return this.timeSec
  }
}
