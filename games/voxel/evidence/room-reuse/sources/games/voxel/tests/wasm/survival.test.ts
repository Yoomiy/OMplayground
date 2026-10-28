import { roomFixture as fixture } from './room-fixture.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { engine, content, flatWorld } from './fixture.ts';
import { Drops } from '../../src/sim/drops.ts';
import { NEUTRAL } from '../../src/shared/input.ts';
import type { ClientMessage, ServerMessage, Cell } from '../../src/shared/protocol.ts';
import type { ChunkFrame } from '../../src/shared/chunk-wire.ts';
import { DROP_LIFETIME_TICKS } from '../../src/shared/gameplay.ts';
test('authoritative native falls apply damage, equipped perks rotate prediction epoch and final-use boots break once', () => {
  for (const boots of [false, true]) {
    const f = fixture();
    try {
      f.tick(3);
      if (boots) {
        f.room.inventories.receive('a', {
          itemType: 'trail_boots',
          count: 1,
          instance: { durability: 1 },
        });
        const revision = f.room.inventories.view('a').revision;
        assert.equal(
          f.room.inventories.transact(
            'a',
            {
              kind: 'move',
              from: { area: 'bag', slot: 0 },
              to: { area: 'equipment', slot: 3 },
              count: 1,
              revision,
              containerId: null,
              containerRevision: null,
            },
            false,
          ).ok,
          true,
        );
        const epoch = f.player().epoch;
        f.tick();
        assert.ok(f.player().epoch > epoch);
        assert.equal(f.baseline('a').movement.speed, 1.1);
      }
      const p = f.state(),
        ground = p[1];
      p[1] = ground + 10;
      p[4] = 0;
      p[6] = 0;
      f.store.world.player_restore(f.player().slot, p);
      f.tick(60);
      const expected = boots ? 15 : 13;
      assert.equal(f.player().vitals.view().health, expected);
      assert.equal(f.player().vitals.dead, false);
      if (boots) {
        assert.equal(f.room.inventories.view('a').equipment[3], null);
        assert.equal(f.baseline('a').movement.speed, 1);
      }
      const health = f.player().vitals.view().health;
      f.room.disconnect('a', f.now);
      f.join();
      assert.equal(f.player().vitals.view().health, health);
      assert.equal(f.state()[12], 0);
    } finally {
      f.room.dispose();
    }
  }
});
test('inventory freeze leaves actual water/lava hazards running while room pause freezes vitals exactly', () => {
  const f = fixture();
  try {
    f.tick(3);
    f.room.receive('a', { type: 'focus', epoch: f.player().epoch, active: false }, f.now);
    const p = f.state(),
      x = Math.floor(p[0]),
      y = Math.floor(p[1]),
      z = Math.floor(p[2]);
    f.store.set(x, y + 1, z, content.defaults.water);
    f.tick(329);
    assert.equal(f.player().vitals.view().air, 0);
    assert.equal(f.player().vitals.view().health, 18);
    const before = f.player().vitals.view();
    f.room.setPaused(true, f.now);
    assert.equal(f.elapse(10000).steps, 0);
    assert.deepEqual(f.player().vitals.view(), before);
    f.room.setPaused(false, f.now);
    f.store.set(x, y + 1, z, 0);
    f.tick();
    assert.equal(f.player().vitals.view().air, 10);
    f.store.set(x, y, z, content.defaults.lava);
    f.tick(15);
    assert.equal(f.player().vitals.view().health, 14);
    assert.equal(f.state()[12], 1);
  } finally {
    f.room.dispose();
  }
});
test('real lava death drains owned grids/equipment once, rejects dead commands and respawns through fresh collision readiness', () => {
  const f = fixture();
  try {
    f.tick(3);
    f.room.inventories.receive('a', { itemType: 'apple', count: 3 });
    f.room.inventories.receive('a', {
      itemType: 'wooden_pickaxe',
      count: 1,
      instance: { durability: 60 },
    });
    f.room.inventories.transact(
      'a',
      {
        kind: 'move',
        from: { area: 'bag', slot: 0 },
        to: { area: 'craft2', slot: 0 },
        count: 1,
        revision: f.room.inventories.view('a').revision,
        containerId: null,
        containerRevision: null,
      },
      false,
    );
    f.room.receive('a', { type: 'focus', epoch: f.player().epoch, active: false }, f.now);
    const p = f.state(),
      oldEpoch = f.player().epoch;
    f.store.set(Math.floor(p[0]), Math.floor(p[1]), Math.floor(p[2]), content.defaults.lava);
    f.tick(75);
    assert.equal(f.player().vitals.dead, true);
    assert.equal(f.player().phase, 'dead');
    assert.equal(f.state()[12], 1);
    assert.ok(f.player().epoch > oldEpoch);
    const inventory = f.room.inventories.view('a');
    assert.ok(
      [...inventory.bag, ...inventory.craft2, ...inventory.craft3, ...inventory.equipment].every(
        (stack) => !stack,
      ),
    );
    assert.equal(f.room.drops.size, 3);
    f.tick(5);
    assert.equal(f.room.drops.size, 3);
    const deathEpoch = f.player().epoch;
    assert.equal(
      f.send({ type: 'respawn', epoch: oldEpoch, sequence: f.next() }).status,
      'stale_epoch',
    );
    assert.equal(
      f.send({
        type: 'inventory',
        epoch: deathEpoch,
        sequence: f.next(),
        operation: { kind: 'open', target: null },
      }).outcome?.ok,
      false,
    );
    assert.equal(
      f.send({ type: 'respawn', epoch: deathEpoch, sequence: f.next() }).outcome?.ok,
      false,
    );
    f.room.disconnect('a', f.now);
    f.join();
    assert.equal(f.player().phase, 'dead');
    assert.equal(f.room.drops.size, 3);
    f.tick(60);
    f.room.setPaused(true, f.now);
    assert.equal(
      f.send({ type: 'respawn', epoch: f.player().epoch, sequence: f.next() }).outcome?.ok,
      false,
    );
    f.room.setPaused(false, f.now);
    const request = { type: 'respawn' as const, epoch: f.player().epoch, sequence: f.next() };
    assert.equal(f.send(request).outcome?.ok, true);
    assert.equal(f.player().phase, 'preparing');
    assert.equal(f.state()[12], 1);
    assert.equal(f.player().vitals.view().health, 20);
    assert.equal(f.send(request).status, 'stale_epoch');
    f.join();
    assert.equal(f.player().phase, 'playing');
    assert.equal(f.state()[12], 0);
    assert.equal(f.room.drops.size, 3);
  } finally {
    f.room.dispose();
  }
});
test('food transactions replay once across eviction and hunger sprint permission changes use fresh baselines', () => {
  const f = fixture();
  try {
    f.room.inventories.receive('a', { itemType: 'apple', count: 3 });
    f.player().vitals.effort(60);
    f.tick();
    assert.equal(f.baseline('a').movement.sprint, false);
    const revision = f.room.inventories.view('a').revision;
    const request = {
      type: 'inventory' as const,
      epoch: f.player().epoch,
      sequence: f.next(),
      operation: { kind: 'consume' as const, slot: 0, revision },
    };
    assert.equal(f.send(request).outcome?.reason, 'eaten');
    assert.equal(f.send(request).status, 'cached');
    assert.equal(f.player().vitals.view().food, 9);
    assert.equal(f.room.inventories.view('a').bag[0]?.count, 2);
    for (let n = 0; n < 1030; n++)
      f.send({
        type: 'inventory',
        epoch: f.player().epoch,
        sequence: f.next(),
        operation: { kind: 'open', target: null },
      });
    assert.equal(f.send(request).status, 'retired');
    assert.equal(f.player().vitals.view().food, 9);
    assert.equal(f.room.inventories.view('a').bag[0]?.count, 2);
    const epoch = f.player().epoch;
    f.tick();
    assert.ok(f.player().epoch > epoch);
    assert.equal(f.baseline('a').movement.sprint, true);
    f.tick(3600);
    assert.equal(f.player().vitals.view().food, 8);
  } finally {
    f.room.dispose();
  }
});
test('real Wasm mining earns fixed world ticks despite action bursts, ignores unrelated edits and yields one competing pickup', () => {
  const f = fixture();
  try {
    f.join('b');
    const cell = f.target();
    f.aim(cell);
    assert.equal(f.start(cell).outcome?.ok, true);
    for (let n = 0; n < 400; n++) assert.equal(f.start(cell).outcome?.ok, true);
    assert.equal(f.player().mining?.elapsed, 0);
    assert.equal(f.store.world.get_block(...cell), content.defaults.oak_log);
    f.tick(15);
    assert.equal(f.store.world.get_block(...cell), content.defaults.oak_log);
    f.store.set(cell[0] + 2, cell[1], cell[2], content.defaults.stone);
    f.tick(15);
    assert.equal(f.store.world.get_block(...cell), 0);
    assert.equal(f.room.drops.size, 1);
    const first = f.room.drops.nearby([cell[0], cell[1], cell[2]], 6)[0];
    assert.equal(first.stack.itemType, 'oak_log');
    for (const id of ['a', 'b']) f.controls.set(id, { ...NEUTRAL, z: -1 });
    f.tick(20);
    const total = ['a', 'b'].reduce(
      (sum, id) =>
        sum +
        f.room.inventories
          .view(id)
          .bag.reduce((n, stack) => n + (stack?.itemType === 'oak_log' ? stack.count : 0), 0),
      0,
    );
    assert.equal(total, 1);
    assert.equal(f.room.drops.size, 0);
    const observerEvents = f.events.get('b')!;
    assert.ok(
      observerEvents.some(
        (e) => 'type' in e && e.type === 'drops' && e.upsert.some((drop) => drop.id === first.id),
      ),
    );
  } finally {
    f.room.dispose();
  }
});
test('mining cancels on stale input, replacement at the same cell, focus epoch and changed owned tool', () => {
  const f = fixture();
  try {
    const cell = f.target();
    f.aim(cell);
    f.start(cell);
    f.tick(5);
    f.elapse(200);
    assert.equal(f.player().mining, null);
    assert.equal(f.room.drops.size, 0);
    f.aim(cell);
    f.start(cell);
    f.tick(5);
    f.store.set(...cell, 0);
    f.store.set(...cell, content.defaults.oak_log);
    f.tick();
    assert.equal(f.player().mining, null);
    assert.equal(f.store.world.get_block(...cell), content.defaults.oak_log);
    f.start(cell);
    f.tick(5);
    const epoch = f.player().epoch;
    f.send({ type: 'focus', epoch, active: false });
    assert.equal(f.player().mining, null);
    assert.ok(f.player().epoch > epoch);
    f.tick(40);
    assert.equal(f.room.drops.size, 0);
    f.send({ type: 'focus', epoch: f.player().epoch, active: true });
    f.aim(cell);
    f.room.inventories.transact(
      'a',
      { kind: 'give', itemType: 'wooden_axe', count: 1, revision: 0 },
      true,
    );
    f.start(cell);
    f.tick(3);
    f.room.inventories.transact(
      'a',
      {
        kind: 'move',
        from: { area: 'bag', slot: 0 },
        to: { area: 'bag', slot: 1 },
        count: 1,
        revision: 1,
        containerId: null,
        containerRevision: null,
      },
      false,
    );
    f.tick();
    assert.equal(f.player().mining, null);
    assert.equal(f.room.inventories.view('a').bag[1]?.instance?.durability, 60);
    assert.equal(f.room.drops.size, 0);
  } finally {
    f.room.dispose();
  }
});
test('survival forbids catalog/flight/instant removal, consumes placement atomically and cannot replay a dropped stack', () => {
  const f = fixture();
  try {
    assert.equal(
      f.send({
        type: 'inventory',
        epoch: f.player().epoch,
        sequence: f.next(),
        operation: { kind: 'give', itemType: 'dirt', count: 64, revision: 0 },
      }).outcome?.reason,
      'forbidden',
    );
    assert.equal(
      f.send({ type: 'flight', epoch: f.player().epoch, sequence: f.next(), on: true }).outcome
        ?.reason,
      'forbidden',
    );
    const p = f.state();
    f.aim([Math.floor(p[0]), 63, Math.floor(p[2]) - 3]);
    const c = f.player().controls,
      s = f.state(),
      cos = Math.cos(c.pitch),
      hit = f.store.world.raycast(
        s[0],
        s[1] + 1.62,
        s[2],
        Math.sin(c.yaw) * cos,
        Math.sin(c.pitch),
        -Math.cos(c.yaw) * cos,
        6,
      );
    assert.ok(hit[0]);
    const target: Cell = [hit[1], hit[2], hit[3]],
      destination: Cell = [hit[1] + hit[4], hit[2] + hit[5], hit[3] + hit[6]];
    const action: Extract<ClientMessage, { type: 'action' }> = {
      type: 'action',
      epoch: f.player().epoch,
      sequence: f.next(),
      inputSequence: f.inputs.get('a')!,
      kind: 'remove',
      target,
      state: 0,
      inventoryRevision: 0,
      revisions: [
        {
          x: target[0] >> 4,
          z: target[2] >> 4,
          revision: f.store.revision(target[0] >> 4, target[2] >> 4),
        },
      ],
    };
    assert.equal(f.send(action).outcome?.reason, 'mine_required');
    f.room.inventories.transact(
      'a',
      { kind: 'give', itemType: 'dirt', count: 1, revision: 0 },
      true,
    );
    const place = {
      ...action,
      kind: 'place' as const,
      state: content.defaults.dirt,
      sequence: f.next(),
    };
    assert.equal(f.send(place).outcome?.reason, 'conflict');
    assert.equal(f.room.inventories.held('a').stack?.count, 1);
    const valid = { ...place, sequence: f.next(), inventoryRevision: 1 };
    assert.equal(f.send(valid).outcome?.ok, true);
    assert.equal(f.store.world.get_block(...destination), content.defaults.dirt);
    assert.equal(f.room.inventories.held('a').stack, null);
    assert.equal(f.send(valid).status, 'cached');
    for (let n = 0; n < 140; n++)
      f.send({ type: 'flight', epoch: f.player().epoch, sequence: f.next(), on: true });
    assert.equal(f.send(valid).status, 'retired');
    const revision = f.room.inventories.held('a').revision;
    f.room.inventories.transact('a', { kind: 'give', itemType: 'stone', count: 8, revision }, true);
    const drop: Extract<ClientMessage, { type: 'inventory' }> = {
      type: 'inventory',
      epoch: f.player().epoch,
      sequence: f.next(),
      operation: { kind: 'drop', slot: 0, count: 3, revision: revision + 1 },
    };
    assert.equal(f.send(drop).outcome?.ok, true);
    assert.equal(f.room.inventories.held('a').stack?.count, 5);
    assert.equal(f.room.drops.size, 1);
    assert.equal(f.send(drop).status, 'cached');
    assert.equal(f.room.drops.size, 1);
    f.tick(45);
    assert.equal(f.room.drops.size, 0);
    assert.equal(f.room.inventories.held('a').stack?.count, 8);
    assert.equal(f.send(drop).status, 'cached');
    assert.equal(f.room.drops.size, 0);
    assert.equal(f.room.inventories.held('a').stack?.count, 8);
  } finally {
    f.room.dispose();
  }
});
test('real engine enforces tool requirements, wears the final tool once and prevents mining completion during room pause', () => {
  const f = fixture();
  try {
    const cell = f.target('stone');
    f.aim(cell);
    assert.equal(f.start(cell).outcome?.reason, 'tool_required');
    f.room.inventories.transact(
      'a',
      { kind: 'give', itemType: 'wooden_pickaxe', count: 1, revision: 0 },
      true,
    );
    for (let n = 0; n < 59; n++) {
      const held = f.room.inventories.held('a');
      f.room.inventories.mine('a', held.slot, held.stack, () => true);
    }
    f.start(cell);
    f.tick(10);
    f.room.setPaused(true, f.now);
    const before = f.store.world.get_block(...cell);
    assert.equal(f.elapse(100000).steps, 0);
    assert.equal(f.room.drops.size, 0);
    assert.equal(f.store.world.get_block(...cell), before);
    f.room.setPaused(false, f.now);
    f.send({ type: 'focus', epoch: f.player().epoch, active: true });
    f.aim(cell);
    f.start(cell);
    f.tick(14);
    assert.equal(f.store.world.get_block(...cell), content.defaults.stone);
    f.tick();
    assert.equal(f.store.world.get_block(...cell), 0);
    assert.equal(f.room.inventories.held('a').stack, null);
    assert.equal(f.room.drops.size, 1);
  } finally {
    f.room.dispose();
  }
});
test('drop pickups obey solid occlusion and capacity; pause freezes expiry and small-body sweeps match slab collision', () => {
  const f = fixture();
  try {
    const p = f.state(),
      x = Math.floor(p[0]),
      z = Math.floor(p[2]);
    f.store.set(x + 1, 64, z, content.defaults.stone);
    f.store.set(x + 1, 65, z, content.defaults.stone);
    f.room.drops.add({ itemType: 'stone', count: 5 }, [p[0] + 1.5, 64.2, p[2]], 0);
    f.tick(12);
    assert.equal(f.room.drops.size, 1);
    assert.equal(f.room.inventories.held('a').stack, null);
    f.room.inventories.transact(
      'a',
      { kind: 'give', itemType: 'wooden_pickaxe', count: 35, revision: 0 },
      true,
    );
    f.room.inventories.transact(
      'a',
      { kind: 'give', itemType: 'stone', count: 63, revision: 1 },
      true,
    );
    f.store.set(x + 1, 64, z, 0);
    f.store.set(x + 1, 65, z, 0);
    f.tick(3);
    assert.equal(f.room.inventories.view('a').bag[35]?.count, 64);
    assert.equal(f.room.drops.nearby(p, 5)[0].stack.count, 4);
    f.room.setPaused(true, f.now);
    f.elapse(1e6);
    assert.equal(f.room.drops.size, 1);
    f.room.setPaused(false, f.now);
    f.tick();
    assert.equal(f.room.drops.size, 1);
  } finally {
    f.room.dispose();
  }
  const world = flatWorld();
  try {
    world.set_block(2, 1, 2, content.defaults.z_slab);
    let body = world.sweep_body(2.5, 3, 2.5, 0, -1, 0, 0.125, 0.25);
    body = world.sweep_body(body[0], body[1], body[2], 0, -1, 0, 0.125, 0.25);
    assert.ok(Math.abs(body[1] - 1.5) < 0.001);
    assert.equal(body[4], 1);
    assert.throws(() => world.sweep_body(0, 2, 0, 2, 0, 0, 0.125, 0.25), /invalid body/);
    const drops = new Drops(content.manifest);
    drops.add({ itemType: 'dirt', count: 1 }, [0.5, 2, 0.5], 0);
    drops.step(world, DROP_LIFETIME_TICKS);
    assert.equal(drops.size, 0);
    drops.dispose();
  } finally {
    world.free();
  }
});
test('read-only participants cannot collect drops or keep a shared container view after capability revocation', () => {
  const f = fixture();
  try {
    f.player().capabilities.build = false;
    const p = f.state();
    f.room.drops.add({ itemType: 'dirt', count: 1 }, [p[0], p[1] + 0.2, p[2]], 0);
    f.tick(12);
    assert.equal(f.room.drops.size, 1);
    assert.ok(f.room.inventories.view('a').bag.every((stack) => stack === null));
    f.player().capabilities.build = true;
    f.tick(3);
    assert.equal(f.room.drops.size, 0);
    assert.equal(f.room.inventories.held('a').stack?.itemType, 'dirt');
    const miningCell = f.target();
    f.aim(miningCell);
    f.start(miningCell);
    f.tick(3);
    f.player().capabilities.build = false;
    f.tick(31);
    assert.equal(f.player().mining, null);
    assert.equal(f.store.world.get_block(...miningCell), content.defaults.oak_log);
    assert.equal(f.room.drops.size, 0);
    f.player().capabilities.build = true;
    const cell = f.target('chest');
    f.aim(cell);
    f.room.inventories.transact('a', { kind: 'open', target: cell }, false);
    assert.equal(f.room.inventories.view('a').station, 'container');
    f.player().capabilities.build = false;
    f.tick(6);
    assert.equal(f.room.inventories.view('a').station, 'personal');
  } finally {
    f.room.dispose();
  }
});
test('two miners racing one block commit one drop and one tool wear, including cached replay after completion', () => {
  const f = fixture();
  try {
    f.join('b');
    const cell = f.target();
    for (const id of ['a', 'b'])
      f.room.inventories.transact(
        id,
        { kind: 'give', itemType: 'wooden_axe', count: 1, revision: 0 },
        true,
      );
    f.aim(cell, 'a');
    f.aim(cell, 'b');
    const original: Extract<ClientMessage, { type: 'mining' }> = {
      type: 'mining',
      epoch: f.player().epoch,
      sequence: f.next(),
      inputSequence: f.inputs.get('a')!,
      target: cell,
      revision: f.store.revision(cell[0] >> 4, cell[2] >> 4),
      inventoryRevision: 1,
    };
    assert.equal(f.send(original).outcome?.ok, true);
    assert.equal(f.start(cell, 'b').outcome?.ok, true);
    f.tick(10);
    assert.equal(f.store.world.get_block(...cell), 0);
    assert.equal(f.room.drops.size, 1);
    const durability = ['a', 'b']
      .map((id) => f.room.inventories.held(id).stack?.instance?.durability)
      .sort();
    assert.deepEqual(durability, [59, 60]);
    assert.equal(f.send(original).status, 'cached');
    assert.equal(f.room.drops.size, 1);
    assert.deepEqual(
      ['a', 'b'].map((id) => f.room.inventories.held(id).stack?.instance?.durability).sort(),
      [59, 60],
    );
  } finally {
    f.room.dispose();
  }
});

test('fall history survives focus and room pause, vitals remain private, and fresh spawn after reservation expiry starts a new fall segment', () => {
  const f = fixture();
  try {
    f.join('b');
    f.tick(3);
    const p = f.state();
    p[1] += 10;
    p[6] = 0;
    p[4] = 0;
    f.store.world.player_restore(f.player().slot, p);
    f.tick(8);
    assert.equal(f.state()[6], 0);
    f.room.receive('a', { type: 'focus', epoch: f.player().epoch, active: false }, f.now);
    const frozen = f.state()[1];
    f.tick(120);
    assert.equal(f.state()[1], frozen);
    assert.equal(f.player().vitals.view().health, 20);
    f.room.setPaused(true, f.now);
    f.elapse(10000);
    f.room.setPaused(false, f.now);
    f.room.receive('a', { type: 'focus', epoch: f.player().epoch, active: true }, f.now);
    f.tick(60);
    assert.equal(f.player().vitals.view().health, 13);
    assert.ok(
      f.events
        .get('b')!
        .every((e) => !('type' in e) || e.type !== 'vitals' || e.view.health === 20),
    );
    const again = f.state();
    again[1] += 35;
    again[6] = 0;
    again[4] = 0;
    f.store.world.player_restore(f.player().slot, again);
    f.tick();
    f.room.disconnect('a', f.now);
    f.elapse(31000);
    assert.equal(f.room.actors.has('a'), false);
    f.join();
    f.tick(30);
    assert.equal(f.player().vitals.view().health, 13);
    assert.equal(f.player().phase, 'playing');
  } finally {
    f.room.dispose();
  }
});
