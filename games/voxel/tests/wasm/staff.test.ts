import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { roomFixture } from './room-fixture.ts';
import { content, engine } from './fixture.ts';
import { GameRoom } from '../../src/sim/game-room.ts';
import { NEUTRAL } from '../../src/shared/input.ts';

test('staff mode changes preserve ownership and earned time, revoke creative flight and invalidate queued epochs before publishing rules', () => {
  const f = roomFixture('creative');
  try {
    f.join('teacher', 'observer');
    f.room.inventories.receive('a', { itemType: 'stone', count: 7 });
    f.store.world.set_flying(f.player().slot, true);
    const oldEpoch = f.player().epoch,
      owned = f.room.inventories.checkpoint(),
      tick = f.room.checkpoint(f.now).tick;
    assert.deepEqual(f.room.staff('teacher', { kind: 'mode', mode: 'survival' }, f.now), {
      ok: true,
      reason: 'mode',
    });
    assert.equal(f.room.mode, 'survival');
    assert.equal(f.state()[10], 0);
    assert.equal(f.state()[12], 1);
    assert.equal(f.player().focused, false);
    assert.ok(f.player().epoch > oldEpoch);
    assert.deepEqual(f.room.inventories.checkpoint(), owned);
    assert.equal(f.room.checkpoint(f.now).tick, tick);
    const rules = f.events.get('a')!.filter((e) => 'type' in e && e.type === 'rules');
    assert.equal(rules.length, 1);
    assert.equal((rules[0] as any).mode, 'survival');
    f.room.receive(
      'a',
      { type: 'input', frames: [{ ...NEUTRAL, epoch: oldEpoch, sequence: 1, x: 1 }] },
      f.now,
    );
    assert.equal(f.player().queue.ack, 0);
    const epoch = f.player().epoch;
    assert.deepEqual(f.room.staff('teacher', { kind: 'mode', mode: 'survival' }, f.now), {
      ok: true,
      reason: 'unchanged',
    });
    assert.equal(f.player().epoch, epoch);
    assert.equal(f.room.inventories.view('a').catalog, false);
    assert.equal(f.room.staff('teacher', { kind: 'mode', mode: 'creative' }, f.now).ok, true);
    assert.equal(f.room.mode, 'creative');
    assert.equal(f.state()[12], 1);
    assert.deepEqual(f.room.inventories.checkpoint(), owned);
  } finally {
    f.room.dispose();
  }
});

test('trusted self teleport resolves an authoritative target, clears motion/stream incarnations and prepares a hidden camera without advancing a paused world', () => {
  const f = roomFixture();
  try {
    f.join('teacher', 'observer');
    f.join('other-staff', 'observer');
    f.controls.set('a', { ...NEUTRAL, x: 1 });
    f.tick(120);
    f.room.setPaused(true, f.now, 'session');
    const epoch = f.player('teacher').epoch,
      subscriptions = [...f.player('teacher').subscriptions.values()],
      target = f.state(),
      tick = f.room.checkpoint(f.now).tick;
    const start = f.events.get('teacher')!.length,
      otherStart = f.events.get('other-staff')!.length;
    assert.equal(f.room.staff('teacher', { kind: 'teleport', target: 'a' }, f.now).ok, true);
    const pose = f.state('teacher');
    assert.equal(pose[0], target[0]);
    assert.equal(pose[2], target[2]);
    assert.equal(pose[1], target[1] + 2);
    assert.deepEqual(Array.from(pose.slice(3, 6)), [0, 0, 0]);
    assert.equal(pose[12], 1);
    assert.equal(f.player('teacher').phase, 'preparing');
    assert.equal(f.player('teacher').focused, false);
    assert.ok(f.player('teacher').epoch > epoch);
    const messages = f.events.get('teacher')!.slice(start);
    for (const sub of subscriptions)
      assert.ok(
        messages.some((e) => 'type' in e && e.type === 'unload' && e.subscription === sub.id),
      );
    assert.ok(
      f.events
        .get('other-staff')!
        .slice(otherStart)
        .some((e) => 'type' in e && e.type === 'actor_removed' && e.id === 'teacher'),
    );
    assert.equal(
      f.events
        .get('a')!
        .some((e) => 'type' in e && e.type === 'actor_joined' && e.actor.id === 'teacher'),
      false,
    );
    while (f.store.generateOne()) {}
    f.room.advance(f.now);
    f.ready('teacher');
    assert.equal(f.player('teacher').phase, 'playing');
    assert.equal(f.state('teacher')[12], 0);
    assert.equal(f.room.checkpoint(f.now).tick, tick);
    assert.equal(f.room.staff('teacher', { kind: 'teleport', target: 'spawn' }, f.now).ok, true);
    assert.equal(f.player('teacher').phase, 'preparing');
  } finally {
    f.room.dispose();
  }
});

test('unavailable/dead teleport targets and ended rooms cannot mutate; normal checkpoints retain an applied mode without persisting staff authority', () => {
  const f = roomFixture();
  let restored: GameRoom | undefined;
  try {
    f.join('teacher', 'observer');
    const before = f.state('teacher').slice();
    assert.deepEqual(f.room.staff('teacher', { kind: 'teleport', target: 'missing' }, f.now), {
      ok: false,
      reason: 'not_present',
    });
    assert.deepEqual(f.state('teacher'), before);
    f.player().phase = 'dead';
    assert.equal(
      f.room.staff('teacher', { kind: 'teleport', target: 'a' }, f.now).reason,
      'not_ready',
    );
    f.player().phase = 'playing';
    f.room.staff('teacher', { kind: 'mode', mode: 'creative' }, f.now);
    const checkpoint = f.room.checkpoint(f.now);
    assert.equal(checkpoint.mode, 'creative');
    assert.equal('staff' in checkpoint, false);
    restored = GameRoom.fromCheckpoint(
      new engine.VoxelWorld(),
      new engine.TerrainGen(4242),
      content.manifest,
      JSON.parse(readFileSync(new URL('../../artifacts/build.json', import.meta.url), 'utf8')),
      { send() {}, close() {} },
      checkpoint,
      f.now,
      new Map(),
    );
    assert.equal(restored.mode, 'creative');
    f.room.end(f.now);
    assert.equal(
      f.room.staff('teacher', { kind: 'mode', mode: 'survival' }, f.now).reason,
      'ended',
    );
    assert.equal(
      f.room.staff('teacher', { kind: 'teleport', target: 'spawn' }, f.now).reason,
      'ended',
    );
  } finally {
    restored?.dispose();
    f.room.dispose();
  }
});

test('dead participants remain dead across creative changes and rejoin until ordinary respawn, preserving checkpoint and item conservation', () => {
  for (const reconnect of [false, true]) {
    const f = roomFixture();
    let restored: GameRoom | undefined;
    try {
      f.room.inventories.receive('a', { itemType: 'stone', count: 7 });
      f.player().vitals.damage(20);
      f.tick();
      assert.equal(f.player().phase, 'dead');
      const dropped = f.room.drops.checkpoint(f.room.checkpoint(f.now).tick);
      if (reconnect) f.room.disconnect('a', f.now);
      assert.equal(f.room.staff('staff', { kind: 'mode', mode: 'creative' }, f.now).ok, true);
      if (reconnect) {
        f.room.join(
          {
            id: 'a',
            role: 'observer',
            capabilities: {
              build: false,
              fly: true,
              observe: true,
              combat: false,
              explosives: false,
            },
          },
          'a',
          f.now,
        );
        assert.doesNotThrow(() => f.room.checkpoint(f.now));
        f.room.disconnect('a', f.now);
      }
      if (reconnect)
        f.room.join(
          {
            id: 'a',
            role: 'participant',
            capabilities: {
              build: true,
              fly: true,
              observe: false,
              combat: true,
              explosives: true,
            },
          },
          'a',
          f.now,
        );
      assert.equal(
        f.player().phase,
        'dead',
        'creative must not allow a dead owner to acquire items before respawn',
      );
      const before = f.room.inventories.view('a');
      const deadEpoch = f.player().epoch;
      const given = f.send({
        type: 'inventory',
        epoch: f.player().epoch,
        sequence: f.next(),
        operation: { kind: 'give', itemType: 'stone', count: 3, revision: before.revision },
      });
      assert.equal(given.outcome?.ok, false);
      f.tick(120);
      assert.equal(f.player().vitals.view().respawnIn, 0);
      const respawn = f.send({ type: 'respawn', epoch: f.player().epoch, sequence: f.next() });
      assert.equal(respawn.outcome?.ok, true);
      while (f.store.generateOne()) {}
      f.room.advance(f.now);
      f.ready();
      assert.equal(f.player().vitals.dead, false);
      assert.equal(f.player().phase, 'playing');
      assert.equal(
        f.send({
          type: 'inventory',
          epoch: deadEpoch,
          sequence: 1,
          operation: { kind: 'give', itemType: 'stone', count: 3, revision: before.revision },
        }).status,
        'stale_epoch',
      );
      assert.equal(f.room.inventories.view('a').bag.some(Boolean), false);
      assert.deepEqual(
        f.room.drops.checkpoint(f.room.checkpoint(f.now).tick).entries.map((e) => e.stack),
        dropped.entries.map((e) => e.stack),
      );
      f.room.inventories.receive('a', { itemType: 'stone', count: 3 });
      const checkpoint = f.room.checkpoint(f.now);
      restored = GameRoom.fromCheckpoint(
        new engine.VoxelWorld(),
        new engine.TerrainGen(4242),
        content.manifest,
        JSON.parse(readFileSync(new URL('../../artifacts/build.json', import.meta.url), 'utf8')),
        { send() {}, close() {} },
        checkpoint,
        f.now,
        new Map(),
      );
      assert.equal(restored.mode, 'creative');
      assert.equal(restored.inventories.view('a').bag.filter(Boolean)[0]?.count, 3);
    } finally {
      restored?.dispose();
      f.room.dispose();
    }
  }
});
