import { stepBoundedMovement, DEFAULT_MOVEMENT } from '../shared/movement.ts';
import type { MovementModifiers } from '../shared/movement.ts';
import type { WorldPort } from '../shared/engine-port.ts';
import { MOVEMENT_DT, MAX_INPUT_DT } from '../shared/input.ts';
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
  reconciliations = 0;
  readonly recentCorrections: { sample: number; distance: number }[] = [];
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
    // A resync can acknowledge less than the server has already received.
    // Retire prediction without reusing those immutable input identities.
    this.sequence = epoch === this.epoch ? Math.max(this.sequence, ack) : ack;
    this.epoch = epoch;
    this.lastAck = ack;
    this.pending = [];
    this.world.player_restore(this.slot, new Float64Array(state));
  }
  sample(controls: Controls, dt = MOVEMENT_DT): InputFrame | null {
    if (!Number.isFinite(dt) || dt <= 0 || dt > MAX_INPUT_DT) return null;
    if (this.inputSeconds >= 2) return null;
    const frame: InputFrame = { ...controls, dt, epoch: this.epoch, sequence: ++this.sequence };
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
    this.recentCorrections.push({ sample: ++this.reconciliations, distance: this.correction });
    if (this.recentCorrections.length > 128) this.recentCorrections.shift();
    return true;
  }
  get currentAck(): number {
    return this.lastAck;
  }
  get inputSeconds(): number {
    return this.pending.reduce((sum, frame) => sum + (frame.dt ?? MOVEMENT_DT), 0);
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
