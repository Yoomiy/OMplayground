import type RAPIER from '@dimforge/rapier3d-compat';
import type { InputCommandV2, TuningRegistrySnapshot } from '@rocket-arena/shared';
import { getConstant } from '@rocket-arena/shared/constants';
import { planCarControllerCommand } from './car-controller.js';
import { detectGroundSupport, probeRideHeight, type ArenaSurfaceRegistry } from './grounding.js';
import type { BodyState, CarRuntimeSnapshot } from './protocol.js';

export interface RuntimeCar extends CarRuntimeSnapshot { readonly body: RAPIER.RigidBody }
export type SimulationTuning = Pick<TuningRegistrySnapshot, 'get'>;
const DODGE_INTENT_MIN_STEPS = 3;
const DODGE_DIRECTIONAL_THRESHOLD = 0.7;
function resolveDriveableSlopeDegrees(car: RuntimeCar): number {
  const velocity = car.body.linvel();
  const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
  if (!Number.isFinite(speed)) {
    car.wallDriveEngaged = false;
    return getConstant('CAR.WALL_DRIVE.GROUNDED_SLOPE_DEGREES');
  }

  if (car.wallDriveEngaged) {
    if (speed < getConstant('CAR.WALL_DRIVE.RELEASE_SPEED')) car.wallDriveEngaged = false;
  } else if (speed >= getConstant('CAR.WALL_DRIVE.ENGAGE_SPEED')) {
    car.wallDriveEngaged = true;
  }

  return car.wallDriveEngaged
    ? getConstant('CAR.WALL_DRIVE.MAXIMUM_SLOPE_DEGREES')
    : getConstant('CAR.WALL_DRIVE.GROUNDED_SLOPE_DEGREES');
}

export function groundRuntimeCar(
  authoritativeWorld: RAPIER.World, car: RuntimeCar,
  surfaces: ArenaSurfaceRegistry, roomTuning: SimulationTuning,
) {
  const maximumDriveableSlopeDegrees = resolveDriveableSlopeDegrees(car);
  const result = detectGroundSupport(
    authoritativeWorld,
    car.body,
    surfaces,
    {
      tuning: roomTuning,
      maximumDriveableSlopeDegrees,
    },
  );
  // Measured separately from the support rays because those start at the
  // support points and cannot report how deep a sunk chassis has gone.
  const rideHeight = result.grounded
    ? probeRideHeight(authoritativeWorld, car.body, surfaces, {
      tuning: roomTuning,
      maximumDriveableSlopeDegrees,
    })
    : null;
  return Object.freeze({
    grounded: result.grounded,
    basis: result.basis,
    recoveryBasis: result.recoveryBasis,
    rideHeight: rideHeight === null
      ? null
      : Object.freeze({ gap: rideHeight.gap, normal: rideHeight.normal }),
  });

}
export function prepareRuntimeCarCommand({ car, input, grounding, fixedStepIndex,
  fixedStepSeconds, tuning: roomTuning }: {
  car: RuntimeCar; input: Readonly<InputCommandV2>;
  grounding: Omit<ReturnType<typeof groundRuntimeCar>, 'recoveryBasis' | 'rideHeight'>
    & Partial<Pick<ReturnType<typeof groundRuntimeCar>, 'recoveryBasis' | 'rideHeight'>>;
  fixedStepIndex: number; fixedStepSeconds: number; tuning: SimulationTuning;
}) {
  const rotation = car.body.rotation();
  const linearVelocity = car.body.linvel();
  const angularVelocity = car.body.angvel();
  const directionalMagnitude = Math.hypot(input.pitch, input.roll);
  const nextDodgeIntentSteps = directionalMagnitude >= DODGE_DIRECTIONAL_THRESHOLD
    ? Math.min(car.dodgeIntentSteps + 1, DODGE_INTENT_MIN_STEPS)
    : 0;
  const pendingJumpEdge = Number.isSafeInteger(input.jumpSequence)
    && input.jumpSequence > car.jumpAirState.lastConsumedJumpSequence;
  const controllerInput = pendingJumpEdge
    && nextDodgeIntentSteps < DODGE_INTENT_MIN_STEPS
    ? Object.freeze({ ...input, pitch: 0, roll: 0 })
    : input;
  const plan = planCarControllerCommand(controllerInput, {
    observation: {
      rotation,
      linearVelocity,
      angularVelocity,
      grounded: grounding.grounded,
      surfaceBasis: grounding.basis,
    },
    previousFiniteState: { rotation, linearVelocity, angularVelocity },
    availableBoost: car.boostAmount,
    tuning: roomTuning,
    timestepSeconds: fixedStepSeconds,
    uprightRecoveryEnabled: true,
    uprightRecoveryBasis: grounding.recoveryBasis ?? grounding.basis,
    rideHeight: grounding.rideHeight ?? null,
    jumpAir: {
      state: car.jumpAirState,
      fixedStepIndex,
    },
  });
  const nextJumpAirState = plan.nextJumpAirState ?? car.jumpAirState;
  let applied = false;
  let committed = false;

  return Object.freeze({
    apply: () => {
      if (applied) throw new Error('A prepared car command can be applied only once.');
      car.body.setLinvel(plan.projectedVelocity, true);
      car.body.setAngvel(plan.projectedAngularVelocity, true);
      applied = true;
    },
    commit: () => {
      if (!applied || committed) {
        throw new Error('A prepared car command must be applied once before one commit.');
      }
      car.jumpAirState = nextJumpAirState;
      car.dodgeIntentSteps = nextDodgeIntentSteps;
      if (input.boostHeld) {
        car.boostAmount -= plan.boostConsumed;
        car.boostRechargeDelaySeconds = getConstant('CAR.BOOST.RECHARGE_DELAY');
        car.boostRechargeArmed = true;
      } else if (car.boostRechargeArmed) {
        car.boostRechargeDelaySeconds = Math.max(
          0,
          car.boostRechargeDelaySeconds - fixedStepSeconds,
        );
        if (car.boostRechargeDelaySeconds === 0) {
          car.boostAmount += getConstant('CAR.BOOST.RECHARGE_RATE') * fixedStepSeconds;
          if (car.boostAmount >= getConstant('CAR.BOOST.MAX_AMOUNT')) {
            car.boostRechargeArmed = false;
          }
        }
      }
      committed = true;
    },
  });

}

export function captureBody(body: RAPIER.RigidBody): BodyState {
  return { position: { ...body.translation() }, rotation: { ...body.rotation() },
    velocity: { ...body.linvel() }, angularVelocity: { ...body.angvel() } };
}
export function restoreBody(body: RAPIER.RigidBody, state: BodyState): void {
  body.setTranslation(state.position, true);
  body.setRotation(state.rotation, true);
  body.setLinvel(state.velocity, true);
  body.setAngvel(state.angularVelocity, true);
}
export function captureRuntime(car: RuntimeCar): CarRuntimeSnapshot {
  return { jumpAirState: { ...car.jumpAirState }, boostAmount: car.boostAmount,
    boostRechargeDelaySeconds: car.boostRechargeDelaySeconds,
    boostRechargeArmed: car.boostRechargeArmed, dodgeIntentSteps: car.dodgeIntentSteps,
    wallDriveEngaged: car.wallDriveEngaged };
}
