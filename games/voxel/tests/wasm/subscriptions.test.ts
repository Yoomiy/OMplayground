import assert from 'node:assert/strict';
import { test } from 'node:test';
import { roomFixture } from './room-fixture.ts';
import { around, columnKey, STREAM_RADIUS } from '../../src/shared/protocol.ts';
test('subscription reuse preserves column crossing, explicit resync, reconnect and same-column teleport incarnations', () => {
  const f = roomFixture('creative');
  try {
    const check = (id = 'a') => {
      const p = f.state(id),
        actor = f.player(id);
      assert.deepEqual(
        [...actor.subscriptions.keys()].sort(),
        around(Math.floor(p[0] / 16), Math.floor(p[2] / 16), STREAM_RADIUS)
          .map((c) => columnKey(c.x, c.z))
          .sort(),
      );
    };
    const move = (x: number, z: number) => {
      const p = f.state();
      p[0] = x;
      p[2] = z;
      f.store.world.player_restore(f.player().slot, p);
      f.tick();
      check();
    };
    check();
    for (const [x, z] of [
      [15.9, 15.9],
      [16.1, 15.9],
      [-0.1, -0.1],
      [-16.1, -16.1],
      [255, 255],
      [-255, -255],
    ])
      move(x, z);
    const actor = f.player(),
      key = [...actor.subscriptions.keys()][0],
      sub = actor.subscriptions.get(key)!;
    f.events.get('a')!.length = 0;
    f.room.receive('a', { type: 'resync', x: sub.x, z: sub.z, subscription: sub.id }, f.now);
    assert(
      f.events
        .get('a')!
        .some((e) => 'kind' in e && e.kind === 'baseline' && e.subscription === sub.id),
    );
    f.join('teacher', 'observer');
    assert.equal(f.room.staff('teacher', { kind: 'teleport', target: 'a' }, f.now).ok, true);
    while (f.store.generateOne()) {}
    f.room.advance(f.now);
    f.ready('teacher');
    const before = f.player('teacher').nextSubscription;
    assert.equal(f.room.staff('teacher', { kind: 'teleport', target: 'a' }, f.now).ok, true);
    check('teacher');
    assert(f.player('teacher').nextSubscription > before);
    f.room.disconnect('a', f.now);
    f.join('a');
    check();
  } finally {
    f.room.dispose();
  }
});
