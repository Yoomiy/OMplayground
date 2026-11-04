export type TimingSummary = Readonly<{
  samples: number;
  meanMs: number;
  p95UpperMs: number;
  p99UpperMs: number;
  maxMs: number;
}>;

/** Fixed storage per room. Quantiles are upper bounds with 0.05 ms buckets through
 * 200 ms; overflow quantiles use the observed maximum. Empty windows have samples=0.
 * No actor data or individual timing samples are retained.
 */
export class TimingHistogram {
  private readonly buckets = new Float64Array(4002);
  private samples = 0;
  private mean = 0;
  private maximum = 0;

  record(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) return;
    let bucket = Math.min(4001, Math.ceil(ms * 20));
    // Multiplication can round onto an integer immediately above a boundary.
    if (bucket < 4001 && bucket / 20 < ms) bucket++;
    this.buckets[bucket]++;
    this.samples++;
    this.mean += (ms - this.mean) / this.samples;
    this.maximum = Math.max(this.maximum, ms);
  }

  take(): TimingSummary {
    const quantile = (fraction: number) => {
      if (!this.samples) return 0;
      const rank = Math.ceil(this.samples * fraction);
      let count = 0;
      for (let i = 0; i < this.buckets.length; i++) {
        count += this.buckets[i];
        if (count >= rank) return i === 4001 ? this.maximum : Math.min(this.maximum, i / 20);
      }
      return this.maximum;
    };
    const summary = {
      samples: this.samples,
      meanMs: this.mean,
      p95UpperMs: quantile(0.95),
      p99UpperMs: quantile(0.99),
      maxMs: this.maximum,
    };
    this.buckets.fill(0);
    this.samples = this.mean = this.maximum = 0;
    return summary;
  }
}
