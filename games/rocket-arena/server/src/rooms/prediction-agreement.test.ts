import assert from 'node:assert/strict';
import test from 'node:test';
import type RAPIER from '@dimforge/rapier3d-compat';
import { ARENA_COLLISION_GEOMETRY, PHYSICS, type InputCommandV2 } from '@rocket-arena/shared';
import { PredictionWorld } from '@rocket-arena/simulation/prediction-world';
import { AuthoritativeRoomCore } from './authoritative-room-core.js';
import { initializeAuthoritativeRapierWorld, type AuthoritativeRapierCar } from './rapier-room-world.js';

const neutral: Readonly<InputCommandV2> = { protocolVersion: 2, throttle: 0, steer: 0,
  pitch: 0, roll: 0, yaw: 0, jumpHeld: false, jumpSequence: 0, boostHeld: false,
  powerslideHeld: false, cameraToggleSequence: 0 };
const fixedMs = PHYSICS.TIMESTEP * 1000;

test('local prediction moves before acknowledgement and agrees with real server driving, boost and jumping', async () => {
  const core = new AuthoritativeRoomCore<RAPIER.World, AuthoritativeRapierCar, RAPIER.RigidBody>({
    roomId: 'prediction-agreement', mode: 'custom',
    initializeWorld: (context) => initializeAuthoritativeRapierWorld(context, {
      resolvedGeometry: ARENA_COLLISION_GEOMETRY,
      initialCarPosition: () => ({ x: 0, y: 0.6, z: -25 }),
    }), logger: { info: () => {}, error: () => {} },
  });
  await core.initialize();
  const join = core.queueMutation({ kind: 'join', sessionId: 'driver', name: 'Driver' });
  core.advanceSimulation(fixedMs);
  assert.equal((await join).ok, true);
  const start = core.queueMutation({ kind: 'start', sessionId: 'driver' });
  core.advanceSimulation(fixedMs);
  assert.equal((await start).ok, true);
  for (let i = 0; i < 190; i++) core.advanceSimulation(fixedMs);
  assert.equal(core.buildPredictionFrame()!.phase, 'playing');
  const predicted = new PredictionWorld();
  try {
    predicted.restore(core.buildPredictionFrame()!);
    const initialPosition = core.buildPredictionFrame()!.cars[0].position;
    const firstCommand = { ...neutral, throttle: 1 };
    predicted.step('driver', firstCommand);
    assert.ok(predicted.getCar('driver')!.position.z > initialPosition.z);
    assert.equal(core.buildPredictionFrame()!.cars[0].position.z, initialPosition.z,
      'local movement must not wait for or mutate the authoritative server');
    assert.equal(core.submitPredictionInput('driver', { sequence: 1, command: firstCommand }), true);
    core.advanceSimulation(fixedMs);
    assert.equal(core.buildPredictionFrame()!.cars[0].acknowledgedSequence, 1);
    for (let sequence = 2; sequence <= 120; sequence++) {
      const command = { ...neutral, throttle: 1, boostHeld: sequence < 45,
        steer: sequence > 50 && sequence < 80 ? 0.5 : 0,
        jumpHeld: sequence >= 80 && sequence < 88, jumpSequence: sequence >= 80 ? 1 : 0 };
      predicted.step('driver', command);
      assert.equal(core.submitPredictionInput('driver', { sequence, command }), true);
      core.advanceSimulation(fixedMs);
      const server = core.buildPredictionFrame()!.cars[0];
      const client = predicted.getCar('driver')!;
      const error = Math.hypot(server.position.x - client.position.x,
        server.position.y - client.position.y, server.position.z - client.position.z);
      assert.ok(error < 0.05, `simulation diverged at sequence ${sequence}: ${error} m`);
    }
    // Rewind to a server snapshot and replay pending commands, as a delayed client does.
    const checkpoint = core.buildPredictionFrame()!;
    for (let i = 0; i < 8; i++) predicted.step('driver', firstCommand);
    const forward = predicted.getCar('driver')!;
    predicted.restore(checkpoint);
    for (let i = 0; i < 8; i++) predicted.step('driver', firstCommand);
    const replay = predicted.getCar('driver')!;
    assert.ok(Math.hypot(forward.position.x - replay.position.x,
      forward.position.y - replay.position.y, forward.position.z - replay.position.z) < 0.05);
    assert.equal(core.submitPredictionInput('outsider', { sequence: 1, command: firstCommand }), false);
  } finally { predicted.dispose(); core.dispose(); }
});
