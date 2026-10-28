import assert from 'node:assert/strict';
import { test } from 'node:test';
import { source } from '../content/index.ts';
import { compileContent } from '../tools/compile-content.ts';
import { Inventories } from '../src/sim/inventory.ts';
import {
  appearanceMatchesContent,
  emptyAppearance,
  isActorAppearance,
} from '../src/shared/appearance.ts';
import { parseClientMessage, parseServerMessage } from '../src/shared/protocol.ts';
const manifest = compileContent(source).manifest;
const items = new Map(manifest.items.map((item) => [item.itemType, item]));
test('public appearance contains only selected and worn item identities, without private ownership data or aliases', () => {
  const inv = new Inventories(manifest, { station: () => null, canUse: () => false });
  inv.join('a');
  assert.deepEqual(inv.appearance('a'), emptyAppearance());
  inv.receive('a', { itemType: 'stick', count: 13 });
  inv.receive('a', { itemType: 'wooden_pickaxe', count: 1, instance: { durability: 17 } });
  inv.receive('a', { itemType: 'trail_boots', count: 1, instance: { durability: 29 } });
  inv.receive('a', { itemType: 'apple', count: 9 });
  assert.equal(inv.appearance('a').held, 'stick');
  assert.equal(
    inv.transact('a', { kind: 'select', slot: 1, revision: inv.view('a').revision }, false).ok,
    true,
  );
  assert.equal(
    inv.transact(
      'a',
      {
        kind: 'move',
        from: { area: 'bag', slot: 2 },
        to: { area: 'equipment', slot: 3 },
        count: 1,
        revision: inv.view('a').revision,
        containerId: null,
        containerRevision: null,
      },
      false,
    ).ok,
    true,
  );
  const view = inv.appearance('a');
  assert.deepEqual(view, {
    held: 'wooden_pickaxe',
    equipment: { head: null, body: null, legs: null, feet: 'trail_boots', offhand: null },
  });
  assert.equal(appearanceMatchesContent(view, items), true);
  (view.equipment as { feet: string | null }).feet = null;
  assert.equal(inv.appearance('a').equipment.feet, 'trail_boots');
  inv.wearEquipment('a', 'fall');
  assert.equal(inv.view('a').equipment[3]?.instance?.durability, 28);
  assert.equal(inv.appearance('a').equipment.feet, 'trail_boots');
});
test('appearance wire rejects private fields, forged slots and client-supplied actor cosmetics; content validation rejects unknown identities', () => {
  const appearance = emptyAppearance();
  const actor = { id: 'a', state: Array(17).fill(0), yaw: 0, pitch: 0, appearance };
  const joined = (value: unknown) =>
    parseServerMessage(JSON.stringify({ type: 'actor_joined', actor: value }));
  assert.ok(joined(actor));
  for (const invalid of [
    { ...appearance, count: 3 },
    { ...appearance, instance: { durability: 20 } },
    { ...appearance, held: { itemType: 'stick', count: 1 } },
    { ...appearance, equipment: { ...appearance.equipment, bag: 'apple' } },
    { ...appearance, equipment: { feet: 'trail_boots' } },
    { ...appearance, held: 'bad/identity' },
  ]) {
    assert.equal(isActorAppearance(invalid), false);
    assert.equal(joined({ ...actor, appearance: invalid }), null);
  }
  assert.equal(joined({ ...actor, inventory: { bag: [] } }), null);
  const snapshot = { type: 'snapshot', time: 100, tick: 3, actors: [{ id: 'a', appearance }] };
  assert.ok(parseServerMessage(JSON.stringify(snapshot)));
  assert.equal(
    parseServerMessage(JSON.stringify({ ...snapshot, actors: [{ id: 'a', appearance, bag: [] }] })),
    null,
  );
  assert.equal(appearanceMatchesContent({ ...appearance, held: 'unknown' }, items), false);
  assert.equal(
    appearanceMatchesContent(
      { ...appearance, equipment: { ...appearance.equipment, head: 'trail_boots' } },
      items,
    ),
    false,
  );
  assert.equal(parseClientMessage(JSON.stringify({ type: 'appearance', appearance })), null);
  assert.equal(
    parseClientMessage(
      JSON.stringify({
        type: 'inventory',
        epoch: 1,
        sequence: 1,
        operation: { kind: 'select', slot: 0, revision: 0, appearance },
      }),
    ),
    null,
  );
  const palette = { type: 'palette', epoch: 1, sequence: 1, state: 2 };
  assert.ok(parseClientMessage(JSON.stringify(palette)));
  for (const invalid of [
    { ...palette, state: 0 },
    { ...palette, state: 65535 },
    { ...palette, sequence: 0 },
    { ...palette, epoch: 0 },
    { ...palette, itemType: 'wooden_pickaxe' },
    { ...palette, position: [0, 0, 0] },
    { ...palette, dt: 1 },
  ])
    assert.equal(parseClientMessage(JSON.stringify(invalid)), null);
});
