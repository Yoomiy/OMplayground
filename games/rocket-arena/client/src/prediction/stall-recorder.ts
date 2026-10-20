import type { ClientStallIncident, ClientStallSample } from '@rocket-arena/shared';

/** At most two seconds at 10 Hz; no frame-by-frame allocations or positions. */
export class StallRecorder {
  private samples: ClientStallSample[] = [];
  private lastEventAt = new Map<ClientStallIncident['event'], number>();
  due(timeMs: number): boolean { return timeMs - (this.samples.at(-1)?.timeMs ?? -Infinity) >= 100; }
  sample(value: ClientStallSample): void {
    if (!this.due(value.timeMs)) return;
    this.samples.push(value);
    while (this.samples.length > 21 || this.samples[0]!.timeMs < value.timeMs - 2_000) this.samples.shift();
  }
  capture(event: ClientStallIncident['event'], current: ClientStallSample, targetGapMeters = 0): ClientStallIncident | null {
    if (current.timeMs - (this.lastEventAt.get(event) ?? -Infinity) < 2_000) return null;
    this.lastEventAt.set(event, current.timeMs);
    return { event, targetGapMeters, samples: [...this.samples.filter(sample => sample.timeMs < current.timeMs
      && sample.timeMs >= current.timeMs - 2_000).slice(-20), current] };
  }
  reset(): void { this.samples = []; this.lastEventAt.clear(); }
}
