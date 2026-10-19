import type RAPIER from '@dimforge/rapier3d-compat';
import { DEFAULT_TUNING_REGISTRY_SNAPSHOT, RESOLVED_ARENA_GEOMETRY, PHYSICS,
  resolveBoostPadDescriptors, type InputCommandV2 } from '@rocket-arena/shared';
import { createArenaColliders } from './arena.js';
import { createBall, recoverBallBeforeStep, recoverBallAfterStep } from './ball.js';
import { createCarBody, recoverCarBodyBeforeStep, recoverCarBodyAfterStep } from './car-body.js';
import { groundRuntimeCar, prepareRuntimeCarCommand, restoreBody, captureBody, captureRuntime, type RuntimeCar } from './car-runtime.js';
import { createWorld } from './world.js';
import { createBoostPadStates, stepBoostPads, type BoostPadState } from './boost-pads.js';
import type { PredictionFrame, BodyState } from './protocol.js';

/** A disposable prediction world. Results are presentation only, never scores. */
export class PredictionWorld {
  readonly world = createWorld();
  private readonly arena = createArenaColliders(this.world, RESOLVED_ARENA_GEOMETRY);
  private readonly ball = createBall(this.world);
  private readonly cars = new Map<string, RuntimeCar>();
  private readonly inputs = new Map<string, Readonly<InputCommandV2>>();
  private readonly appliedInputs = new Map<string, { acknowledgedSequence: number; inputAppliedTick?: number }>();
  private readonly padDescriptors = resolveBoostPadDescriptors();
  private pads: readonly BoostPadState[] = createBoostPadStates(this.padDescriptors);
  tick = 0;
  phase: PredictionFrame['phase'] = 'waiting';
  private kickoffEpoch = 0;

  restore(frame: PredictionFrame): void {
    this.tick = frame.tick;
    this.phase = frame.phase;
    this.kickoffEpoch = frame.kickoffEpoch;
    const represented = new Set(frame.cars.map((car) => car.sessionId));
    for (const [id, car] of this.cars) {
      if (represented.has(id)) continue;
      this.world.removeRigidBody(car.body);
      this.cars.delete(id);
      this.inputs.delete(id);
      this.appliedInputs.delete(id);
    }
    for (const snapshot of frame.cars) {
      let car = this.cars.get(snapshot.sessionId);
      if (!car) {
        car = { ...snapshot, body: createCarBody(this.world, snapshot.position, snapshot.rotation) };
        this.cars.set(snapshot.sessionId, car);
      }
      Object.assign(car, {
        jumpAirState: { ...snapshot.jumpAirState }, boostAmount: snapshot.boostAmount,
        boostRechargeDelaySeconds: snapshot.boostRechargeDelaySeconds,
        boostRechargeArmed: snapshot.boostRechargeArmed, dodgeIntentSteps: snapshot.dodgeIntentSteps,
        wallDriveEngaged: snapshot.wallDriveEngaged,
      });
      restoreBody(car.body, snapshot);
      this.inputs.set(snapshot.sessionId, snapshot.input);
      this.appliedInputs.set(snapshot.sessionId, { acknowledgedSequence: snapshot.acknowledgedSequence,
        inputAppliedTick: snapshot.inputAppliedTick });
    }
    restoreBody(this.ball, frame.ball);
    const spent = new Map(frame.boostPadCooldowns.map((pad) => [pad.index, pad.secondsRemaining]));
    this.pads = this.padDescriptors.map((pad, index) => ({ id: pad.id,
      available: !spent.has(index), respawnSecondsRemaining: spent.get(index) ?? 0 }));
    this.world.propagateModifiedBodyPositionsToColliders();
    // Grounding queries only the fixed arena, which is indexed at construction.
    // Restoring dynamic cars/ball cannot change those hits. World.step refreshes
    // the query pipeline itself; avoid an extra rebuild for every reconciliation.
  }

  step(localId: string, command: Readonly<InputCommandV2>, sequence?: number): void {
    this.inputs.set(localId, command);
    if (sequence !== undefined) this.appliedInputs.set(localId, {
      acknowledgedSequence: sequence, inputAppliedTick: this.tick + 1 });
    if (this.phase !== 'playing' && this.phase !== 'overtime') { this.tick++; return; }
    recoverBallBeforeStep(this.ball);
    for (const car of this.cars.values()) recoverCarBodyBeforeStep(car.body);
    // Grounding uses ONLY_FIXED: repaired dynamic transforms need no query rebuild.
    const planned = [...this.cars].map(([id, car]) => prepareRuntimeCarCommand({
      car, input: id === localId ? command : this.inputs.get(id)!,
      grounding: groundRuntimeCar(this.world, car, this.arena.registry, DEFAULT_TUNING_REGISTRY_SNAPSHOT),
      fixedStepIndex: this.tick, fixedStepSeconds: PHYSICS.TIMESTEP,
      tuning: DEFAULT_TUNING_REGISTRY_SNAPSHOT,
    }));
    for (const plan of planned) plan.apply();
    this.world.step();
    for (const car of this.cars.values()) recoverCarBodyAfterStep(car.body);
    recoverBallAfterStep(this.ball);
    for (const plan of planned) plan.commit();
    const result = stepBoostPads(this.padDescriptors, this.pads,
      [...this.cars].map(([id, car]) => ({ id, position: car.body.translation(), boost: car.boostAmount })),
      PHYSICS.TIMESTEP, 100);
    this.pads = result.pads;
    for (const grant of result.grants) {
      const car = this.cars.get(grant.collectorId)!;
      car.boostAmount = Math.min(100, car.boostAmount + grant.boostAmount);
      car.boostRechargeDelaySeconds = 0;
      car.boostRechargeArmed = car.boostAmount < 100;
    }
    this.tick++;
  }

  getCar(id: string): BodyState | null {
    const car = this.cars.get(id);
    return car ? captureBody(car.body) : null;
  }
  getBall(): BodyState { return captureBody(this.ball); }
  /** Small body/runtime checkpoint, rather than a heavyweight WASM world snapshot. */
  capture(): PredictionFrame {
    return { version: 1, tick: this.tick, phase: this.phase, kickoffEpoch: this.kickoffEpoch,
      cars: [...this.cars].map(([sessionId, car]) => ({ sessionId, ...captureBody(car.body),
        ...captureRuntime(car), ...this.appliedInputs.get(sessionId)!, input: { ...this.inputs.get(sessionId)! } })),
      ball: captureBody(this.ball), boostPadCooldowns: this.pads.flatMap((pad, index) =>
        pad.available ? [] : [{ index, secondsRemaining: pad.respawnSecondsRemaining }]) };
  }
  dispose(): void { this.cars.clear(); this.arena.dispose(); this.world.free(); }
}
