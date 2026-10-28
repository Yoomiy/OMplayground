import assert from 'node:assert/strict';
import { test } from 'node:test';
import { source } from '../content/index.ts';
import { compileContent } from '../tools/compile-content.ts';
import { Inventories } from '../src/sim/inventory.ts';
import { Vitals } from '../src/sim/vitals.ts';
import { equipmentEffects, isMovementModifiers } from '../src/shared/vitals.ts';
import { DEFAULT_MOVEMENT } from '../src/shared/movement.ts';
import { parseClientMessage, parseServerMessage } from '../src/shared/protocol.ts';
const manifest = compileContent(source).manifest;
function inventory() {
  const inv = new Inventories(manifest, { station: () => null, canUse: () => false });
  inv.join('a');
  return inv;
}
test('held activation belongs only to the selected owned tool; equipped effects compose and bags supply no perks', () => {
  const inv = inventory();
  inv.receive('a', { itemType: 'stick', count: 1 });
  inv.receive('a', { itemType: 'swift_pickaxe', count: 1, instance: { durability: 1 } });
  assert.equal(equipmentEffects(inv.active('a')).movement.speed, 1);
  assert.equal(
    inv.transact('a', { kind: 'select', slot: 1, revision: inv.view('a').revision }, false).ok,
    true,
  );
  assert.equal(equipmentEffects(inv.active('a')).movement.speed, 1.5);
  assert.equal(inv.strike('a', inv.held('a').revision, () => true).ok, true);
  assert.equal(equipmentEffects(inv.active('a')).movement.speed, 1);
  inv.receive('a', { itemType: 'feather_talisman', count: 1, instance: { durability: 1 } });
  assert.equal(equipmentEffects(inv.active('a')).fallImmune, false);
  const view = inv.view('a'),
    slot = view.bag.findIndex((s) => s?.itemType === 'feather_talisman');
  assert.equal(
    inv.transact(
      'a',
      {
        kind: 'move',
        from: { area: 'bag', slot },
        to: { area: 'equipment', slot: 2 },
        count: 1,
        revision: view.revision,
        containerId: null,
        containerRevision: null,
      },
      false,
    ).ok,
    true,
  );
  assert.equal(equipmentEffects(inv.active('a')).fallImmune, true);
  assert.equal(inv.wearEquipment('a', 'fall'), true);
  assert.equal(equipmentEffects(inv.active('a')).fallImmune, false);
  assert.equal(inv.wearEquipment('a', 'fall'), false);
});
test('fall immunity retains the real landing impact while preventing damage; solar and visibility wear use eligible room steps', () => {
  const v = new Vitals(),
    air = new Float64Array([0, 20, 0, 0, 0, 0, 0]),
    ground = new Float64Array([0, 1, 0, 0, 0, 0, 1]);
  assert.deepEqual(v.movement(air, ground, false, 1, false), { impact: 16, damage: 0 });
  assert.equal(v.view().health, 20);
  v.damage(4);
  v.effort(16);
  for (let n = 0; n < 149; n++) assert.equal(v.sunlight(true), false);
  assert.equal(v.sunlight(false), false);
  assert.equal(v.view().health, 16);
  for (let n = 0; n < 149; n++) assert.equal(v.sunlight(true), false);
  assert.equal(v.sunlight(true), true);
  assert.equal(v.view().health, 17);
  for (let n = 0; n < 899; n++) assert.equal(v.visibility(true), false);
  assert.equal(v.visibility(true), true);
  v.visibility(true);
  v.visibility(false);
  for (let n = 0; n < 899; n++) assert.equal(v.visibility(true), false);
  assert.equal(v.visibility(true), true);
  v.damage(20);
  for (let n = 0; n < 1000; n++) {
    assert.equal(v.sunlight(true), false);
    assert.equal(v.visibility(true), false);
  }
});
test('authored equipment rejects forged activation, nonboolean perks and unsafe movement profiles; clients cannot supply their own modifiers', () => {
  const boots = source.items.find((item) => item.itemType === 'helium_boots')!;
  for (const patch of [
    { modifiers: { jump: Infinity } },
    { modifiers: { jump: 3 } },
    { perks: { vision: false } },
    { perks: { sunRegen: 1 } },
    { perks: { admin: true } },
    { activation: 'held' },
    { equipment: undefined },
  ]) {
    assert.throws(() =>
      compileContent({
        ...source,
        items: source.items.map((item) =>
          item === boots ? ({ ...item, ...patch } as typeof boots) : item,
        ),
      }),
    );
  }
  const swift = source.items.find((item) => item.itemType === 'swift_pickaxe')!;
  assert.throws(() =>
    compileContent({
      ...source,
      items: source.items.map((item) =>
        item === swift ? { ...item, modifiers: { jump: 2 } } : item,
      ),
    }),
  );
  assert.equal(isMovementModifiers(DEFAULT_MOVEMENT), true);
  for (const jump of [NaN, 0, 2.1])
    assert.equal(isMovementModifiers({ ...DEFAULT_MOVEMENT, jump }), false);
  assert.equal(
    parseClientMessage(
      JSON.stringify({
        type: 'input',
        frames: [
          {
            epoch: 1,
            sequence: 1,
            x: 0,
            z: 0,
            yaw: 0,
            pitch: 0,
            jump: true,
            sneak: false,
            sprint: false,
            jumpPower: 2,
          },
        ],
      }),
    ),
    null,
  );
  assert.equal(
    parseClientMessage(JSON.stringify({ type: 'equipment', jump: 2, vision: true })),
    null,
  );
  const baseline = {
    type: 'baseline',
    epoch: 1,
    ack: 0,
    state: Array(17).fill(0),
    phase: 'playing',
    reason: 'movement',
    movement: DEFAULT_MOVEMENT,
  };
  assert.ok(parseServerMessage(JSON.stringify(baseline)));
  assert.equal(
    parseServerMessage(JSON.stringify({ ...baseline, movement: { ...DEFAULT_MOVEMENT, jump: 4 } })),
    null,
  );
});
