import assert from 'node:assert/strict';
import test from 'node:test';
import type { InputCommandV2 } from '@rocket-arena/shared';
import { initPhysics } from '../src/world.js';
import { PredictionWorld } from '../src/prediction-world.js';
import { createCarJumpAirState } from '../src/car-controller.js';
import type { PredictionFrame } from '../src/protocol.js';

const command: InputCommandV2 = { protocolVersion: 2, throttle: 1, steer: .2,
  pitch: 0, roll: 0, yaw: 0, jumpHeld: false, jumpSequence: 0, boostHeld: true,
  powerslideHeld: false, cameraToggleSequence: 0 };

test('fixed-arena query reuse matches eager rebuilds through collisions, teleports and roster changes', async () => {
  await initPhysics();
  const optimized = new PredictionWorld();
  const eager = new PredictionWorld();
  const frame: PredictionFrame = { version: 1, tick: 300, kickoffEpoch: 1, phase: 'playing',
    boostPadCooldowns: [], ball: { position: { x: 0, y: 1.6, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 },
      velocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 } },
    cars: ['local', 'remote'].map((sessionId, i) => ({ sessionId, acknowledgedSequence: 0,
      input: i ? { ...command, throttle: -1 } : command,
      position: { x: 0, y: .6, z: i ? 4 : -4 }, rotation: { x: 0, y: 0, z: 0, w: 1 },
      velocity: { x: 0, y: 0, z: i ? -10 : 10 }, angularVelocity: { x: 0, y: 0, z: 0 },
      jumpAirState: createCarJumpAirState(), boostAmount: 50, boostRechargeDelaySeconds: 0,
      boostRechargeArmed: true, dodgeIntentSteps: 0, wallDriveEngaged: false })) };
  try {
    // Reposition into the ramp, then onto the wall, then remove/reintroduce a car.
    for (const scenario of ['collision', 'ramp', 'wall', 'leave', 'rejoin']) {
      const checkpoint = structuredClone(frame);
      if (scenario === 'ramp') checkpoint.cars[0].position = { x: 39, y: 1.3, z: -10 };
      if (scenario === 'wall') {
        checkpoint.cars[0].position = { x: 40.4, y: 4, z: -10 };
        checkpoint.cars[0].rotation = { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 };
      }
      if (scenario === 'leave') checkpoint.cars.pop();
      optimized.restore(checkpoint);
      eager.restore(checkpoint);
      eager.world.updateSceneQueries();
      for (let step = 0; step < 90; step++) {
        eager.world.updateSceneQueries();
        optimized.step('local', command);
        eager.step('local', command);
        assert.deepEqual(optimized.getCar('local'), eager.getCar('local'), `${scenario}, step ${step}`);
        assert.deepEqual(optimized.getCar('remote'), eager.getCar('remote'));
        assert.deepEqual(optimized.getBall(), eager.getBall());
      }
    }
  } finally { optimized.dispose(); eager.dispose(); }
});
