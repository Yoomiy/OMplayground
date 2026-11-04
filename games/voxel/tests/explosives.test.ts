import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorldStore } from '../src/sim/world-store.ts';
import { Explosives } from '../src/sim/explosives.ts';
import { Inventories } from '../src/sim/inventory.ts';
import { compileContent } from '../tools/compile-content.ts';
import { source } from '../content/index.ts';
import { parseClientMessage, parseServerMessage } from '../src/shared/protocol.ts';
import type { WorldPort, GeneratorPort } from '../src/shared/engine-port.ts';
test('blast batch validates before mutation, rolls back a native failure and stamps one revision per affected column', () => {
  const cells = new Map([
    ['0,65,0', 1],
    ['1,65,0', 2],
    ['16,65,0', 3],
  ]);
  let writes = 0,
    fail = 2;
  const world = {
    get_block: (x: number, y: number, z: number) => cells.get(`${x},${y},${z}`) ?? 0,
    has_column: () => true,
    set_block: (x: number, y: number, z: number, state: number) => {
      if (++writes === fail) return false;
      cells.set(`${x},${y},${z}`, state);
      return true;
    },
  } as unknown as WorldPort;
  const store = new WorldStore(world, {} as GeneratorPort),
    before = new Map(cells);
  assert.equal(
    store.clearMany([
      [0, 65, 0],
      [1, 65, 0],
    ]),
    null,
  );
  assert.deepEqual(cells, before);
  assert.equal(store.changed.size, 0);
  writes = 0;
  fail = -1;
  for (const batch of [
    [
      [0, 65, 0],
      [0, 65, 0],
    ],
    [
      [0, 65, 0],
      [1000, 65, 0],
    ],
    [
      [0, 65, 0],
      [1.5, 65, 0],
    ],
    [
      [0, 65, 0],
      [1, 66, 0],
    ],
  ])
    assert.equal(store.clearMany(batch as [number, number, number][]), null);
  assert.equal(writes, 0);
  assert.deepEqual(cells, before);
  const patches = store.clearMany([
    [0, 65, 0],
    [1, 65, 0],
    [16, 65, 0],
  ])!;
  assert.equal(patches.length, 2);
  assert.deepEqual(
    patches.map((p) => [p.revision, p.edits.length]),
    [
      [1, 2],
      [1, 1],
    ],
  );
  assert.equal(store.cellRevision(0, 65, 0), 1);
  assert.equal(store.cellRevision(1, 65, 0), 1);
  assert.equal(store.cellRevision(2, 65, 0), 0);
});
test('primed objects count fixed steps through unavailable terrain without empty fallback or client clocks', () => {
  const explosives = new Explosives(),
    world = { has_column: () => false } as unknown as WorldPort,
    rule = { fuse: 120, radius: 3, damage: 18 };
  const id = explosives.add('owner', 1, [0.5, 65, 0.5], rule);
  assert.equal(explosives.nearby([0, 65, 0], 3)[0].remaining, 120);
  for (let i = 0; i < 119; i++) explosives.step(world);
  assert.equal(explosives.due().length, 0);
  assert.equal(explosives.nearby([0, 65, 0], 3)[0].remaining, 1);
  explosives.step(world);
  assert.equal(explosives.due()[0].id, id);
  assert.deepEqual(explosives.due()[0].position, [0.5, 65, 0.5]);
  explosives.remove(id);
  assert.equal(explosives.size, 0);
  assert.throws(() => explosives.add('owner', 65535, [0, 65, 0], rule));
  assert.throws(() => explosives.add('owner', 1, [0, 256, 0], rule));
});
test('ignition requires an owned igniter, commits wear after success and preserves both item and revision on failure', () => {
  const inv = new Inventories(compileContent(source).manifest, {
    station: () => null,
    canUse: () => false,
  });
  inv.join('a');
  assert.equal(inv.ignite('a', 0, false, () => true).reason, 'igniter_required');
  inv.receive('a', { itemType: 'firestarter', count: 1, instance: { durability: 1 } });
  const revision = inv.held('a').revision;
  assert.equal(inv.ignite('a', revision - 1, false, () => true).reason, 'conflict');
  assert.equal(inv.ignite('a', revision, false, () => false).ok, false);
  assert.equal(inv.held('a').stack?.instance?.durability, 1);
  assert.equal(inv.held('a').revision, revision);
  assert.equal(inv.ignite('a', revision, false, () => true).ok, true);
  assert.equal(inv.held('a').stack, null);
  assert.equal(inv.ignite('a', inv.held('a').revision, true, () => true).ok, true);
});
test('explosive wire and content reject forged timers, positions, strength, completions and malformed body batches', () => {
  const request = {
    type: 'ignite',
    epoch: 1,
    sequence: 1,
    inputSequence: 2,
    target: [0, 65, 0],
    revision: 0,
    inventoryRevision: 0,
  };
  assert.ok(parseClientMessage(JSON.stringify(request)));
  for (const extra of [
    { fuse: 0 },
    { damage: 100 },
    { position: [0, 65, 0] },
    { radius: 100 },
    { target: [0, 256, 0] },
  ])
    assert.equal(parseClientMessage(JSON.stringify({ ...request, ...extra })), null);
  assert.equal(parseClientMessage(JSON.stringify({ type: 'detonate', id: 'tnt-1' })), null);
  const body = {
    id: 'tnt-1',
    revision: 0,
    state: 1,
    position: [0.5, 65, 0.5],
    remaining: 120,
    total: 120,
  };
  assert.ok(
    parseServerMessage(
      JSON.stringify({ type: 'explosives', reset: true, upsert: [body], removed: [] }),
    ),
  );
  for (const patch of [
    { remaining: 121 },
    { total: 0 },
    { state: 65535 },
    { position: [NaN, 65, 0] },
  ])
    assert.equal(
      parseServerMessage(
        JSON.stringify({
          type: 'explosives',
          reset: true,
          upsert: [{ ...body, ...patch }],
          removed: [],
        }),
      ),
      null,
    );
  const event = {
    type: 'explosion',
    sequence: 1,
    id: 'tnt-1',
    position: [0.5, 65, 0.5],
    radius: 3,
    removed: 4,
    cancelled: false,
    columns: [{ x: 0, z: 0, revision: 1 }],
  };
  assert.ok(parseServerMessage(JSON.stringify(event)));
  assert.equal(parseServerMessage(JSON.stringify({ ...event, cancelled: true })), null);
  const tnt = source.blocks.find((block) => block.family === 'tnt')!;
  for (const explosive of [
    { fuse: 0, radius: 3, damage: 18 },
    { fuse: 120, radius: 100, damage: 18 },
    { fuse: 120, radius: 3, damage: 100 },
  ])
    assert.throws(
      () =>
        compileContent({
          ...source,
          blocks: source.blocks.map((block) => (block === tnt ? { ...block, explosive } : block)),
        }),
      /explosive/,
    );
});
