import { stepBoundedMovement, DEFAULT_MOVEMENT } from '../shared/movement.ts';
import type { MovementModifiers } from '../shared/movement.ts';
import type { WorldPort } from '../shared/engine-port.ts';
import type { InputFrame, Controls } from '../shared/input.ts';
export class Prediction {
  readonly world: WorldPort;
  readonly slot: number;
  private epoch = 0;
  private sequence = 0;
  private pending: InputFrame[] = [];
  private lastAck = 0;
  private modifiers: MovementModifiers = DEFAULT_MOVEMENT;
  correction = 0;
  constructor(world: WorldPort, slot: number) {
    this.world = world;
    this.slot = slot;
  }
  baseline(
    epoch: number,
    ack: number,
    state: number[],
    modifiers: MovementModifiers = DEFAULT_MOVEMENT,
  ): void {
    this.modifiers = modifiers;
    this.epoch = epoch;
    this.sequence = ack;
    this.lastAck = ack;
    this.pending = [];
    this.world.player_restore(this.slot, new Float64Array(state));
  }
  sample(controls: Controls): InputFrame | null {
    if (this.pending.length >= 120) return null;
    const frame: InputFrame = { ...controls, epoch: this.epoch, sequence: ++this.sequence };
    this.pending.push(frame);
    stepBoundedMovement(this.world, this.slot, frame, this.modifiers);
    return frame;
  }
  reconcile(epoch: number, ack: number, state: number[]): boolean {
    if (epoch !== this.epoch) {
      if (epoch > this.epoch) this.baseline(epoch, ack, state, this.modifiers);
      return false;
    }
    if (ack < this.lastAck) return false;
    this.lastAck = ack;
    this.sequence = Math.max(this.sequence, ack);
    const previous = this.world.player_state(this.slot);
    this.pending = this.pending.filter((f) => f.sequence > ack);
    this.world.player_restore(this.slot, new Float64Array(state));
    for (const frame of this.pending)
      stepBoundedMovement(this.world, this.slot, frame, this.modifiers);
    const current = this.world.player_state(this.slot);
    this.correction = Math.hypot(
      current[0] - previous[0],
      current[1] - previous[1],
      current[2] - previous[2],
    );
    return true;
  }
  get inputLag(): number {
    return this.pending.length;
  }
  get currentSequence(): number {
    return this.sequence;
  }
  get currentEpoch(): number {
    return this.epoch;
  }
}
