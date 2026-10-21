import assert from 'node:assert/strict';
import test from 'node:test';
import { createCarJumpAirState } from '@rocket-arena/simulation/car-controller';
import type { PredictionFrame } from '@rocket-arena/simulation/protocol';
import { PredictionHistory } from '../src/prediction/prediction-history.js';
import { historyCommand } from './history-fixture.js';

function checkpoint(): PredictionFrame {
  const body = { position: { x: 0, y: 1, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 },
    velocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 } };
  return { version: 1, tick: 100, phase: 'playing', kickoffEpoch: 1, ball: structuredClone(body),
    boostPadCooldowns: [{ index: 0, secondsRemaining: 3 }],
    cars: ['local', 'remote'].map(sessionId => ({ sessionId, ...structuredClone(body),
      acknowledgedSequence: 10, inputAppliedTick: 100, input: { ...historyCommand },
      jumpAirState: createCarJumpAirState(), boostAmount: 50, boostRechargeDelaySeconds: 0,
      boostRechargeArmed: true, dodgeIntentSteps: 0, wallDriveEngaged: false })) };
}

test('tick alignment, all bodies, controls, runtime and pads must agree before skipping', () => {
  const frame = checkpoint();
  const history = new PredictionHistory(); history.record(structuredClone(frame));
  const live = structuredClone(frame); live.tick += 6;
  live.cars[0].input.steer = .5; // Future local input must remain predicted immediately.
  assert.equal(history.check(frame, live, 'local'), 'match');
  const mutations: ((f: PredictionFrame) => void)[] = [
    f => { f.cars[0].acknowledgedSequence--; },
    f => { f.cars[0].inputAppliedTick!--; },
    f => { f.cars[0].position.x += .021; },
    f => { f.cars[1].velocity.z += .051; },
    f => { f.ball.angularVelocity.y += .021; },
    f => { f.ball.rotation.y += .01; },
    f => { f.cars[1].input.steer = 1; },
    f => { f.cars[0].jumpAirState = { ...f.cars[0].jumpAirState, lastConsumedJumpSequence: 1 }; },
    f => { f.cars[0].boostAmount += .051; },
    f => { f.cars[0].boostRechargeDelaySeconds += .002; },
    f => { f.cars[0].boostRechargeArmed = false; },
    f => { f.cars[0].dodgeIntentSteps++; },
    f => { f.cars[0].wallDriveEngaged = true; },
    f => { f.boostPadCooldowns = [{ index: 0, secondsRemaining: 2 }]; },
    f => { f.cars.pop(); },
    f => { f.kickoffEpoch++; },
    f => { f.phase = 'goal-reset'; },
    f => { f.ball.position.x = NaN; },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(frame); mutate(changed);
    assert.equal(history.check(changed, live, 'local'), 'different', mutate.toString());
  }
  const remoteFuture = structuredClone(live); remoteFuture.cars[1].input.throttle = -1;
  assert.equal(history.check(frame, remoteFuture, 'local'), 'different');
  const legacy = structuredClone(frame); delete legacy.cars[0].inputAppliedTick;
  assert.equal(history.check(legacy, live, 'local'), 'missing');
  const future = structuredClone(frame); future.tick++;
  assert.equal(history.check(future, live, 'local'), 'missing');
});

test('comparison tolerates bounded numerical error, quaternion sign and input key order; history stays bounded', () => {
  const frame = checkpoint();
  const history = new PredictionHistory(); history.record(structuredClone(frame));
  const close = structuredClone(frame);
  close.cars[0].position.x += .01;
  close.cars[0].rotation.w = -1;
  close.cars[0].input = Object.fromEntries(Object.entries(close.cars[0].input).reverse()) as typeof historyCommand;
  assert.equal(history.check(close, frame, 'local'), 'match');
  for (let tick = 101; tick < 200; tick++) history.record({ ...frame, tick });
  assert.equal(history.size, 64);
  assert.equal(history.check(frame, frame, 'local'), 'missing');
  history.clear(); assert.equal(history.size, 0);
});
