import assert from 'node:assert/strict';
import { test } from 'node:test';
import { source } from '../content/index.ts';
import { compileContent } from '../tools/compile-content.ts';
import { Inventories } from '../src/sim/inventory.ts';
import type { InventoryArea, InventoryCommand } from '../src/shared/inventory.ts';
import type { Cell } from '../src/shared/protocol.ts';
const content = compileContent(source).manifest,
  table: Cell = [1, 64, 1],
  chest: Cell = [2, 64, 1];
const json = (value: unknown) => JSON.parse(JSON.stringify(value));
function fixture() {
  let accessCalls = 0;
  const access = {
    station: (cell: Cell) => {
      accessCalls++;
      return cell.join(',') === table.join(',') ? ('workbench' as const) : ('container' as const);
    },
    canUse: () => {
      accessCalls++;
      return true;
    },
  };
  const inventory = new Inventories(content, access);
  inventory.join('a');
  inventory.join('b');
  const view = (id = 'a') => inventory.view(id);
  const run = (operation: InventoryCommand, id = 'a') => {
    const result = inventory.transact(id, operation, false);
    assert.equal(result.ok, true, JSON.stringify({ operation, result }));
  };
  const move = (
    from: InventoryArea,
    slot: number,
    to: InventoryArea,
    target: number,
    count: number,
    id = 'a',
  ) => {
    const v = view(id);
    run(
      {
        kind: 'move',
        from: { area: from, slot },
        to: { area: to, slot: target },
        count,
        revision: v.revision,
        containerId: v.container?.id ?? null,
        containerRevision: v.container?.revision ?? null,
      },
      id,
    );
  };
  for (const stack of [
    { itemType: 'iron_pickaxe', count: 1, instance: { durability: 103 } },
    { itemType: 'trail_boots', count: 1, instance: { durability: 19 } },
    { itemType: 'iron_vest', count: 1, instance: { durability: 138 } },
    { itemType: 'glow_talisman', count: 1, instance: { durability: 46 } },
    { itemType: 'water_bucket', count: 1 },
    { itemType: 'spruce_planks', count: 20 },
    { itemType: 'apple', count: 3 },
    { itemType: 'stone', count: 7 },
  ])
    assert.equal(inventory.receive('a', stack), stack.count);
  move('bag', 1, 'equipment', 3, 1);
  move('bag', 2, 'equipment', 1, 1);
  move('bag', 3, 'equipment', 0, 1);
  move('bag', 5, 'craft2', 3, 2);
  run({ kind: 'open', target: table });
  move('bag', 7, 'craft3', 8, 3);
  run({ kind: 'select', slot: 4, revision: view().revision });
  run({ kind: 'open', target: chest });
  move('bag', 6, 'container', 0, 1);
  run({ kind: 'open', target: chest }, 'b');
  return { inventory, access, view, run, move, calls: () => accessCalls };
}

test('inventory JSON recovery retains every private area, durable instance, selection and chest revision while closing all viewers', () => {
  const f = fixture(),
    captured = f.inventory.checkpoint(),
    calls = f.calls(),
    restored = Inventories.fromCheckpoint(content, f.access, json(captured));
  assert.equal(f.calls(), calls, 'cold reconstruction must not query or open terrain/stations');
  assert.deepEqual(restored.checkpoint(), captured);
  for (const id of ['a', 'b'])
    assert.deepEqual(restored.view(id), { ...f.view(id), station: 'personal', container: null });
  assert.deepEqual(restored.viewers('chest-1'), []);
  restored.join('a');
  assert.deepEqual(restored.view('a').craft3, f.view().craft3);
  assert.equal(restored.view('a').selected, 4);
  assert.equal(restored.held('a').stack?.itemType, 'water_bucket');
  assert.equal(restored.appearance('a').equipment.body, 'iron_vest');
  assert.equal(restored.view('a').equipment[3]?.instance?.durability, 19);
  assert.equal(restored.transact('a', { kind: 'open', target: chest }, false).ok, true);
  assert.deepEqual(restored.view('a').container, f.view().container);
  const v = restored.view('a');
  assert.equal(
    restored.transact(
      'a',
      {
        kind: 'move',
        from: { area: 'container', slot: 0 },
        to: { area: 'bag', slot: 9 },
        count: 1,
        revision: v.revision,
        containerId: v.container!.id,
        containerRevision: v.container!.revision,
      },
      false,
    ).ok,
    true,
  );
  assert.equal(restored.canBreak(chest), true);
  restored.removed(chest);
  assert.equal(restored.transact('a', { kind: 'open', target: chest }, false).ok, true);
  const fresh = restored.view('a');
  assert.equal(fresh.container!.id, 'chest-2');
  assert.equal(
    restored.transact(
      'a',
      {
        kind: 'move',
        from: { area: 'bag', slot: 9 },
        to: { area: 'container', slot: 0 },
        count: 1,
        revision: fresh.revision,
        containerId: v.container!.id,
        containerRevision: 0,
      },
      false,
    ).reason,
    'conflict',
  );
  assert.equal(restored.view('a').bag[9]?.count, 1);
  assert.equal(restored.checkpoint().nextChest, 2);
});

test('captured ownership is deeply immutable and both capture and restore are independent of later mutations', () => {
  const f = fixture(),
    snapshot = f.inventory.checkpoint(),
    bytes = JSON.stringify(snapshot);
  const p = snapshot.players.find((p) => p.id === 'a')!;
  for (const frozen of [
    snapshot,
    snapshot.players,
    p,
    p.bag,
    p.bag[0],
    p.bag[0]!.instance,
    p.equipment,
    snapshot.chests,
    snapshot.chests[0],
    snapshot.chests[0].cell,
    snapshot.chests[0].slots,
  ])
    assert.equal(Object.isFrozen(frozen), true);
  f.move('bag', 6, 'container', 0, 1);
  f.inventory.wearEquipment('a', 'armor');
  assert.equal(JSON.stringify(snapshot), bytes);
  const input = json(snapshot),
    restored = Inventories.fromCheckpoint(content, f.access, input);
  input.players[0].bag[0].instance.durability = 1;
  input.chests[0].slots[0].count = 64;
  assert.equal(restored.view('a').bag[0]?.instance?.durability, 103);
  assert.equal(restored.checkpoint().chests[0].slots[0]?.count, 1);
});

test('inventory reconstruction rejects bad schemas/content, duplicates, forged stacks, invalid equipment and sparse or partial arrays atomically', () => {
  const f = fixture(),
    snapshot = f.inventory.checkpoint(),
    before = JSON.stringify(snapshot),
    calls = f.calls();
  const mutations: ((v: any) => void)[] = [
    (v) => (v.players[0].bag[0] = Object.create(v.players[0].bag[0])),
    (v) => (v.schema = 2),
    (v) => (v.contentHash = 'wrong'),
    (v) => (v.extra = true),
    (v) => (v.nextChest = -1),
    (v) => v.players.push(v.players[0]),
    (v) => (v.players[0].selected = 9),
    (v) => (v.players[0].revision = NaN),
    (v) => v.players[0].bag.pop(),
    (v) => (v.players[0].bag[0].instance.durability = 0),
    (v) => (v.players[0].bag[0].count = 2),
    (v) => (v.players[0].bag[0].tags = ['fuel']),
    (v) => (v.players[0].bag[0].itemType = 'missing'),
    (v) => (v.players[0].craft2 = Array(4)),
    (v) => (v.players[0].craft3[0] = { itemType: 'stone', count: 65 }),
    (v) => (v.players[0].equipment[0] = v.players[0].equipment[3]),
    (v) => (v.players[1].station = { kind: 'container', cell: chest }),
    (v) => v.chests.push(v.chests[0]),
    (v) => (v.chests[0].id = 'chest-2'),
    (v) => (v.chests[0].cell = [256, 64, 1]),
    (v) => (v.chests[0].cell = Array(3)),
    (v) => (v.chests[0].revision = -1),
    (v) => v.chests[0].slots.pop(),
    (v) => (v.chests[0].slots[0].instance = { durability: 1 }),
    (v) => v.players.push({ ...v.players[0], id: 'bad', equipment: [] }),
    (v) => (v.players = Array(2)),
    (v) => (v.chests = Array(1)),
  ];
  for (const mutate of mutations) {
    const candidate = json(snapshot);
    mutate(candidate);
    assert.throws(
      () => Inventories.fromCheckpoint(content, f.access, candidate),
      /invalid inventory checkpoint/,
    );
  }
  assert.equal(f.calls(), calls);
  assert.equal(JSON.stringify(f.inventory.checkpoint()), before);
  const exhausted = json(snapshot);
  exhausted.nextChest = Number.MAX_SAFE_INTEGER;
  const restored = Inventories.fromCheckpoint(content, f.access, exhausted),
    unseen: Cell = [3, 64, 1];
  assert.equal(
    restored.transact('a', { kind: 'open', target: unseen }, false).reason,
    'identity_exhausted',
  );
  assert.equal(restored.checkpoint().nextChest, Number.MAX_SAFE_INTEGER);
});

test('checkpoint ownership and container collections preserve progressively more identities without a headcount limit', () => {
  const access = { station: () => 'container' as const, canUse: () => true },
    inventory = new Inventories(content, access);
  for (let i = 0; i < 129; i++) {
    const id = `p_${i}`;
    inventory.join(id);
    inventory.receive(id, { itemType: 'stone', count: 1 });
    assert.equal(
      inventory.transact(
        id,
        { kind: 'select', slot: i % 9, revision: inventory.view(id).revision },
        false,
      ).ok,
      true,
    );
    assert.equal(
      inventory.transact(id, { kind: 'open', target: [i - 128, 64, 0] }, false).ok,
      true,
    );
  }
  const snapshot = inventory.checkpoint(),
    restored = Inventories.fromCheckpoint(content, access, json(snapshot));
  assert.equal(snapshot.players.length, 129);
  assert.equal(snapshot.chests.length, 129);
  assert.deepEqual(restored.checkpoint(), snapshot);
});
