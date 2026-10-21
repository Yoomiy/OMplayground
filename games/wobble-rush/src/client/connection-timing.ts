/** Match every pong to its own send time, including replies later than the next ping. */
export class ConnectionTiming {
  private readonly pending = new Map<number, number>()
  private readonly samples: number[] = []
  rttMs = 0

  sent(nonce: number, nowMs: number): void {
    this.pending.set(nonce, nowMs)
    for (const [key, sentMs] of this.pending) if (nowMs - sentMs > 10_000) this.pending.delete(key)
  }

  received(nonce: number, nowMs: number): void {
    const sentMs = this.pending.get(nonce)
    if (sentMs === undefined) return
    this.pending.delete(nonce)
    this.sample(nowMs - sentMs)
  }

  sample(rttMs: number): void {
    const sample = Math.max(0, Math.min(10_000, rttMs))
    this.samples.push(sample)
    if (this.samples.length > 12) this.samples.shift()
    // Retain jitter headroom for input scheduling. A single fast pong must not
    // convince the next race that an intermittently slow uplink is healthy.
    const sorted = [...this.samples].sort((a, b) => a - b)
    this.rttMs = sorted[Math.ceil(sorted.length * 0.9) - 1] ?? sample
  }
}
