import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rayBody, combatProfile, UNARMED } from '../src/shared/combat.ts';
import { Vitals } from '../src/sim/vitals.ts';
import { Inventories } from '../src/sim/inventory.ts';
import { compileContent } from '../tools/compile-content.ts';
import { source } from '../content/index.ts';
import { parseClientMessage, parseServerMessage } from '../src/shared/protocol.ts';
test('body ray chooses actual bounded intersections including parallel, grazing and inside rays', () => {
  assert.equal(rayBody([0, 1.62, 0], [0, 0, -1], [0, 0, -2], 3), 1.7);
  assert.equal(rayBody([0, 1.62, 0], [0, 0, -1], [1, 0, -2], 3), null);
  assert.equal(rayBody([0, 1.62, 0], [0, 0, -1], [0, 0, -4], 3), null);
  assert.equal(rayBody([0.3, 1.62, 0], [0, 0, -1], [0, 0, -2], 3), 1.7);
  assert.equal(rayBody([0, 1.62, 0], [0, 0, 1], [0, 0, -2], 3), null);
  assert.equal(rayBody([0, 1.62, 0], [0, 0, 1], [0, 0, 0], 3), 0);
  assert.equal(rayBody([0, 2.1, 0], [0, 0, -1], [0, 0, -2], 3), null);
});
test('combat cooldown, hit recovery and respawn protection advance only by simulation steps and attacks abandon protection', () => {
  const a = new Vitals(),
    b = new Vitals(),
    body = new Float64Array(17);
  assert.equal(a.beginAttack(15), true);
  for (let i = 0; i < 400; i++) assert.equal(a.beginAttack(15), false);
  assert.equal(b.strikeDamage(2), true);
  assert.equal(b.strikeDamage(2), false);
  for (let i = 0; i < 9; i++) b.step(body);
  assert.equal(b.strikeDamage(2), false);
  b.step(body);
  assert.equal(b.strikeDamage(2), true);
  for (let i = 0; i < 14; i++) a.step(body);
  assert.equal(a.beginAttack(15), false);
  a.step(body);
  assert.equal(a.beginAttack(15), true);
  b.damage(20);
  for (let i = 0; i < 60; i++) b.step(body);
  assert.equal(b.respawn(), true);
  assert.equal(b.view().protection, 60);
  assert.equal(b.strikeDamage(20), false);
  assert.equal(b.beginAttack(15), true);
  assert.equal(b.view().protection, 0);
  assert.equal(b.strikeDamage(1), true);
});
test('owned weapon wear commits once after accepted damage and stale/rejected strikes leave ownership unchanged', () => {
  const inv = new Inventories(compileContent(source).manifest, {
    station: () => null,
    canUse: () => false,
  });
  inv.join('a');
  inv.receive('a', { itemType: 'wooden_axe', count: 1, instance: { durability: 1 } });
  let health = 20;
  const revision = inv.held('a').revision;
  assert.equal(
    inv.strike('a', revision - 1, () => {
      health -= 4;
      return true;
    }).reason,
    'conflict',
  );
  assert.equal(inv.strike('a', revision, () => false).ok, false);
  assert.equal(health, 20);
  assert.equal(inv.held('a').stack?.instance?.durability, 1);
  assert.equal(
    inv.strike('a', revision, () => {
      health -= 4;
      return true;
    }).ok,
    true,
  );
  assert.equal(health, 16);
  assert.equal(inv.held('a').stack, null);
});
test('combat profiles and wire carry intentions only and reject forged target, damage, reach, clock and hit effects', () => {
  const request = { type: 'attack', epoch: 1, sequence: 1, inputSequence: 2, inventoryRevision: 0 };
  assert.ok(parseClientMessage(JSON.stringify(request)));
  for (const extra of [
    { damage: 20 },
    { target: 'victim' },
    { position: [0, 1, 0] },
    { reach: 100 },
    { tick: 10000 },
    { inputSequence: -1 },
  ])
    assert.equal(parseClientMessage(JSON.stringify({ ...request, ...extra })), null);
  const event = {
    type: 'hit',
    sequence: 1,
    attacker: 'a',
    target: 'b',
    position: [0, 1, 0],
    damage: 2,
    dead: false,
  };
  assert.ok(parseServerMessage(JSON.stringify(event)));
  for (const extra of [
    { damage: 0 },
    { damage: 21 },
    { position: [0, 256, 0] },
    { sequence: 0 },
    { dead: 1 },
    { health: 20 },
  ])
    assert.equal(parseServerMessage(JSON.stringify({ ...event, ...extra })), null);
  assert.deepEqual(combatProfile(), UNARMED);
  const axe = source.items.find((item) => item.itemType === 'wooden_axe')!;
  assert.equal(combatProfile(axe).damage, 4);
  for (const combat of [
    { damage: 21, cooldown: 15, reach: 3 },
    { damage: 4, cooldown: 0, reach: 3 },
    { damage: 4, cooldown: 15, reach: 50 },
  ])
    assert.throws(
      () =>
        compileContent({
          ...source,
          items: source.items.map((item) => (item === axe ? { ...item, combat } : item)),
        }),
      /combat/,
    );
});
