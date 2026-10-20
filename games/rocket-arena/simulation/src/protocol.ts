import type { InputCommandV2, MatchPhase, BoostPadCooldownSnapshot } from '@rocket-arena/shared';
import type { CarJumpAirState } from './car-controller.js';

export interface BodyState {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  velocity: { x: number; y: number; z: number };
  angularVelocity: { x: number; y: number; z: number };
}

export interface CarRuntimeSnapshot {
  jumpAirState: Readonly<CarJumpAirState>;
  boostAmount: number;
  boostRechargeDelaySeconds: number;
  boostRechargeArmed: boolean;
  dodgeIntentSteps: number;
  wallDriveEngaged: boolean;
}

export interface PredictionCar extends BodyState, CarRuntimeSnapshot {
  sessionId: string;
  acknowledgedSequence: number;
  /** Authoritative post-step tick where this command was first applied. */
  inputAppliedTick?: number;
  input: Readonly<InputCommandV2>;
}

export interface PredictionFrame {
  /** Observation only; never part of physics/history comparisons. Peaks/sum
   * since the previous snapshot, measured on the server's own clock. */
  serverTiming?: { callbackGapMs: number; workMs: number; droppedMs: number };
  version: 1;
  tick: number;
  kickoffEpoch: number;
  phase: MatchPhase;
  cars: PredictionCar[];
  ball: BodyState;
  boostPadCooldowns: readonly Readonly<BoostPadCooldownSnapshot>[];
}

export interface SequencedInput {
  sequence: number;
  command: Readonly<InputCommandV2>;
}
