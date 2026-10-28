import assert from 'node:assert/strict';
import { test } from 'node:test';
import { roomFixture } from './room-fixture.ts';
import { content, flatWorld } from './fixture.ts';
import { exposedToSun } from '../../src/sim/sunlight.ts';
import { DAY_TICKS } from '../../src/shared/environment.ts';
type Fixture = ReturnType<typeof roomFixture>;
function equip(f: Fixture, itemType: string, slot: number, durability: number) {
  f.room.inventories.receive('a', { itemType, count: 1, instance: { durability } });
  const view = f.room.inventories.view('a'),
    index = view.bag.findIndex((s) => s?.itemType === itemType);
  assert.equal(
    f.room.inventories.transact(
      'a',
      {
        kind: 'move',
        from: { area: 'bag', slot: index },
        to: { area: 'equipment', slot },
        count: 1,
        revision: view.revision,
        containerId: null,
        containerRevision: null,
      },
      false,
    ).ok,
    true,
  );
}
test('native ground jump strength shares exact physics, with no airborne re-jump or liquid jump bonus', () => {
  const trace = (power: number, spam = false, water = false) => {
    const world = flatWorld();
    try {
      if (water) for (let y = 1; y <= 4; y++) world.set_block(8, y, 8, content.defaults.water);
      const slot = world.player_add(8.5, 1, 8.5);
      for (let n = 0; n < 30; n++)
        world.player_step(slot, 0, 0, false, false, false, false, 1, 1, 1, 1, 1 / 60);
      const states = [];
      for (let n = 0; n < 60; n++) {
        const jumped = world.player_step(
          slot,
          0,
          0,
          n === 0 || (spam && n >= 8 && n <= 15),
          false,
          false,
          false,
          1,
          1,
          1,
          power,
          1 / 60,
        );
        assert.equal(
          jumped,
          !water && n === 0,
          'only native ground takeoff reports an accepted jump',
        );
        states.push(Array.from(world.player_state(slot)));
      }
      return states;
    } finally {
      world.free();
    }
  };
  const ordinary = trace(1),
    boost = trace(1.6),
    spam = trace(1.6, true);
  assert.ok(Math.max(...ordinary.map((s) => s[1])) < 2.5);
  assert.ok(Math.max(...boost.map((s) => s[1])) > 4);
  assert.deepEqual(spam, boost, 'airborne jump presses cannot add impulses');
  assert.deepEqual(
    trace(1, false, true),
    trace(1.6, false, true),
    'jump power changes no swimming rule',
  );
});
test('owned jump boots break once on native takeoff and rotate the profile while retaining the actual launch velocity', () => {
  const f = roomFixture();
  try {
    f.tick(3);
    equip(f, 'helium_boots', 3, 1);
    f.tick();
    assert.equal(f.player().movement.jump, 1.6);
    const epoch = f.player().epoch,
      ground = f.state()[1];
    f.controls.set('a', { ...f.controls.get('a')!, jump: true });
    f.tick();
    assert.equal(f.room.inventories.view('a').equipment[3], null);
    assert.ok(f.player().epoch > epoch);
    assert.equal(f.baseline('a').movement.jump, 1);
    assert.ok(f.state()[4] > 11);
    f.controls.set('a', { ...f.controls.get('a')!, jump: false });
    let peak = f.state()[1];
    for (let n = 0; n < 40; n++) {
      f.tick();
      peak = Math.max(peak, f.state()[1]);
    }
    assert.ok(peak > ground + 3.1);
    assert.equal(f.player().movement.jump, 1);
  } finally {
    f.room.dispose();
  }
});
test('water introduced between ticks cannot turn a swim press into equipment wear from stale dry-body flags', () => {
  const f = roomFixture();
  try {
    f.tick(3);
    equip(f, 'helium_boots', 3, 1);
    f.tick();
    const body = f.state();
    assert.equal(body[7], 0);
    assert.equal(body[6], 1);
    for (const h of [0, 1, 2])
      f.store.set(
        Math.floor(body[0]),
        Math.floor(body[1]) + h,
        Math.floor(body[2]),
        content.defaults.water,
      );
    f.controls.set('a', { ...f.controls.get('a')!, jump: true });
    f.tick();
    assert.equal(f.state()[7], 1);
    assert.equal(f.room.inventories.view('a').equipment[3]?.instance?.durability, 1);
  } finally {
    f.room.dispose();
  }
});
test('a final-use fall-immunity talisman protects the real landing, wears on prevented damage and cannot protect a second fall', () => {
  const f = roomFixture();
  try {
    f.tick(3);
    equip(f, 'feather_talisman', 2, 1);
    const fall = () => {
      const body = f.state();
      body[1] += 10;
      body[4] = 0;
      body[6] = 0;
      f.store.world.player_restore(f.player().slot, body);
      f.tick(60);
    };
    fall();
    assert.equal(f.player().vitals.view().health, 20);
    assert.equal(f.room.inventories.view('a').equipment[2], null);
    fall();
    assert.equal(f.player().vitals.view().health, 13);
  } finally {
    f.room.dispose();
  }
});
test('selected Swift tool speed is authoritative, ends on selection or break, and cannot affect creative movement', () => {
  for (const mode of ['survival', 'creative'] as const) {
    const f = roomFixture(mode);
    try {
      f.tick(3);
      f.room.inventories.receive('a', {
        itemType: 'swift_pickaxe',
        count: 1,
        instance: { durability: 1 },
      });
      const old = f.player().epoch;
      f.tick();
      assert.equal(f.player().movement.speed, mode === 'survival' ? 1.5 : 1);
      if (mode === 'survival') assert.ok(f.player().epoch > old);
      assert.equal(
        f.room.inventories.strike('a', f.room.inventories.held('a').revision, () => true).ok,
        true,
      );
      f.tick();
      assert.equal(f.player().movement.speed, 1);
      f.room.inventories.receive('a', {
        itemType: 'swift_pickaxe',
        count: 1,
        instance: { durability: 80 },
      });
      f.room.inventories.receive('a', { itemType: 'stick', count: 1 });
      f.tick();
      assert.equal(
        f.room.inventories.transact(
          'a',
          { kind: 'select', slot: 1, revision: f.room.inventories.view('a').revision },
          false,
        ).ok,
        true,
      );
      f.tick();
      assert.equal(f.player().movement.speed, 1);
    } finally {
      f.room.dispose();
    }
  }
});
test('Helios healing uses actual room sunlight, glass/solid occlusion, fixed pauses, owned wear and night rejection', () => {
  const f = roomFixture();
  try {
    f.tick(3);
    equip(f, 'helios_medallion', 0, 2);
    f.player().vitals.damage(4);
    f.player().vitals.effort(16);
    f.room.receive('a', { type: 'focus', epoch: f.player().epoch, active: false }, f.now);
    f.tick(149);
    assert.equal(f.player().vitals.view().health, 16);
    f.room.setPaused(true, f.now);
    assert.equal(f.elapse(10000).steps, 0);
    f.room.setPaused(false, f.now);
    f.tick();
    assert.equal(f.player().vitals.view().health, 17);
    assert.equal(f.room.inventories.view('a').equipment[0]?.instance?.durability, 1);
    const p = f.state(),
      roof = [Math.floor(p[0]), 67, Math.floor(p[2])] as const;
    f.store.set(...roof, content.defaults.stone);
    f.tick(300);
    assert.equal(f.player().vitals.view().health, 17);
    f.store.set(...roof, content.defaults.glass);
    f.tick(150);
    assert.equal(f.player().vitals.view().health, 18);
    assert.equal(f.room.inventories.view('a').equipment[0], null);
    f.tick(150);
    assert.equal(f.player().vitals.view().health, 18);
  } finally {
    f.room.dispose();
  }
  const night = roomFixture('survival', DAY_TICKS / 2);
  try {
    night.tick(3);
    equip(night, 'helios_medallion', 0, 1);
    night.player().vitals.damage(4);
    night.player().vitals.effort(16);
    night.tick(300);
    assert.equal(night.player().vitals.view().health, 16);
    assert.equal(night.room.inventories.view('a').equipment[0]?.instance?.durability, 1);
  } finally {
    night.room.dispose();
  }
});
test('visibility wear uses room ticks, pauses and disconnected time freeze it, and the final owned instance disappears', () => {
  for (const interruption of ['pause', 'disconnect']) {
    const f = roomFixture();
    try {
      f.tick(3);
      equip(f, 'glow_talisman', 0, 1);
      f.tick(899);
      assert.ok(f.room.inventories.view('a').equipment[0]);
      if (interruption === 'pause') {
        f.room.setPaused(true, f.now);
        assert.equal(f.elapse(8000).steps, 0);
        f.room.setPaused(false, f.now);
      } else {
        f.room.disconnect('a', f.now);
        f.elapse(8000);
        f.join();
      }
      assert.ok(f.room.inventories.view('a').equipment[0]);
      f.tick();
      assert.equal(f.room.inventories.view('a').equipment[0], null);
    } finally {
      f.room.dispose();
    }
  }
});
test('native overhead exposure rejects unavailable terrain and liquids, passes transparent glass and respects actual opaque geometry', () => {
  const world = flatWorld();
  try {
    const p = [8.5, 1, 8.5];
    assert.equal(exposedToSun(world, content.manifest, p, 4), true);
    for (const family of ['stone', 'oak_leaves', 'water']) {
      world.set_block(8, 4, 8, content.defaults[family]);
      assert.equal(exposedToSun(world, content.manifest, p, 4), false, family);
    }
    world.set_block(8, 4, 8, content.defaults.glass);
    assert.equal(exposedToSun(world, content.manifest, p, 4), true);
    assert.equal(exposedToSun(world, content.manifest, [100, 1, 100], 4), false);
  } finally {
    world.free();
  }
});
