import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stepMovement } from '../../src/shared/movement.ts';
import { flatWorld } from './fixture.ts';
import { roomFixture } from './room-fixture.ts';

test('grounded flight survives input delay, takes off, and lands on descent', () => {
  const world = flatWorld(),
    slot = world.player_add(0.5, 1.005, 0.5);
  const controls = { x: 0, z: 0, yaw: 0, pitch: 0, jump: false, sneak: false, sprint: false };
  try {
    for (let n = 0; n < 30; n++) stepMovement(world, slot, controls);
    assert.equal(world.player_state(slot)[6], 1);
    world.set_flying(slot, true);
    for (let n = 0; n < 12; n++) stepMovement(world, slot, controls);
    assert.equal(world.player_state(slot)[10], 1, 'flight must survive a neutral input tick');
    for (let n = 0; n < 60; n++) stepMovement(world, slot, { ...controls, jump: true });
    assert.ok(world.player_state(slot)[1] > 7, 'normal input must take off from the ground');
    for (let n = 0; n < 120; n++) stepMovement(world, slot, { ...controls, sneak: true });
    assert.equal(world.player_state(slot)[10], 0, 'descending onto the ground ends flight');
    assert.ok(Math.abs(world.player_state(slot)[1] - 1.005) < 0.02);
  } finally {
    world.free();
  }
});

test('survival observer flight requires current authority and reconnect cannot retain revoked flight state', () => {
  const f = roomFixture();
  try {
    f.join('staff', 'observer');
    assert.equal(
      f.send({ type: 'flight', epoch: f.player('staff').epoch, sequence: 1, on: true }, 'staff')
        .outcome?.ok,
      true,
    );
    assert.equal(f.state('staff')[10], 1);
    assert.equal(
      f.send({ type: 'flight', epoch: f.player('staff').epoch, sequence: 2, on: false }, 'staff')
        .outcome?.ok,
      true,
    );
    f.tick(12);
    assert.equal(
      f.state('staff')[10],
      0,
      'spectator identity must not force revoked or toggled-off flight back on',
    );
    assert.equal(
      f.send({ type: 'flight', epoch: f.player('staff').epoch, sequence: 1, on: true }, 'staff')
        .outcome?.ok,
      true,
    );
    f.room.disconnect('staff', f.now);
    f.room.join(
      {
        id: 'staff',
        role: 'observer',
        capabilities: {
          build: false,
          fly: false,
          observe: true,
          combat: false,
          explosives: false,
        },
      },
      'staff',
      f.now,
    );
    f.room.advance(f.now);
    f.ready('staff');
    assert.equal(f.player('staff').phase, 'playing');
    f.tick(12);
    assert.equal(f.state('staff')[10], 0);
    assert.equal(
      f.send({ type: 'flight', epoch: f.player('staff').epoch, sequence: 1, on: true }, 'staff')
        .outcome?.reason,
      'forbidden',
    );
    assert.equal(f.state('staff')[10], 0);
    assert.equal(
      f.send({ type: 'flight', epoch: f.player().epoch, sequence: f.next(), on: true }).outcome
        ?.reason,
      'forbidden',
    );
  } finally {
    f.room.dispose();
  }
});
