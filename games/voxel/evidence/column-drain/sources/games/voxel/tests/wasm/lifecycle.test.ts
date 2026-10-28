import assert from 'node:assert/strict';
import { test } from 'node:test';
import { roomFixture } from './room-fixture.ts';
import { content } from './fixture.ts';
import { NEUTRAL } from '../../src/shared/input.ts';

test('paused worlds prepare new actors and move hidden teachers without advancing survival, drops or TNT', () => {
  const f = roomFixture();
  try {
    const p = f.state();
    f.room.explosives.add(
      'a',
      content.defaults.tnt,
      [p[0] + 5, p[1] + 1, p[2]],
      content.manifest.behavior.find((b) => b.family === 'tnt')!.explosive!,
    );
    f.room.drops.add({ itemType: 'stone', count: 1 }, [p[0] + 6, p[1] + 1, p[2]], 0, 'a');
    f.room.setPaused(true, f.now, 'session');
    f.join('teacher', 'observer');
    f.join('late');
    assert.equal(f.player('teacher').resolved, true);
    assert.equal(f.player('teacher').phase, 'playing');
    assert.equal(f.state('teacher')[12], 0);
    assert.equal(f.player('late').resolved, true);
    assert.equal(f.state('late')[12], 1);
    const before = f.room.checkpoint(f.now),
      y = f.state('teacher')[1];
    f.controls.set('teacher', { ...NEUTRAL, x: 0.5, jump: true });
    f.room.receive('a', { type: 'focus', epoch: f.player().epoch, active: true }, f.now);
    f.tick(60);
    const after = f.room.checkpoint(f.now);
    assert.equal(after.tick, before.tick);
    assert.deepEqual(after.explosives, before.explosives);
    assert.deepEqual(after.drops, before.drops);
    assert.deepEqual(after.inventories, before.inventories);
    assert.deepEqual(
      after.players.find((p) => p.id === 'a')!.vitals,
      before.players.find((p) => p.id === 'a')!.vitals,
    );
    assert.equal(f.player().focused, false);
    assert.equal(f.state()[12], 1);
    assert.ok(f.state('teacher')[1] > y + 3);
    assert.equal(
      f.events
        .get('a')!
        .some(
          (event) =>
            'type' in event && event.type === 'actor_joined' && event.actor.id === 'teacher',
        ),
      false,
    );
    assert.equal(
      f.send(
        {
          type: 'flight',
          epoch: f.player('teacher').epoch,
          sequence: f.next('teacher'),
          on: false,
        },
        'teacher',
      ).outcome?.ok,
      true,
    );
    f.room.setPaused(false, f.now);
    f.tick();
    assert.equal(f.room.checkpoint(f.now).tick, before.tick + 1);
  } finally {
    f.room.dispose();
  }
});
test('an ended world cannot be resumed, accept new actors or earn ticks', () => {
  const f = roomFixture();
  try {
    f.tick(5);
    f.room.end(f.now);
    const before = f.room.checkpoint(f.now);
    assert.equal(f.room.lifecycle().state, 'ended');
    f.room.setPaused(false, f.now);
    f.room.join(
      { id: 'denied', role: 'participant', capabilities: { ...f.player().capabilities } },
      'denied',
      f.now,
    );
    assert.equal(f.room.actors.has('denied'), false);
    f.tick(60);
    assert.deepEqual(f.room.checkpoint(f.now), before);
  } finally {
    f.room.dispose();
  }
});
