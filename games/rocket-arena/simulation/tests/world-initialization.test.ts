import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, initPhysics } from '../src/world.js';

test('concurrent and later physics initialization preserve already running worlds', async () => {
  const [rapier] = await Promise.all([initPhysics(), initPhysics(), initPhysics()]);
  const worlds: ReturnType<typeof createWorld>[] = [];
  try {
    for (let index = 0; index < 3; index++) {
      await Promise.all([initPhysics(), initPhysics()]);
      const world = createWorld();
      worlds.push(world);
      const body = world.createRigidBody(rapier.RigidBodyDesc.dynamic().setTranslation(0, 10, 0));
      world.createCollider(rapier.ColliderDesc.ball(0.5), body);
      for (const running of worlds) {
        running.step();
        assert.equal(running.bodies.len(), 1);
        running.bodies.forEach(body => {
          assert.ok(Number.isFinite(body.translation().y));
          assert.ok(body.translation().y < 10, 'existing worlds still simulate after another initialization request');
        });
      }
    }
  } finally { for (const world of worlds) world.free(); }
});
