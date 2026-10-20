import assert from 'node:assert/strict';
import test from 'node:test';
import { createBotController } from './bot-controller.js';
import { createNeutralInputCommandV2, type AuthoritativeRoomProjection } from '../rooms/authoritative-room-core.js';

function frame(x = 0, z = 20, tick = 60, phase = 'playing', speed = 10): Readonly<AuthoritativeRoomProjection> {
  return { phase, fixedStepsCompleted: tick, ball: { position: [x, 1, z] },
    cars: [{ sessionId: 'bot', position: [0, .5, 0], rotation: [0, 0, 0, 1], linearVelocity: [0, 0, speed] }],
  } as unknown as AuthoritativeRoomProjection;
}
const create = () => createBotController('bot', 0, { ...createNeutralInputCommandV2(), jumpSequence: 17, cameraToggleSequence: 4 });

test('bots chase a forward ball, turn toward either side and reserve boost for aligned driving', () => {
  const controller = create();
  const forward = controller(frame());
  assert.equal(forward.throttle, 1); assert.equal(forward.steer, 0); assert.equal(forward.boostHeld, true);
  const right = controller(frame(20, 0));
  assert.equal(right.steer, 1); assert.equal(right.powerslideHeld, true); assert.equal(right.boostHeld, false);
  assert.equal(controller(frame(-20, 0)).steer, -1);
  assert.equal(controller(frame(0, 20, 60, 'playing', 35)).boostHeld, false);
});

test('bots send neutral controls outside active play or without their authoritative actor', () => {
  const controller = create();
  for (const phase of ['waiting', 'countdown', 'goal-reset', 'ended']) {
    assert.deepEqual(controller(frame(0, 20, 60, phase)), { ...createNeutralInputCommandV2(), jumpSequence: 17, cameraToggleSequence: 4 });
  }
  assert.equal(controller({ ...frame(), cars: [] }).throttle, 0);
  assert.equal(controller(frame(0, 20, 60, 'overtime')).throttle, 1);
});

test('jump press IDs advance only on a new press and preserve the actor input floor', () => {
  const controller = create();
  assert.equal(controller(frame(0, 20, 655)).jumpSequence, 18);
  assert.equal(controller(frame(0, 20, 656)).jumpSequence, 18);
  assert.equal(controller(frame(0, 20, 660)).jumpHeld, false);
  assert.equal(controller(frame(0, 20, 1315)).jumpSequence, 19);
});

test('a stuck bot periodically reverses without boosting and returns to forward driving', () => {
  const controller = create();
  const reverse = controller(frame(0, 20, 480, 'playing', 0));
  assert.equal(reverse.throttle, -1); assert.equal(reverse.boostHeld, false);
  assert.equal(controller(frame(0, 20, 540, 'playing', 0)).throttle, 1);
});
