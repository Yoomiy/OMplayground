export type ActionOutcome<T> =
  | { status: 'applied' | 'cached'; value: T }
  | { status: 'stale_epoch' | 'retired' | 'invalid' };
/** Result eviction never retires the independent ordered rejection boundary. */
export class ActionLedger<T> {
  private currentEpoch: number;
  private highWater = 0;
  private results = new Map<number, T>();
  private capacity: number;
  constructor(epoch: number, capacity = 128) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) throw new Error('invalid cache capacity');
    this.currentEpoch = epoch;
    this.capacity = capacity;
  }
  get boundary(): number {
    return this.highWater;
  }
  run(epoch: number, sequence: number, apply: () => T): ActionOutcome<T> {
    if (epoch !== this.currentEpoch) return { status: 'stale_epoch' };
    if (!Number.isSafeInteger(sequence) || sequence <= 0) return { status: 'invalid' };
    if (this.results.has(sequence)) return { status: 'cached', value: this.results.get(sequence)! };
    if (sequence <= this.highWater) return { status: 'retired' };
    this.highWater = sequence;
    const value = apply();
    this.results.set(sequence, value);
    if (this.results.size > this.capacity) this.results.delete(this.results.keys().next().value!);
    return { status: 'applied', value };
  }
  reset(epoch: number): void {
    if (!Number.isSafeInteger(epoch) || epoch <= this.currentEpoch)
      throw new Error('epoch must advance');
    this.currentEpoch = epoch;
    this.highWater = 0;
    this.results.clear();
  }
}
