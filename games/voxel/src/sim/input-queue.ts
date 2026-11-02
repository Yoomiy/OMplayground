import { HELD_INPUT_MS, INPUT_QUEUE_LIMIT, MOVEMENT_DT, isInputFrame } from '../shared/input.ts';
import type { InputFrame } from '../shared/input.ts';
export type InputReceipt = 'accepted' | 'invalid' | 'stale_epoch' | 'duplicate' | 'resync';
const PRIME = 0.04;
const CUSHION = 0.05;
/** Play numbered samples, never invented held/neutral steps. Ack and state share one timeline. */
export class InputQueue {
  private pending: InputFrame[] = [];
  private latestSequence = 0;
  private acknowledged = 0;
  private currentEpoch: number;
  private latestArrival = -Infinity;
  private bank = 0;
  private playing = false;
  constructor(epoch: number, _look?: { yaw: number; pitch: number }) {
    this.currentEpoch = epoch;
  }
  get received(): number {
    return this.latestSequence;
  }
  get epoch(): number {
    return this.currentEpoch;
  }
  get ack(): number {
    return this.acknowledged;
  }
  /** Whole samples can trail the room tick by this remainder (Blockyard's player lead). */
  get lead(): number {
    return this.bank;
  }
  get size(): number {
    return this.pending.length;
  }
  active(now: number): boolean {
    return now - this.latestArrival <= HELD_INPUT_MS;
  }
  receive(value: unknown, now: number): InputReceipt {
    if (!isInputFrame(value)) return 'invalid';
    if (value.epoch !== this.currentEpoch) return 'stale_epoch';
    if (value.sequence <= this.latestSequence) return 'duplicate';
    this.latestSequence = value.sequence;
    this.latestArrival = now;
    this.pending.push({ ...value });
    if (this.pending.length > INPUT_QUEUE_LIMIT) {
      const discarded = this.pending.splice(0, this.pending.length - INPUT_QUEUE_LIMIT);
      this.acknowledged = discarded.at(-1)!.sequence;
      return 'resync';
    }
    return 'accepted';
  }
  /** A small cushion absorbs arrival jitter; surplus drains 5% faster without dropping inputs.
   * A long transport stall uses Blockyard's queue-over-30 catch-up instead of resetting prediction.
   * Duration-less headless clients retain their explicit 60 Hz sample convention.
   */
  advance(dt: number, apply: (frame: InputFrame) => void): void {
    const queued = this.pending.reduce((sum, frame) => sum + (frame.dt ?? MOVEMENT_DT), 0);
    if (!this.playing) {
      if (queued + 1e-9 < PRIME) return;
      this.playing = true;
    }
    this.bank = Math.min(0.25, this.bank + dt * (queued > CUSHION + dt ? 1.05 : 1));
    let count = 0;
    while (this.pending.length && count++ < INPUT_QUEUE_LIMIT) {
      const frame = this.pending[0],
        duration = frame.dt ?? MOVEMENT_DT;
      // Blockyard catch-up: a long queue is played through, not retired/reset.
      if (duration > this.bank + 1e-9 && this.pending.length <= 30) break;
      this.pending.shift();
      this.bank = Math.max(0, this.bank - duration);
      // A movement outcome may invalidate the epoch (death/equipment). Never resurrect its ack.
      this.acknowledged = frame.sequence;
      const epoch = this.currentEpoch;
      apply(frame);
      if (this.currentEpoch !== epoch) break;
    }
    if (!this.pending.length) this.bank = Math.min(this.bank, dt * 0.5);
  }
  reset(epoch: number): void {
    if (!Number.isSafeInteger(epoch) || epoch <= this.currentEpoch)
      throw new Error('epoch must advance');
    this.currentEpoch = epoch;
    this.pending = [];
    this.latestSequence = this.acknowledged = 0;
    this.latestArrival = -Infinity;
    this.bank = 0;
    this.playing = false;
  }
}
