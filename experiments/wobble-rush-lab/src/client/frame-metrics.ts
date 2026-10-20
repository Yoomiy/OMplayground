/** Bounded local inspection, never uploaded or logged. Menus/background gaps are excluded. */
export class FrameMetrics {
  private readonly intervals = new Float64Array(600)
  private cursor = 0
  private count = 0
  private last = 0
  private rendered = 0
  private skipped = 0
  record(now: number, drawing: boolean): void {
    if (!drawing) {
      this.last = 0
      this.skipped++
      return
    }
    this.rendered++
    if (this.last > 0 && now > this.last) {
      this.intervals[this.cursor] = now - this.last
      this.cursor = (this.cursor + 1) % this.intervals.length
      this.count = Math.min(this.count + 1, this.intervals.length)
    }
    this.last = now
  }
  snapshot() {
    const values = [...this.intervals.subarray(0, this.count)].sort((a, b) => a - b)
    const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
    return {
      renderedFrames: this.rendered,
      skippedDraws: this.skipped,
      samples: values.length,
      meanMs: mean,
      fps: mean ? 1000 / mean : null,
      p50Ms: values[Math.floor(values.length * 0.5)] ?? null,
      p95Ms: values[Math.floor(values.length * 0.95)] ?? null,
      p99Ms: values[Math.floor(values.length * 0.99)] ?? null,
      over33Ms: values.filter((value) => value > 33.34).length,
      over50Ms: values.filter((value) => value > 50).length,
    }
  }
}
