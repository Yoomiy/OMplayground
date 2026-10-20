import RAPIER from '@dimforge/rapier3d-compat';
import {
  DEFAULT_TUNING_REGISTRY_SNAPSHOT,
  TUNING_IDS,
  getScalarTuningValue,
  type TuningRegistrySnapshot,
} from '@rocket-arena/shared';
import { getConstant } from '@rocket-arena/shared/constants';

let rapier: typeof RAPIER;
let initialization: Promise<typeof RAPIER> | undefined;

type PhysicsTuningSnapshot = Pick<TuningRegistrySnapshot, 'get'>;

export function initPhysics(): Promise<typeof RAPIER> {
  // Rapier's module owns global WASM memory. Reinitializing it for another room
  // can invalidate worlds that are already stepping in this process/worker.
  initialization ??= Promise.resolve().then(() => RAPIER.init()).then(() => {
    rapier = RAPIER;
    return rapier;
  }, error => { initialization = undefined; throw error; });
  return initialization;
}

function finiteTuningValue(
  tuning: PhysicsTuningSnapshot,
  id: string,
  predicate: (value: number) => boolean = () => true,
): number {
  const fallback = getScalarTuningValue(DEFAULT_TUNING_REGISTRY_SNAPSHOT, id);
  const candidate = getScalarTuningValue(tuning, id);
  return Number.isFinite(candidate) && predicate(candidate) ? candidate : fallback;
}

/** Create a deterministically configured fixed-step metric Rapier world. */
export function createWorld(
  tuning: PhysicsTuningSnapshot = DEFAULT_TUNING_REGISTRY_SNAPSHOT,
): RAPIER.World {
  const gravityY = finiteTuningValue(tuning, TUNING_IDS.physics.gravityY);
  const timestep = finiteTuningValue(
    tuning,
    TUNING_IDS.physics.fixedStepSeconds,
    (value) => value > 0,
  );
  let world: RAPIER.World | null = null;

  try {
    world = new rapier.World(new rapier.Vector3(0, gravityY, 0));
    world.timestep = timestep;
    world.numSolverIterations = Math.round(getConstant('PHYSICS.SOLVER_ITERATIONS'));
    world.numAdditionalFrictionIterations = Math.round(
      getConstant('PHYSICS.ADDITIONAL_FRICTION_ITERATIONS'),
    );
    world.integrationParameters.maxCcdSubsteps = Math.round(
      getConstant('PHYSICS.MAX_CCD_SUBSTEPS'),
    );
    return world;
  } catch (cause) {
    world?.free();
    throw cause;
  }
}

export function getRapier(): typeof RAPIER {
  return rapier;
}
