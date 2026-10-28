import assert from 'node:assert/strict';
import { test } from 'node:test';
import { roomFixture } from './room-fixture.ts';
import { content, flatWorld } from './fixture.ts';
import { blastPlan } from '../../src/sim/blast.ts';
import type { Cell, ClientMessage, ServerMessage } from '../../src/shared/protocol.ts';
type Fixture = ReturnType<typeof roomFixture>;
const rule = content.manifest.behavior.find((b) => b.family === 'tnt')!.explosive!;
const events = (f: Fixture) =>
  f.events
    .get('a')!
    .filter(
      (e): e is Extract<ServerMessage, { type: 'explosion' }> =>
        'type' in e && e.type === 'explosion',
    );
function request(f: Fixture, target: Cell): Extract<ClientMessage, { type: 'ignite' }> {
  return {
    type: 'ignite',
    epoch: f.player().epoch,
    sequence: f.next(),
    inputSequence: f.inputs.get('a')!,
    target,
    revision: f.store.revision(target[0] >> 4, target[2] >> 4),
    inventoryRevision: f.room.inventories.held('a').revision,
  };
}
function prepare() {
  const f = roomFixture();
  f.tick(3);
  const target = f.target('tnt');
  f.aim(target);
  f.room.inventories.receive('a', {
    itemType: 'firestarter',
    count: 1,
    instance: { durability: 1 },
  });
  return { f, target };
}
test('real Wasm ignition wears the last owned tool once, survives replay eviction and freezes only with room time', () => {
  const { f, target } = prepare();
  try {
    const first = request(f, target);
    assert.equal(f.send(first).outcome?.ok, true);
    assert.equal(f.room.inventories.held('a').stack, null);
    assert.equal(f.store.world.get_block(...target), 0);
    assert.equal(f.room.explosives.size, 1);
    assert.equal(f.send(first).status, 'cached');
    for (let n = 0; n < 1030; n++)
      assert.equal(f.send(request(f, target)).outcome?.reason, 'out_of_reach');
    assert.equal(f.send(first).status, 'retired');
    f.tick(20);
    const remaining = f.room.explosives.nearby(f.state(), 48)[0].remaining;
    assert.equal(remaining, 100);
    f.room.setPaused(true, f.now);
    assert.equal(f.elapse(10000).steps, 0);
    assert.equal(f.room.explosives.nearby(f.state(), 48)[0].remaining, remaining);
    f.room.setPaused(false, f.now);
    f.tick(99);
    assert.equal(events(f).length, 0);
    f.tick();
    assert.equal(events(f).length, 1);
    assert.ok(events(f)[0].removed > 0);
    assert.equal(f.room.explosives.size, 0);
    assert.ok(f.room.drops.size > 0);
    f.tick(10);
    assert.equal(events(f).length, 1);
  } finally {
    f.room.dispose();
  }
});
test('chain ignition creates a separate short fuse; revoking explosion permission fizzles that owned body', () => {
  const { f, target } = prepare();
  try {
    const neighbor: Cell = [target[0] + 1, 64, target[2]];
    f.store.set(...neighbor, content.defaults.tnt);
    f.aim(target);
    assert.equal(f.send(request(f, target)).outcome?.ok, true);
    f.tick(120);
    assert.equal(events(f).length, 1);
    assert.equal(f.store.world.get_block(...neighbor), 0);
    const child = f.room.explosives.nearby(f.state(), 48);
    assert.equal(child.length, 1);
    assert.equal(child[0].remaining, 30);
    const drops = f.room.drops.size;
    f.player().capabilities.explosives = false;
    f.tick(29);
    assert.equal(events(f).length, 1);
    f.tick();
    assert.equal(events(f).length, 2);
    assert.equal(events(f)[1].cancelled, true);
    assert.equal(events(f)[1].removed, 0);
    assert.deepEqual(events(f)[1].columns, []);
    assert.equal(f.room.drops.size, drops);
    assert.equal(f.room.explosives.size, 0);
  } finally {
    f.room.dispose();
  }
});
test('due offline TNT waits on unknown owner authority and only an explicit current denial fizzles it', () => {
  const { f, target } = prepare();
  try {
    f.join('viewer');
    f.room.requireOwnerAuthorizations();
    assert.equal(f.send(request(f, target)).outcome?.ok, true);
    f.room.disconnect('a', f.now);
    f.tick(135);
    assert.equal(f.room.explosives.size, 1);
    assert.equal(f.room.explosives.checkpoint(content.manifest).entries[0].remaining, 0);
    assert.deepEqual(f.room.explosives.owners(), ['a']);
    assert.equal(
      (f.events.get('viewer') ?? []).filter(
        (event) => 'type' in event && event.type === 'explosion',
      ).length,
      0,
    );
    f.room.authorizeOwners([['a', null]], f.now + 5000);
    f.tick();
    assert.equal(f.room.explosives.size, 0);
    const explosion = f.events
      .get('viewer')!
      .findLast((event) => 'type' in event && event.type === 'explosion');
    assert.ok(explosion && 'type' in explosion && explosion.type === 'explosion');
    assert.equal(explosion.cancelled, true);
    assert.equal(explosion.removed, 0);
    assert.deepEqual(explosion.columns, []);
  } finally {
    f.room.dispose();
  }
});

test('expired owner proof cannot fall back to connected capabilities; a fresh private proof resumes exactly one due blast', () => {
  const { f, target } = prepare();
  try {
    const owner = {
      id: 'a',
      role: 'participant' as const,
      capabilities: { ...f.player().capabilities },
    };
    f.room.requireOwnerAuthorizations();
    assert.equal(f.send(request(f, target)).outcome?.ok, true);
    f.room.authorizeOwners([['a', owner]], f.now + 50);
    owner.capabilities.explosives = false;
    f.tick(125);
    assert.equal(events(f).length, 0);
    assert.equal(f.room.explosives.size, 1);
    assert.equal(f.room.explosives.checkpoint(content.manifest).entries[0].remaining, 0);
    f.room.authorizeOwners(
      [['a', { ...owner, capabilities: { ...owner.capabilities, explosives: true } }]],
      f.now + 5000,
    );
    f.tick();
    assert.equal(events(f).length, 1);
    assert.equal(events(f)[0].cancelled, false);
    assert.ok(events(f)[0].removed > 0);
    assert.equal(f.room.explosives.size, 0);
    f.tick(5);
    assert.equal(events(f).length, 1);
  } finally {
    f.room.dispose();
  }
});

test('fresh passive owner eligibility cannot override a connected observer participation choice', () => {
  const { f, target } = prepare();
  try {
    const owner = {
      id: 'a',
      role: 'participant' as const,
      capabilities: { ...f.player().capabilities },
    };
    f.room.requireOwnerAuthorizations();
    assert.equal(f.send(request(f, target)).outcome?.ok, true);
    f.room.authorizeOwners([['a', owner]], f.now + 5000);
    f.join('a', 'observer');
    f.tick(120);
    assert.equal(events(f).length, 1);
    assert.equal(events(f)[0].cancelled, true);
    assert.equal(events(f)[0].removed, 0);
    assert.equal(f.room.explosives.size, 0);
  } finally {
    f.room.dispose();
  }
});

test('ignition rejects stale inventory/terrain, missing permissions, occluded aim and unowned ignition tools', () => {
  const { f, target } = prepare();
  try {
    const current = request(f, target);
    assert.equal(
      f.send({ ...current, inventoryRevision: current.inventoryRevision - 1 }).outcome?.reason,
      'conflict',
    );
    assert.equal(
      f.send({ ...request(f, target), revision: current.revision - 1 }).outcome?.reason,
      'conflict',
    );
    f.player().capabilities.explosives = false;
    assert.equal(f.send(request(f, target)).outcome?.reason, 'forbidden');
    f.player().capabilities.explosives = true;
    f.player().capabilities.build = false;
    assert.equal(f.send(request(f, target)).outcome?.reason, 'forbidden');
    f.player().capabilities.build = true;
    const wall: Cell = [target[0], 65, target[2] + 1];
    f.store.set(...wall, content.defaults.stone);
    assert.equal(f.send(request(f, target)).outcome?.reason, 'out_of_reach');
    f.store.set(...wall, 0);
    assert.equal(
      f.room.inventories.drop('a', 0, 1, f.room.inventories.held('a').revision, () => {}).ok,
      true,
    );
    assert.equal(f.send(request(f, target)).outcome?.reason, 'igniter_required');
    assert.equal(f.room.explosives.size, 0);
    assert.equal(f.store.world.get_block(...target), content.defaults.tnt);
  } finally {
    f.room.dispose();
  }
});
test('blast planning uses native partial shapes, material resistance, wet shielding and unbreakable cells', () => {
  const world = flatWorld();
  try {
    const origin = [8.4, 2.75, 8.5],
      target: Cell = [10, 2, 8],
      wall: Cell = [9, 2, 8];
    world.set_block(...target, content.defaults.dirt);
    const includes = () =>
      blastPlan(world, content.manifest, origin, 3).some(
        (b) => b.cell.join(',') === target.join(','),
      );
    assert.equal(includes(), true);
    world.set_block(...wall, content.defaults.water);
    assert.equal(includes(), false);
    world.set_block(...wall, content.defaults.bedrock);
    assert.equal(includes(), false);
    assert.ok(
      !blastPlan(world, content.manifest, origin, 3).some(
        (b) => b.state === content.defaults.bedrock,
      ),
    );
    world.set_block(...wall, content.defaults.stone_slab);
    assert.equal(includes(), true, 'ray passes above lower slab');
    world.set_block(...wall, content.states['stone_slab[half=top]']);
    assert.equal(includes(), false, 'native top slab intersects ray');
    world.set_block(...wall, content.defaults.stone);
    assert.equal(includes(), false, 'stone spends more blast energy');
    world.set_block(...wall, content.defaults.dirt);
    assert.equal(includes(), true, 'softer dirt permits the remaining energy');
  } finally {
    world.free();
  }
});
test('blast terrain batches preserve high states across columns and reject an invalid suffix without partial mutation', () => {
  const f = roomFixture();
  try {
    for (const x of [0, 1]) f.store.world.insert_column(x, 0, f.store.generator.generate(x, 0));
    const a: Cell = [15, 65, 0],
      b: Cell = [16, 65, 0];
    for (const cell of [a, b]) f.store.set(...cell, content.defaults.test_299);
    const revisionA = f.store.revision(0, 0),
      revisionB = f.store.revision(1, 0);
    assert.equal(f.store.clearMany([a, b, [1000, 65, 0]]), null);
    assert.equal(f.store.world.get_block(...a), content.defaults.test_299);
    assert.equal(f.store.world.get_block(...b), content.defaults.test_299);
    const patches = f.store.clearMany([a, b])!;
    assert.equal(patches.length, 2);
    assert.equal(f.store.revision(0, 0), revisionA + 1);
    assert.equal(f.store.revision(1, 0), revisionB + 1);
    assert.equal(f.store.world.get_block(...a), 0);
    assert.equal(f.store.world.get_block(...b), 0);
  } finally {
    f.room.dispose();
  }
});
test('due work is scheduled in bounded tick batches without limiting primed body admission and survives owner disconnect', () => {
  const f = roomFixture();
  try {
    f.tick(3);
    const p = f.state();
    for (let n = 0; n < 3; n++)
      f.room.explosives.add('a', content.defaults.tnt, [p[0] + 3, 64.05, p[2]], rule, 30);
    assert.equal(f.room.explosives.size, 3);
    f.room.disconnect('a', f.now);
    f.tick(30);
    assert.equal(f.room.explosives.size, 1);
    f.tick();
    assert.equal(f.room.explosives.size, 0);
  } finally {
    f.room.dispose();
  }
});
test('actor damage samples pre-blast geometry, preserves frozen bodies and consumes armor on an accepted hit', () => {
  for (const shield of ['wall', 'equipment', 'none', 'optout'] as const) {
    const f = roomFixture();
    try {
      f.join('b');
      f.tick(3);
      f.player().capabilities.combat = true;
      const a = f.state(),
        b = f.state('b'),
        center: [number, number, number] = [a[0], 64.05, a[2] - 3];
      b[0] = center[0] + 3;
      b[1] = 64.005;
      b[2] = center[2];
      b[3] = b[4] = b[5] = 0;
      f.store.world.player_restore(f.player('b').slot, b);
      f.room.receive('b', { type: 'focus', epoch: f.player('b').epoch, active: false }, f.now);
      const wall: Cell = [Math.floor(center[0]) + 1, 64, Math.floor(center[2])];
      if (shield === 'wall')
        for (let h = 0; h < 3; h++)
          f.store.set(wall[0], wall[1] + h, wall[2], content.defaults.dirt);
      if (shield === 'equipment') {
        f.room.inventories.receive('b', {
          itemType: 'heavy_shield',
          count: 1,
          instance: { durability: 1 },
        });
        assert.equal(
          f.room.inventories.transact(
            'b',
            {
              kind: 'move',
              from: { area: 'bag', slot: 0 },
              to: { area: 'equipment', slot: 4 },
              count: 1,
              revision: f.room.inventories.view('b').revision,
              containerId: null,
              containerRevision: null,
            },
            false,
          ).ok,
          true,
        );
      }
      if (shield === 'optout') f.player('b').capabilities.combat = false;
      f.room.explosives.add('a', content.defaults.tnt, center, rule, 30);
      f.tick(29);
      const before = f.state('b'),
        epoch = f.player('b').epoch;
      f.tick();
      const after = f.state('b'),
        health = f.player('b').vitals.view().health;
      if (shield === 'wall' || shield === 'optout') {
        assert.equal(health, 20);
        assert.equal(f.player('b').epoch, epoch);
      } else {
        assert.equal(health, shield === 'equipment' ? 15 : 11);
        assert.ok(f.player('b').epoch > epoch);
        assert.equal(f.baseline('b').reason, 'damage');
      }
      assert.deepEqual(
        after.subarray(0, 6),
        before.subarray(0, 6),
        'inventory freeze never receives a movement impulse',
      );
      if (shield === 'wall')
        assert.equal(
          f.store.world.get_block(...wall),
          0,
          'the shielded wall was removed only after damage exposure was evaluated',
        );
      if (shield === 'equipment') assert.equal(f.room.inventories.view('b').equipment[4], null);
    } finally {
      f.room.dispose();
    }
  }
});
test('a blast drains a shared chest once, closes every viewer and rejects the old chest incarnation', () => {
  const f = roomFixture();
  try {
    f.join('b');
    f.tick(3);
    f.player().capabilities.combat = false;
    const a = f.state(),
      cell: Cell = [Math.floor(a[0]), 64, Math.floor(a[2]) - 3];
    f.store.set(...cell, content.defaults.chest);
    for (const id of ['a', 'b'])
      assert.equal(f.room.inventories.transact(id, { kind: 'open', target: cell }, false).ok, true);
    f.room.inventories.receive('b', { itemType: 'stone', count: 5 });
    const view = f.room.inventories.view('b'),
      old = view.container!;
    assert.equal(
      f.room.inventories.transact(
        'b',
        {
          kind: 'move',
          from: { area: 'bag', slot: 0 },
          to: { area: 'container', slot: 0 },
          count: 5,
          revision: view.revision,
          containerId: old.id,
          containerRevision: old.revision,
        },
        false,
      ).ok,
      true,
    );
    f.room.explosives.add(
      'a',
      content.defaults.tnt,
      [cell[0] + 1.5, 64.05, cell[2] + 0.5],
      rule,
      30,
    );
    f.tick(30);
    assert.equal(f.store.world.get_block(...cell), 0);
    for (const id of ['a', 'b']) assert.equal(f.room.inventories.view(id).container, null);
    const drops = f.room.drops.nearby([cell[0], 64, cell[2]], 48);
    assert.equal(
      drops.filter((d) => d.stack.itemType === 'stone').reduce((n, d) => n + d.stack.count, 0),
      5,
    );
    assert.equal(
      drops.filter((d) => d.stack.itemType === 'chest').reduce((n, d) => n + d.stack.count, 0),
      1,
    );
    f.store.set(...cell, content.defaults.chest);
    assert.equal(f.room.inventories.transact('b', { kind: 'open', target: cell }, false).ok, true);
    const next = f.room.inventories.view('b');
    assert.notEqual(next.container!.id, old.id);
    assert.equal(
      f.room.inventories.transact(
        'b',
        {
          kind: 'move',
          from: { area: 'container', slot: 0 },
          to: { area: 'bag', slot: 0 },
          count: 5,
          revision: next.revision,
          containerId: old.id,
          containerRevision: 1,
        },
        false,
      ).ok,
      false,
    );
    f.tick(10);
    assert.equal(events(f).length, 1);
    assert.ok(f.room.inventories.view('b').bag.every((s) => !s));
  } finally {
    f.room.dispose();
  }
});
