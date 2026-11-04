import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Vitals } from '../src/sim/vitals.ts';
import { equipmentEffects, isVitalsView } from '../src/shared/vitals.ts';
import { parseClientMessage, parseServerMessage } from '../src/shared/protocol.ts';
import { compileContent } from '../tools/compile-content.ts';
import { source } from '../content/index.ts';
import { Inventories } from '../src/sim/inventory.ts';
const body = new Float64Array(17);
test('vitals timers, regeneration, effort, food cooldown and starvation use fixed simulation steps', () => {
  const v = new Vitals();
  for (let i = 0; i < 3599; i++) v.step(body);
  assert.equal(v.view().food, 20);
  v.step(body);
  assert.equal(v.view().food, 19);
  assert.equal(v.eat(4), 'eaten');
  assert.equal(v.view().food, 20);
  v.effort(16);
  assert.equal(v.eat(4), 'cooldown');
  for (let i = 0; i < 15; i++) v.step(body);
  assert.equal(v.eat(4), 'eaten');
  v.damage(4);
  for (let i = 0; i < 149; i++) v.step(body);
  assert.equal(v.view().health, 16);
  v.step(body);
  assert.equal(v.view().health, 17);
  v.effort(100);
  for (let i = 0; i < 119; i++) v.step(body);
  assert.equal(v.view().health, 17);
  v.step(body);
  assert.equal(v.view().health, 16);
});
test('fall peaks survive a stop, water/ladder reset them and death/respawn retain exact room durations', () => {
  const falling = (y: number, ground = false, water = false) =>
    new Float64Array([0, y, 0, 0, 0, 0, Number(ground), Number(water), 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const v = new Vitals();
  assert.deepEqual(v.movement(falling(12), falling(7), false, 0, false), { damage: 0, impact: 0 });
  assert.deepEqual(v.movement(falling(7), falling(1, true), false, 0.25, false), {
    damage: 6,
    impact: 8,
  });
  assert.equal(v.view().health, 14);
  v.movement(falling(20), falling(10, false, true), false, 0, false);
  assert.deepEqual(v.movement(falling(3), falling(1, true), false, 0, false), {
    damage: 0,
    impact: 0,
  });
  v.movement(falling(20), falling(10), true, 0, false);
  assert.deepEqual(v.movement(falling(3), falling(1, true), false, 0, false), {
    damage: 0,
    impact: 0,
  });
  assert.equal(v.damage(20), true);
  assert.equal(v.respawn(), false);
  for (let i = 0; i < 59; i++) v.step(body);
  assert.equal(v.view().respawnIn, 1);
  v.step(body);
  assert.equal(v.respawn(), true);
  assert.deepEqual(v.view(), {
    version: 2,
    health: 20,
    food: 20,
    air: 300,
    dead: false,
    respawnIn: 0,
    attackCooldown: 0,
    protection: 60,
  });
});
test('food consumes one owned item only after accepted effect; death drains every private area without duplication', () => {
  const content = compileContent(source).manifest;
  const inv = new Inventories(content, { station: () => 'workbench', canUse: () => true });
  inv.join('a');
  inv.receive('a', { itemType: 'apple', count: 4 });
  const v = new Vitals(),
    revision = inv.view('a').revision;
  assert.equal(inv.consume('a', 0, revision, (n) => v.eat(n)).reason, 'full');
  assert.equal(inv.view('a').revision, revision);
  v.effort(16);
  assert.equal(inv.consume('a', 0, revision - 1, (n) => v.eat(n)).reason, 'conflict');
  assert.equal(v.view().food, 16);
  assert.equal(inv.consume('a', 0, revision, (n) => v.eat(n)).ok, true);
  assert.equal(inv.view('a').bag[0]?.count, 3);
  inv.transact(
    'a',
    {
      kind: 'move',
      from: { area: 'bag', slot: 0 },
      to: { area: 'craft2', slot: 0 },
      count: 1,
      revision: inv.view('a').revision,
      containerId: null,
      containerRevision: null,
    },
    false,
  );
  const dropped: unknown[] = [];
  inv.drain('a', (stack) => dropped.push(stack));
  inv.drain('a', (stack) => dropped.push(stack));
  assert.equal(
    (dropped as { count: number }[]).reduce((sum, stack) => sum + stack.count, 0),
    3,
  );
  assert.ok(inv.view('a').bag.every((x) => !x));
  assert.ok(inv.view('a').craft2.every((x) => !x));
});
test('bounded data-driven equipment profiles and vitals wire reject forged modifiers, health and food awards', () => {
  const boots = source.items.find((i) => i.itemType === 'trail_boots')!;
  const effect = equipmentEffects(Array(10).fill(boots));
  assert.equal(effect.movement.speed, 2);
  assert.equal(effect.fall, 0.9);
  for (const item of [
    { ...boots, modifiers: { speed: Infinity } },
    { ...boots, modifiers: { armor: 1 } },
    { ...boots, equipment: undefined },
  ])
    assert.throws(
      () =>
        compileContent({
          ...source,
          items: source.items.map((i) => (i === boots ? (item as typeof boots) : i)),
        }),
      /modifiers/,
    );
  assert.throws(
    () =>
      compileContent({
        ...source,
        items: [
          ...source.items,
          { itemType: 'bad_food', labelKey: 'item.bad_food', maxStack: 64, food: 21 },
        ],
      }),
    /food/,
  );
  const view = new Vitals().view();
  assert.ok(isVitalsView(view));
  for (const value of [
    { ...view, health: 21 },
    { ...view, health: 0 },
    { ...view, respawnIn: 1 },
    { ...view, air: -1 },
    { ...view, food: NaN },
  ])
    assert.equal(isVitalsView(value), false);
  assert.ok(parseServerMessage(JSON.stringify({ type: 'vitals', epoch: 1, view })));
  assert.ok(
    parseClientMessage(
      JSON.stringify({
        type: 'inventory',
        epoch: 1,
        sequence: 1,
        operation: { kind: 'consume', slot: 0, revision: 0 },
      }),
    ),
  );
  assert.ok(parseClientMessage(JSON.stringify({ type: 'respawn', epoch: 1, sequence: 1 })));
  for (const value of [
    { type: 'damage', target: 'a', amount: 20 },
    {
      type: 'inventory',
      epoch: 1,
      sequence: 1,
      operation: { kind: 'consume', slot: 0, revision: 0, food: 20 },
    },
    { type: 'respawn', epoch: 1, sequence: 1, position: [0, 100, 0] },
  ])
    assert.equal(parseClientMessage(JSON.stringify(value)), null);
});
