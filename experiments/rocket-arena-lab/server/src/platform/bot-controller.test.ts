import assert from 'node:assert/strict';
import test from 'node:test';
import { createBotController } from './bot-controller.js';
import { createNeutralInputCommandV2, type AuthoritativeRoomProjection } from '../rooms/authoritative-room-core.js';
// Existing evaluated JavaScript driver is the independent behavior baseline.
// @ts-expect-error The standalone load driver intentionally has no TS declarations.
import { driveBot } from '../../../scripts/bot-driver.mjs';

test('native controllers retain the evaluated socket driver steering, boosts, jumps and recovery', () => {
  for (let index = 0; index < 7; index++) {
    const actorId = `rocket-${index}`;
    const old = { index, room: { sessionId: actorId }, jumpSequence: 5, jumping: false };
    const controller = createBotController(actorId, index, { ...createNeutralInputCommandV2(), jumpSequence: 5 });
    for (let step = 0; step < 1800; step++) {
      const angle = Math.sin(step / 50) * Math.PI;
      const position = { x: Math.sin(step / 37) * 12, y: .5, z: Math.cos(step / 43) * 20 };
      const rotation = { x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) };
      const velocity = { x: step % 17 === 0 ? 0 : Math.sin(step / 11) * 20, y: 0, z: step % 17 === 0 ? 0 : 2 };
      const ball = { position: { x: Math.cos(step / 21) * 10, y: 1, z: Math.sin(step / 29) * 30 } };
      const phase = step % 200 < 10 ? 'countdown' : step % 300 < 10 ? 'goal-reset' : 'playing';
      const native = { phase, fixedStepsCompleted: step, ball: { position: [ball.position.x, 1, ball.position.z] },
        cars: [{ sessionId: actorId, position: [position.x, position.y, position.z],
          rotation: [0, rotation.y, 0, rotation.w], linearVelocity: [velocity.x, 0, velocity.z] }] } as unknown as AuthoritativeRoomProjection;
      const expected = driveBot(old, { phase, ball, cars: [{ sessionId: actorId, position, rotation, velocity }] }, step / 60);
      assert.deepEqual(controller(native), expected, `index=${index}, step=${step}`);
    }
  }
});
