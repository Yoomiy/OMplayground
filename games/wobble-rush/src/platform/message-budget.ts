/** Connection-local token bucket: tolerate clumping without allowing sustained floods. */
export const MESSAGE_RATE_PER_SEC = 120
// Covers the client's two-second prediction backlog plus new controls/heartbeats.
export const MESSAGE_BURST_CAPACITY = 240

export class MessageBudget {
  private tokens = MESSAGE_BURST_CAPACITY
  private lastMs: number

  constructor(nowMs: number) {
    this.lastMs = nowMs
  }

  consume(nowMs: number): boolean {
    const monoMs = Math.max(this.lastMs, nowMs)
    this.tokens = Math.min(
      MESSAGE_BURST_CAPACITY,
      this.tokens + ((monoMs - this.lastMs) * MESSAGE_RATE_PER_SEC) / 1000,
    )
    this.lastMs = monoMs
    if (this.tokens < 1 - 1e-9) return false
    this.tokens = Math.max(0, this.tokens - 1)
    return true
  }
}
