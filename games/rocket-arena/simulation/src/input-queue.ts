import { normalizeInputCommandV2 } from '@rocket-arena/shared';
import type { InputCommandV2 } from '@rocket-arena/shared';
import type { SequencedInput } from './protocol.js';

/** Server ticks, never client timestamps, determine how far a car can move. */
export class PredictionInputQueue {
  private pending: SequencedInput[] = [];
  private highestSequence = 0;
  private edgeFloor = { jumpSequence: 0, cameraToggleSequence: 0 };
  acknowledgedSequence = 0;
  inputAppliedTick = 0;
  lastReceivedAt = 0;

  /** Pause drops queued controls while preserving transport sequence/ack floors. */
  clearPending(): void { this.pending = []; this.lastReceivedAt = 0; }

  enqueue(value: unknown, nowMs: number, replacePending = false): boolean {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<SequencedInput>;
    if (!Number.isSafeInteger(candidate.sequence) || candidate.sequence! <= this.highestSequence
      || candidate.sequence! > this.highestSequence + 10_000) return false;
    let command: Readonly<InputCommandV2>;
    try {
      command = normalizeInputCommandV2(candidate.command, this.edgeFloor);
    } catch { return false; }
    if (replacePending) this.pending = [];
    this.pending.push({ sequence: candidate.sequence!, command });
    // Keep current controls even when transport delivers a large batch. Rejecting
    // the newest command when full would leave stale controls at the queue head.
    if (this.pending.length > 4) this.pending.shift();
    this.highestSequence = candidate.sequence!;
    this.edgeFloor = command;
    this.lastReceivedAt = nowMs;
    return true;
  }

  consume(tick = 0): SequencedInput | null {
    // Catch up after a network batch; never run extra physics steps for extra inputs.
    if (this.pending.length > 2) this.pending.splice(0, this.pending.length - 2);
    const next = this.pending.shift() ?? null;
    if (next) {
      this.acknowledgedSequence = next.sequence;
      this.inputAppliedTick = tick;
    }
    return next;
  }
}
