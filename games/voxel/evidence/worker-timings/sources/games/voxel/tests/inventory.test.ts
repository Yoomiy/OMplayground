import assert from 'node:assert/strict';
import { test } from 'node:test';
import { source } from '../content/index.ts';
import { compileContent } from '../tools/compile-content.ts';
import { Inventories } from '../src/sim/inventory.ts';
import { matchRecipe, validStack, makeStack, isInventoryView } from '../src/shared/inventory.ts';
import type { InventoryArea, InventoryCommand } from '../src/shared/inventory.ts';
import { parseClientMessage, parseServerMessage } from '../src/shared/protocol.ts';
import type { Cell } from '../src/shared/protocol.ts';

const content = compileContent(source).manifest;
const table: Cell = [1, 64, 1],
  chest: Cell = [2, 64, 1];
function fixture() {
  let reachable = true;
  const blocks = new Map<string, 'workbench' | 'container'>([
    [table.join(','), 'workbench'],
    [chest.join(','), 'container'],
  ]);
  const inventories = new Inventories(content, {
    station: (cell) => blocks.get(cell.join(',')) ?? null,
    canUse: () => reachable,
  });
  inventories.join('a');
  inventories.join('b');
  const view = (id = 'a') => inventories.view(id);
  const run = (operation: InventoryCommand, id = 'a', give = true) =>
    inventories.transact(id, operation, give);
  const give = (itemType: string, count: number, id = 'a') =>
    run({ kind: 'give', itemType, count, revision: view(id).revision }, id);
  const move = (
    from: InventoryArea,
    fromSlot: number,
    to: InventoryArea,
    toSlot: number,
    count: number,
    id = 'a',
  ) =>
    run(
      {
        kind: 'move',
        from: { area: from, slot: fromSlot },
        to: { area: to, slot: toSlot },
        count,
        revision: view(id).revision,
        containerId: view(id).container?.id ?? null,
        containerRevision: view(id).container?.revision ?? null,
      },
      id,
    );
  return {
    inventories,
    blocks,
    view,
    run,
    give,
    move,
    setReachable: (value: boolean) => {
      reachable = value;
    },
  };
}
test('stack instance validation rejects forged counts/metadata and compiler enforces equipment/durable outputs', () => {
  const items = new Map(content.items.map((item) => [item.itemType, item]));
  for (const value of [
    { itemType: 'stone', count: 65 },
    { itemType: 'stone', count: 1, instance: { durability: 1 } },
    { itemType: 'wooden_pickaxe', count: 1 },
    { itemType: 'wooden_pickaxe', count: 2, instance: { durability: 60 } },
    { itemType: 'wooden_pickaxe', count: 1, instance: { durability: 61 } },
    { itemType: 'wooden_pickaxe', count: 1, instance: { durability: 1, enchantment: 99 } },
    { itemType: 'stone', count: Infinity },
    { itemType: 'missing', count: 1 },
  ])
    assert.equal(validStack(value, items), false, JSON.stringify(value));
  assert.deepEqual(makeStack(items.get('wooden_pickaxe')!, 1), {
    itemType: 'wooden_pickaxe',
    count: 1,
    instance: { durability: 60 },
  });
  assert.throws(
    () =>
      compileContent({
        ...source,
        recipes: [
          ...source.recipes,
          {
            key: 'bad_tool',
            size: 2,
            ingredients: ['stone', null, null, null],
            result: { itemType: 'wooden_pickaxe', count: 1 },
          },
        ],
      }),
    /recipe stack/,
  );
  assert.throws(
    () =>
      compileContent({
        ...source,
        items: [
          ...source.items,
          { itemType: 'bad_hat', labelKey: 'bad', maxStack: 64, equipment: 'head' },
        ],
      }),
    /equipment/,
  );
});
test('split/merge/swap/equip conserve owned items, reject partial overflow, and snapshots cannot mutate authority', () => {
  const f = fixture();
  assert.equal(f.give('stone', 64).ok, true);
  assert.equal(f.move('bag', 0, 'bag', 1, 7).ok, true);
  assert.deepEqual(f.view().bag.slice(0, 2), [
    { itemType: 'stone', count: 57 },
    { itemType: 'stone', count: 7 },
  ]);
  const previous = f.view();
  assert.equal(f.move('bag', 0, 'bag', 1, 58).ok, false);
  assert.deepEqual(f.view(), previous);
  assert.equal(f.give('trail_boots', 1).ok, true);
  assert.equal(f.move('bag', 2, 'equipment', 0, 1).reason, 'wrong_equipment');
  assert.equal(f.move('bag', 2, 'equipment', 3, 1).ok, true);
  assert.deepEqual(f.view().equipment[3], {
    itemType: 'trail_boots',
    count: 1,
    instance: { durability: 120 },
  });
  assert.equal(f.move('bag', 0, 'equipment', 3, 1).ok, false);
  assert.equal(f.give('oak_log', 4).ok, true);
  assert.equal(f.move('bag', 1, 'bag', 2, 7).ok, true);
  assert.deepEqual(f.view().bag.slice(1, 3), [
    { itemType: 'oak_log', count: 4 },
    { itemType: 'stone', count: 7 },
  ]);
  const exposed = f.view();
  (exposed.bag as any)[0].count = 999;
  (exposed.equipment as any)[3].instance.durability = 1;
  assert.equal(f.view().bag[0]?.count, 57);
  assert.equal(f.view().equipment[3]?.instance?.durability, 120);
});
test('2x2 recipes translate/mirror, batch atomically, and never consume ingredients when output is full', () => {
  const f = fixture();
  assert.equal(f.give('oak_log', 3).ok, true);
  f.move('bag', 0, 'craft2', 3, 3);
  assert.equal(
    f.run({ kind: 'craft', grid: 2, count: 4, revision: f.view().revision }).reason,
    'insufficient',
  );
  assert.equal(f.run({ kind: 'craft', grid: 2, count: 3, revision: f.view().revision }).ok, true);
  assert.deepEqual(f.view().bag[0], { itemType: 'oak_planks', count: 12 });
  assert.ok(f.view().craft2.every((slot) => slot === null));
  f.move('bag', 0, 'craft2', 1, 2);
  f.move('bag', 0, 'craft2', 3, 2);
  assert.equal(
    matchRecipe(
      f.view().craft2,
      2,
      content.recipes,
      new Map(content.items.map((item) => [item.itemType, item])),
    )?.key,
    'stick',
  );
  assert.equal(f.run({ kind: 'craft', grid: 2, count: 2, revision: f.view().revision }).ok, true);
  assert.equal(f.view().bag.find((s) => s?.itemType === 'stick')?.count, 8);
  const full = fixture();
  full.give('wooden_pickaxe', 35);
  full.give('oak_log', 2);
  full.move('bag', 35, 'craft2', 3, 1);
  const before = full.view();
  assert.equal(
    full.run({ kind: 'craft', grid: 2, count: 1, revision: before.revision }).reason,
    'full',
  );
  assert.deepEqual(full.view(), before);
});
test('3x3 crafting requires a reachable live station and creates a bounded durable instance', () => {
  const f = fixture();
  f.give('oak_planks', 3);
  f.give('stick', 2);
  assert.equal(f.move('bag', 0, 'craft3', 0, 1).reason, 'invalid_slot');
  assert.equal(f.run({ kind: 'open', target: table }).ok, true);
  for (const slot of [0, 1, 2]) assert.equal(f.move('bag', 0, 'craft3', slot, 1).ok, true);
  for (const slot of [4, 7]) assert.equal(f.move('bag', 1, 'craft3', slot, 1).ok, true);
  f.setReachable(false);
  const previous = f.view();
  assert.equal(
    f.run({ kind: 'craft', grid: 3, count: 1, revision: previous.revision }).reason,
    'station_required',
  );
  assert.deepEqual(f.view().craft3, previous.craft3);
  f.setReachable(true);
  f.run({ kind: 'open', target: table });
  assert.equal(f.run({ kind: 'craft', grid: 3, count: 1, revision: f.view().revision }).ok, true);
  assert.deepEqual(f.view().bag[0], {
    itemType: 'wooden_pickaxe',
    count: 1,
    instance: { durability: 60 },
  });
  assert.ok(f.view().craft3.every((slot) => slot === null));
});
test('simultaneous chest withdrawals serialize by revisions and cannot duplicate or erase items', () => {
  const f = fixture();
  for (const id of ['a', 'b']) f.run({ kind: 'open', target: chest }, id);
  f.give('stone', 12);
  assert.equal(f.move('bag', 0, 'container', 0, 12).ok, true);
  assert.equal(f.inventories.canBreak(chest), false);
  const a = f.view('a'),
    b = f.view('b');
  const operation = (v: typeof a): InventoryCommand => ({
    kind: 'move',
    from: { area: 'container', slot: 0 },
    to: { area: 'bag', slot: 0 },
    count: 12,
    revision: v.revision,
    containerId: v.container!.id,
    containerRevision: v.container!.revision,
  });
  assert.equal(f.run(operation(a), 'a').ok, true);
  assert.equal(f.run(operation(b), 'b').reason, 'conflict');
  assert.equal(f.view('a').bag[0]?.count, 12);
  assert.equal(f.view('b').bag[0], null);
  assert.equal(f.view('b').container?.slots[0], null);
  assert.equal(f.inventories.canBreak(chest), true);
  assert.deepEqual(f.inventories.removed(chest).sort(), ['a', 'b']);
  f.run({ kind: 'open', target: chest }, 'a');
  assert.notEqual(f.view().container?.id, a.container?.id);
  assert.equal(f.run(operation(a)).reason, 'conflict');
});
test('failed grants and stale revisions do not partially install; disconnect preserves grids/equipment and closes shared access', () => {
  const f = fixture();
  assert.equal(
    f.run({ kind: 'give', itemType: 'stone', count: 1, revision: 0 }, 'a', false).reason,
    'forbidden',
  );
  f.give('oak_log', 8);
  f.move('bag', 0, 'craft2', 0, 3);
  f.run({ kind: 'open', target: chest });
  const before = f.view();
  f.inventories.close('a');
  f.inventories.join('a');
  assert.deepEqual(f.view().bag, before.bag);
  assert.deepEqual(f.view().craft2, before.craft2);
  assert.equal(f.view().container, null);
  const stable = f.view();
  assert.equal(
    f.run({ kind: 'give', itemType: 'stone', count: 1, revision: 0 }).reason,
    'conflict',
  );
  assert.equal(
    f.run({ kind: 'give', itemType: 'wooden_pickaxe', count: 999, revision: stable.revision })
      .reason,
    'full',
  );
  assert.deepEqual(f.view(), stable);
});
test('old chest incarnations conflict even with identical revisions; abandoned crafting ingredients stay recoverable', () => {
  const f = fixture();
  f.give('stone', 4);
  f.run({ kind: 'open', target: chest });
  const old = f.view();
  f.inventories.removed(chest);
  f.run({ kind: 'open', target: chest });
  const replaced = f.view();
  assert.equal(old.container!.revision, replaced.container!.revision);
  assert.equal(old.revision, replaced.revision);
  assert.equal(
    f.run({
      kind: 'move',
      from: { area: 'bag', slot: 0 },
      to: { area: 'container', slot: 0 },
      count: 4,
      revision: old.revision,
      containerId: old.container!.id,
      containerRevision: old.container!.revision,
    }).reason,
    'conflict',
  );
  assert.deepEqual(f.view(), replaced);
  f.run({ kind: 'open', target: table });
  f.move('bag', 0, 'craft3', 0, 4);
  f.give('oak_log', 1);
  f.inventories.join('a');
  assert.equal(
    f.move('craft3', 0, 'bag', 0, 4).reason,
    'occupied',
    'retrieving must not swap a new ingredient into an unavailable grid',
  );
  assert.equal(f.move('craft3', 0, 'bag', 1, 4).ok, true);
  assert.equal(f.view().bag[1]?.count, 4);
  assert.ok(f.view().craft3.every((s) => s === null));
});
test('inventory wire intents reject client results, unknown fields, forged slots and malformed owned instances', () => {
  const f = fixture();
  const message = {
    type: 'inventory',
    epoch: 1,
    sequence: 1,
    operation: { kind: 'craft', grid: 2, count: 1, revision: 0 },
  };
  assert.ok(parseClientMessage(JSON.stringify(message)));
  for (const operation of [
    { ...message.operation, result: { itemType: 'stone', count: 999 } },
    { ...message.operation, grid: 4 },
    { ...message.operation, count: 65 },
    {
      kind: 'move',
      from: { area: 'bag', slot: 36 },
      to: { area: 'bag', slot: 0 },
      count: 1,
      revision: 0,
      containerId: null,
      containerRevision: null,
    },
    { kind: 'open', target: [1000, 64, 1] },
  ])
    assert.equal(parseClientMessage(JSON.stringify({ ...message, operation })), null);
  const state = { type: 'inventory', epoch: 1, view: f.view() };
  assert.ok(parseServerMessage(JSON.stringify(state)));
  assert.equal(
    isInventoryView({ ...f.view(), bag: [{ itemType: 'stone', count: 1 }] }, () => true),
    false,
  );
  assert.equal(
    parseServerMessage(
      JSON.stringify({
        ...state,
        view: {
          ...f.view(),
          bag: [
            { itemType: 'wooden_pickaxe', count: 2, instance: { durability: 60 } },
            ...f.view().bag.slice(1),
          ],
        },
      }),
    ),
    null,
  );
});
