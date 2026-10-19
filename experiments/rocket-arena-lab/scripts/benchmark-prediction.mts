import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { type InputCommandV2 } from '@rocket-arena/shared';
import { initPhysics } from '@rocket-arena/simulation/world';
import { PredictionWorld } from '@rocket-arena/simulation/prediction-world';
import { createCarJumpAirState } from '@rocket-arena/simulation/car-controller';
import type { PredictionFrame } from '@rocket-arena/simulation/protocol';

// Optional baseline directory contains a separate pinned copy of simulation/src.
// Pair old/new batches in one process, alternating order to reduce timing bias.
await initPhysics();
const constructors = new Map<string, typeof PredictionWorld>();
const baseline = process.env.PREDICTION_BENCH_BASELINE;
if (baseline) {
  await (await import(`${baseline}/world.ts`)).initPhysics();
  constructors.set('baseline', (await import(`${baseline}/prediction-world.ts`)).PredictionWorld);
}
constructors.set('current', PredictionWorld);
const command: InputCommandV2 = { protocolVersion: 2, throttle: 1, steer: .3, pitch: 0, roll: 0, yaw: 0,
  jumpHeld: false, jumpSequence: 0, boostHeld: true, powerslideHeld: false, cameraToggleSequence: 0 };
const frame: PredictionFrame = { version: 1, tick: 300, kickoffEpoch: 1, phase: 'playing',
  ball: { position: { x: 0, y: 1, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 },
    velocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 } }, boostPadCooldowns: [],
  cars: ['local', 'remote'].map((sessionId, i) => ({ sessionId, acknowledgedSequence: 0, input: command,
    position: { x: i * 5, y: .6, z: -10 }, rotation: { x: 0, y: 0, z: 0, w: 1 },
    velocity: { x: 0, y: 0, z: 12 }, angularVelocity: { x: 0, y: 0, z: 0 },
    jumpAirState: createCarJumpAirState(), boostAmount: 50, boostRechargeDelaySeconds: 0,
    boostRechargeArmed: true, dodgeIntentSteps: 0, wallDriveEngaged: false })) };
const runs = [...constructors].map(([name, Constructor]) => {
  const world = new Constructor();
  const costs = { explicitQueries: 0, physics: 0, raycasts: 0 };
  const run = { name, world, costs, measured: false, samples: [] as number[] };
  for (const [method, metric] of [['updateSceneQueries', 'explicitQueries'], ['step', 'physics'], ['castRayAndGetNormal', 'raycasts']] as const) {
    const original = world.world[method].bind(world.world) as (...args: any[]) => any;
    (world.world as any)[method] = (...args: any[]) => {
      if (!run.measured) return original(...args);
      const start = performance.now();
      const result = original(...args);
      costs[metric] += performance.now() - start;
      return result;
    };
  }
  return run;
});
try {
  for (let batch = 0; batch < 400; batch++) {
    for (const run of batch % 2 ? [...runs].reverse() : runs) {
      run.measured = batch >= 100;
      const start = performance.now();
      run.world.restore(frame);
      for (let step = 0; step < 6; step++) run.world.step('local', command);
      if (run.measured) run.samples.push(performance.now() - start);
    }
  }
  const results = Object.fromEntries(runs.map(({ name, world, costs, samples }) => {
    samples.sort((a,b) => a-b);
    return [name, { batches: samples.length, stepsPerReplay: 6, colliders: world.world.colliders.len(),
      meanMs: samples.reduce((a,b) => a+b,0)/samples.length,
      medianMs: samples[Math.floor(samples.length/2)], p95Ms: samples[Math.floor(samples.length*.95)],
      componentMeanMs: Object.fromEntries(Object.entries(costs).map(([k,v]) => [k,v/samples.length])),
      finalCar: world.getCar('local'), finalBall: world.getBall() }];
  }));
  if (results.baseline) {
    assert.deepEqual(results.current.finalCar, results.baseline.finalCar);
    assert.deepEqual(results.current.finalBall, results.baseline.finalBall);
  }
  if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify(results));
} finally { for (const run of runs) run.world.dispose(); }
