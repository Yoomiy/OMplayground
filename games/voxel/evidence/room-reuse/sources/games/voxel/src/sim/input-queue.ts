import {
  HELD_INPUT_MS,
  INPUT_MAX_AGE_MS,
  INPUT_QUEUE_LIMIT,
  isInputFrame,
  NEUTRAL,
} from '../shared/input.ts';
import type { Controls, InputFrame } from '../shared/input.ts';
export type InputReceipt = 'accepted' | 'invalid' | 'stale_epoch' | 'duplicate' | 'resync';
type Pending = { frame: InputFrame; arrivedAt: number };
/** Socket callbacks only enqueue. Only a scheduled simulation substep may consume controls. */
export class InputQueue {
  private pending: Pending[] = [];
  private latestSequence = 0;
  private held: Pending | undefined;
  private acknowledged = 0;
  private currentEpoch: number;
  private latestArrival = -Infinity;
  private look: Pick<Controls, 'yaw' | 'pitch'>;
  constructor(epoch: number, look: Pick<Controls, 'yaw' | 'pitch'> = NEUTRAL) {
    this.currentEpoch = epoch;
    this.look = { yaw: look.yaw, pitch: look.pitch };
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
    // Copy transport input so subsequent caller mutation cannot change queued authority.
    this.pending.push({ frame: { ...value }, arrivedAt: now });
    if (this.pending.length > INPUT_QUEUE_LIMIT) {
      const discarded = this.pending.splice(0, this.pending.length - INPUT_QUEUE_LIMIT);
      this.acknowledged = Math.max(this.acknowledged, discarded.at(-1)!.frame.sequence);
      return 'resync';
    }
    return 'accepted';
  }
  take(now: number): { controls: Controls; resync: boolean } {
    let resync = false;
    while (this.pending[0] && now - this.pending[0].arrivedAt > INPUT_MAX_AGE_MS) {
      this.acknowledged = Math.max(this.acknowledged, this.pending.shift()!.frame.sequence);
      resync = true;
    }
    const next = this.pending.shift();
    if (next) {
      this.held = next;
      this.look = { yaw: next.frame.yaw, pitch: next.frame.pitch };
      this.acknowledged = next.frame.sequence;
      return { controls: next.frame, resync };
    }
    const held = this.held;
    // jump is a transient press; held movement expires even if no socket close arrives.
    if (held && now - held.arrivedAt <= HELD_INPUT_MS) {
      return { controls: { ...held.frame, jump: false }, resync };
    }
    return {
      controls: { ...NEUTRAL, ...this.look },
      resync,
    };
  }
  reset(epoch: number): void {
    if (!Number.isSafeInteger(epoch) || epoch <= this.currentEpoch)
      throw new Error('epoch must advance');
    this.currentEpoch = epoch;
    this.pending = [];
    this.held = undefined;
    this.latestSequence = 0;
    this.acknowledged = 0;
    this.latestArrival = -Infinity;
  }
}
