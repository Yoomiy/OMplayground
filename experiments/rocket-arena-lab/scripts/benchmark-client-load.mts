import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { initPhysics } from '@rocket-arena/simulation/world';
import { PredictionWorld } from '@rocket-arena/simulation/prediction-world';
import { createCarJumpAirState } from '@rocket-arena/simulation/car-controller';
import { PredictionHistory } from '../client/src/lab/prediction-history.js';
import type { PredictionFrame } from '@rocket-arena/simulation/protocol';
import type { InputCommandV2 } from '@rocket-arena/shared';

// Pin baseline source explicitly. Interleave old/new work on identical frames;
// include the checkpoints used by real replay and compare the entire world.
const liveCheck = process.env.CLIENT_LOAD_LIVE_CHECK === '1';
const baseline = process.env.CLIENT_LOAD_BASELINE;
assert.ok(baseline, 'CLIENT_LOAD_BASELINE must contain pinned simulation/src files');
await initPhysics();
await (await import(`${baseline}/world.ts`)).initPhysics();
const Baseline: typeof PredictionWorld = (await import(`${baseline}/prediction-world.ts`)).PredictionWorld;
const command: InputCommandV2 = { protocolVersion: 2, throttle: 1, steer: .25, pitch: 0,
  roll: 0, yaw: 0, jumpHeld: false, jumpSequence: 0, boostHeld: true,
  powerslideHeld: false, cameraToggleSequence: 0 };
const cases = [2, 8].flatMap(players => ['spread', 'contact'].map(placement => {
  const frame: PredictionFrame = { version: 1, tick: 300, kickoffEpoch: 1, phase: 'playing',
    ball: { position: { x: 0, y: 1, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 },
      velocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 } }, boostPadCooldowns: [],
    cars: Array.from({ length: players }, (_, i) => ({ sessionId: i ? `remote-${i}` : 'local',
      acknowledgedSequence: 0, inputAppliedTick: 300, input: command,
      position: { x: (i%4-1.5)*(placement === 'spread' ? 7 : 1.3), y: .6,
        z: -10+Math.floor(i/4)*(placement === 'spread' ? 8 : 1.8) },
      rotation: { x: 0, y: 0, z: 0, w: 1 }, velocity: { x: 0, y: 0, z: 12 },
      angularVelocity: { x: 0, y: 0, z: 0 }, jumpAirState: createCarJumpAirState(), boostAmount: 50,
      boostRechargeDelaySeconds: 0, boostRechargeArmed: true, dodgeIntentSteps: 0, wallDriveEngaged: false })) };
  return { players, placement, frame, runs: [{ name: 'baseline', world: new Baseline(),
    history: new PredictionHistory(), samples: [] as number[] }, { name: 'current', world: new PredictionWorld(),
    history: new PredictionHistory(), samples: [] as number[] }] };
}));
try {
  for (let batch = 0; batch < 180; batch++) {
    for (const scenario of batch%2 ? [...cases].reverse() : cases) {
      for (const run of batch%2 ? [...scenario.runs].reverse() : scenario.runs) {
        const start = performance.now();
        run.world.restore(scenario.frame);
        run.history.clear();
        let authority: PredictionFrame | null = null;
        for (let step = 0; step < 6; step++) {
          run.world.step('local', command, step+1);
          const checkpoint = run.world.capture();
          run.history.record(checkpoint);
          if (step === 1) authority = checkpoint;
        }
        if (liveCheck) {
          const live = run.world.capture();
          assert.equal(run.history.check(authority!, live, 'local'), 'match');
        }
        if (batch >= 60) run.samples.push(performance.now()-start);
      }
      assert.deepEqual(scenario.runs[0].world.capture(), scenario.runs[1].world.capture());
    }
  }
  const distribution = (samples: number[]) => {
    samples.sort((a,b) => a-b);
    return { meanMs: samples.reduce((a,b) => a+b,0)/samples.length,
      medianMs: samples[Math.floor(samples.length/2)], p95Ms: samples[Math.floor(samples.length*.95)] };
  };
  const results = cases.map(scenario => {
    const [before, after] = scenario.runs.map(run => distribution(run.samples));
    return { players: scenario.players, placement: scenario.placement, batches: 120, stepsPerReplay: 6, liveCheck,
      baseline: before, current: after, medianReductionPercent: (1-after.medianMs/before.medianMs)*100,
      exactWorldMatch: true };
  });
  const output = { conditions: `VPS Node, interleaved pinned/current full-world replay plus history${liveCheck ? ' and one delayed-snapshot validation per replay' : ''}; 60 warmup, 120 measured batches. Excludes rendering, networking and worker messaging.`, results };
  if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(output,null,2)+'\n');
  console.log(JSON.stringify(output,null,2));
} finally { for (const scenario of cases) for (const run of scenario.runs) run.world.dispose(); }
