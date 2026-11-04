import assert from 'node:assert/strict';
import { test } from 'node:test';
import { content, flatWorld } from './fixture.ts';
import { roomFixture } from './room-fixture.ts';
import { Drops } from '../../src/sim/drops.ts';

test('support removal drops an unfocused player, lands with damage, and respects room pause', () => {
  const f = roomFixture();
  try {
    const p = f.state(),
      x = Math.floor(p[0]),
      z = Math.floor(p[2]);
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) f.store.set(x + dx, 73, z + dz, content.defaults.stone);
    p[1] = 74;
    p[4] = 0;
    p[6] = 1;
    f.store.world.player_restore(f.player().slot, p);
    f.room.receive('a', { type: 'focus', epoch: f.player().epoch, active: false }, f.now);
    f.tick(3);
    assert.equal(f.state()[1], 74);
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) f.store.set(x + dx, 73, z + dz, 0);
    f.room.setPaused(true, f.now);
    f.elapse(1000);
    assert.equal(f.state()[1], 74);
    f.room.setPaused(false, f.now);
    f.tick(6);
    assert.ok(f.state()[1] < 74);
    assert.equal(f.state()[12], 1);
    f.tick(90);
    assert.equal(f.state()[1], 64);
    assert.equal(f.player().vitals.view().health, 13);
  } finally {
    f.room.dispose();
  }
});

test('scattered drops differ, merge within limits, allow incompatible overlap, and conserve stacks through restore', () => {
  const world = flatWorld();
  try {
    const drops = new Drops(content.manifest);
    drops.scatter({ itemType: 'stone', count: 2 }, [0, 2, 0], 0);
    drops.scatter({ itemType: 'dirt', count: 3 }, [0, 2, 0], 0);
    assert.notDeepEqual(
      drops.checkpoint(0).entries[0].velocity,
      drops.checkpoint(0).entries[1].velocity,
    );
    const pair = new Drops(content.manifest);
    pair.add({ itemType: 'stone', count: 60 }, [2, 1, 2], 0);
    pair.add({ itemType: 'stone', count: 10 }, [2, 1, 2], 0);
    pair.add({ itemType: 'dirt', count: 3 }, [2, 1, 2], 0);
    for (let tick = 1; tick <= 30; tick++) pair.step(world, tick);
    const entries = pair.checkpoint(30).entries;
    assert.equal(
      entries.filter((d) => d.stack.itemType === 'stone').reduce((n, d) => n + d.stack.count, 0),
      70,
    );
    assert.ok(entries.some((d) => d.stack.count === 64));
    assert.ok(entries.every((d) => d.stack.count <= 64));
    assert.deepEqual(entries[0].position, entries[2].position);
    assert.deepEqual(
      Drops.fromCheckpoint(content.manifest, pair.checkpoint(30)).checkpoint(30),
      pair.checkpoint(30),
    );
  } finally {
    world.free();
  }
});

test('magnet leaves distant drops alone, pulls within 2.7 blocks and reports actual pickups', () => {
  const f = roomFixture();
  try {
    f.tick(3);
    const p = f.state();
    f.room.drops.add(
      { itemType: 'stone', count: 4 },
      [p[0] + 3, p[1] + 0.2, p[2]],
      3,
      null,
      [0, 0, 0],
    );
    f.tick(8);
    assert.equal(
      f.room.drops.nearby(p, 32)[0].position[0],
      p[0] + 3,
      'outside the shorter attraction range',
    );
    const closer = f.state();
    closer[0] += 0.6;
    f.store.world.player_restore(f.player().slot, closer);
    f.tick(8);
    assert.ok(f.room.drops.nearby(p, 32)[0].position[0] < p[0] + 3);
    assert.equal(f.room.inventories.held('a').stack, null);
    f.tick(30);
    assert.equal(f.room.drops.size, 0);
    assert.equal(f.room.inventories.held('a').stack?.count, 4);
    assert.ok(
      f.events.get('a')!.some((e) => 'type' in e && e.type === 'pickup' && e.stack.count === 4),
    );
  } finally {
    f.room.dispose();
  }
});

test('thrower must leave reach before recollecting, including after checkpoint restore', () => {
  let drops = new Drops(content.manifest);
  const id = drops.add({ itemType: 'stone', count: 2 }, [0, 1, 0], 0, 'a');
  drops = Drops.fromCheckpoint(content.manifest, drops.checkpoint(40));
  drops.releaseThrower('a', [0, 1, 0]);
  assert.equal(drops.eligible(id, 'a', 40), false);
  assert.equal(drops.eligible(id, 'b', 40), true);
  drops.releaseThrower('a', [4, 1, 0]);
  assert.equal(drops.eligible(id, 'a', 41), true);
});

test('focused neutral input predicts and authoritatively falls when support is removed', () => {
  const f = roomFixture();
  try {
    f.tick(3);
    const p = f.state(),
      x = Math.floor(p[0]),
      y = Math.floor(p[1]) - 1,
      z = Math.floor(p[2]);
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++)
        for (let dy = 0; dy < 4; dy++) f.store.set(x + dx, y - dy, z + dz, 0);
    f.tick(15);
    assert.ok(f.state()[1] < p[1] - 1);
    assert.equal(f.player().focused, true);
  } finally {
    f.room.dispose();
  }
});
