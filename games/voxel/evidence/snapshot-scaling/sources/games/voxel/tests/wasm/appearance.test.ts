import assert from 'node:assert/strict';
import { test } from 'node:test';
import { roomFixture } from './room-fixture.ts';
import { emptyAppearance } from '../../src/shared/appearance.ts';
import type { ServerMessage } from '../../src/shared/protocol.ts';
import { content } from './fixture.ts';
type Fixture = ReturnType<typeof roomFixture>;
function equip(f: Fixture, kind: string, slot: number, durability: number) {
  f.room.inventories.receive('a', { itemType: kind, count: 1, instance: { durability } });
  const view = f.room.inventories.view('a');
  assert.equal(
    f.room.inventories.transact(
      'a',
      {
        kind: 'move',
        from: { area: 'bag', slot: view.bag.findIndex((s) => s?.itemType === kind) },
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
function appearanceEvents(f: Fixture, id: string) {
  return (f.events.get(id) ?? []).filter(
    (e): e is Extract<ServerMessage, { type: 'actor_joined' | 'snapshot' }> =>
      'type' in e && (e.type === 'actor_joined' || e.type === 'snapshot'),
  );
}
test('room snapshots publish owned visible identities, omit private stacks and suppress count/durability-only appearance deltas', () => {
  const f = roomFixture();
  try {
    f.room.inventories.receive('a', {
      itemType: 'wooden_pickaxe',
      count: 1,
      instance: { durability: 60 },
    });
    equip(f, 'trail_boots', 3, 120);
    f.room.inventories.receive('a', { itemType: 'apple', count: 23 });
    f.join('b');
    f.tick(6);
    const joined = appearanceEvents(f, 'b').find(
      (e) => e.type === 'actor_joined' && e.actor.id === 'a',
    );
    assert.ok(joined && joined.type === 'actor_joined');
    assert.deepEqual(Object.keys(joined.actor).sort(), [
      'appearance',
      'id',
      'pitch',
      'state',
      'yaw',
    ]);
    assert.deepEqual(joined.actor.appearance, {
      ...emptyAppearance(),
      held: 'wooden_pickaxe',
      equipment: { ...emptyAppearance().equipment, feet: 'trail_boots' },
    });
    for (const e of f.events.get('b') ?? [])
      if ('type' in e && e.type === 'inventory') assert.ok(e.view.bag.every((s) => s === null));
    f.events.set('b', []);
    f.room.inventories.wearEquipment('a', 'fall');
    f.room.inventories.receive('a', { itemType: 'apple', count: 1 });
    f.tick(4);
    for (const e of appearanceEvents(f, 'b'))
      if (e.type === 'snapshot') assert.ok(e.actors.every((a) => a.appearance === undefined));
    assert.equal(f.room.inventories.view('a').equipment[3]?.instance?.durability, 119);
    f.join('late');
    f.tick(4);
    const late = appearanceEvents(f, 'late').find(
      (e) => e.type === 'actor_joined' && e.actor.id === 'a',
    );
    assert.ok(late && late.type === 'actor_joined');
    assert.deepEqual(late.actor.appearance, joined.actor.appearance);
  } finally {
    f.room.dispose();
  }
});
test('selected tool and final-use footwear breakage replicate appearance-only changes and disconnected/rejoined actors use current ownership', () => {
  const f = roomFixture();
  try {
    f.room.inventories.receive('a', {
      itemType: 'wooden_pickaxe',
      count: 1,
      instance: { durability: 1 },
    });
    equip(f, 'helium_boots', 3, 1);
    f.join('b');
    f.tick(6);
    f.events.set('b', []);
    f.room.inventories.strike('a', f.room.inventories.held('a').revision, () => true);
    f.tick(4);
    const held = appearanceEvents(f, 'b')
      .flatMap((e) => (e.type === 'snapshot' ? e.actors : []))
      .find((a) => a.id === 'a' && a.appearance);
    assert.ok(held?.appearance);
    assert.equal(held.appearance.held, null);
    assert.equal(held.appearance.equipment.feet, 'helium_boots');
    f.controls.set('a', { ...f.controls.get('a')!, jump: true });
    f.tick(4);
    const feet = appearanceEvents(f, 'b')
      .flatMap((e) => (e.type === 'snapshot' ? e.actors : []))
      .findLast((a) => a.id === 'a' && a.appearance);
    assert.equal(feet?.appearance?.equipment.feet, null);
    f.room.disconnect('a', f.now);
    f.tick(4);
    assert.ok(
      f.events.get('b')?.some((e) => 'type' in e && e.type === 'actor_removed' && e.id === 'a'),
    );
    f.join('a');
    f.tick(4);
    const rejoined = appearanceEvents(f, 'b').findLast(
      (e) => e.type === 'actor_joined' && e.actor.id === 'a',
    );
    assert.ok(rejoined && rejoined.type === 'actor_joined');
    assert.deepEqual(rejoined.actor.appearance, emptyAppearance());
  } finally {
    f.room.dispose();
  }
});
test('hidden observers never acquire a participant-visible body or gear channel', () => {
  const f = roomFixture();
  try {
    f.join('hidden', 'observer');
    f.room.inventories.receive('hidden', { itemType: 'apple', count: 1 });
    f.join('b');
    f.tick(8);
    for (const id of ['a', 'b'])
      for (const e of appearanceEvents(f, id)) {
        if (e.type === 'actor_joined') assert.notEqual(e.actor.id, 'hidden');
        else assert.ok(e.actors.every((a) => a.id !== 'hidden'));
      }
    assert.ok(
      appearanceEvents(f, 'hidden').some((e) => e.type === 'actor_joined' && e.actor.id === 'a'),
    );
  } finally {
    f.room.dispose();
  }
});
test('creative palette selection validates catalog blocks, keeps worn ownership, rejects stale/duplicate epochs and never spends action sequences', () => {
  const f = roomFixture('creative');
  try {
    f.room.inventories.receive('a', {
      itemType: 'wooden_pickaxe',
      count: 1,
      instance: { durability: 60 },
    });
    equip(f, 'trail_boots', 3, 120);
    f.join('b');
    f.tick(6);
    const appearance = () =>
      appearanceEvents(f, 'b')
        .flatMap((e) => (e.type === 'actor_joined' ? [e.actor] : e.actors))
        .findLast((a) => a.id === 'a' && a.appearance)?.appearance;
    assert.equal(appearance()?.held, null);
    assert.equal(appearance()?.equipment.feet, 'trail_boots');
    const select = (state: number, sequence: number, epoch = f.player().epoch) =>
      f.room.receive('a', { type: 'palette', epoch, sequence, state }, f.now);
    select(content.defaults.stone, 1);
    f.tick(4);
    assert.equal(appearance()?.held, 'stone');
    select(content.defaults.sand, 1);
    select(65534, 2);
    select(content.defaults.bedrock, 3);
    f.tick(4);
    assert.equal(appearance()?.held, 'stone');
    const old = f.player().epoch;
    f.room.receive('a', { type: 'focus', epoch: old, active: false }, f.now);
    select(content.defaults.sand, 4, old);
    f.tick(4);
    assert.equal(appearance()?.held, 'stone');
    select(content.defaults.glass, 1000000);
    f.tick(4);
    assert.equal(appearance()?.held, 'glass');
    const result = f.send({
      type: 'inventory',
      epoch: f.player().epoch,
      sequence: f.next(),
      operation: { kind: 'select', slot: 0, revision: f.room.inventories.view('a').revision },
    });
    assert.equal(result.status, 'applied');
    assert.ok(
      f.room.inventories
        .view('a')
        .bag.every((s) => s?.itemType !== 'glass' && s?.itemType !== 'stone'),
    );
    f.join('late');
    f.tick(4);
    const joined = appearanceEvents(f, 'late').find(
      (e) => e.type === 'actor_joined' && e.actor.id === 'a',
    );
    assert.ok(joined && joined.type === 'actor_joined');
    assert.equal(joined.actor.appearance.held, 'glass');
  } finally {
    f.room.dispose();
  }
});
test('palette messages cannot forge a survival hand, refresh held movement or buy simulation time', () => {
  const survival = roomFixture();
  try {
    survival.room.receive(
      'a',
      {
        type: 'palette',
        epoch: survival.player().epoch,
        sequence: 1,
        state: content.defaults.stone,
      },
      survival.now,
    );
    assert.equal(survival.player().catalogItem, null);
    assert.deepEqual(survival.room.inventories.appearance('a'), emptyAppearance());
  } finally {
    survival.room.dispose();
  }
  const trace = (palette: boolean) => {
    const f = roomFixture('creative');
    try {
      f.tick(3);
      f.controls.set('a', { ...f.controls.get('a')!, x: 0.7, z: -0.4 });
      f.tick();
      f.controls.delete('a');
      const states = [];
      for (let n = 0; n < 25; n++) {
        if (palette)
          f.room.receive(
            'a',
            {
              type: 'palette',
              epoch: f.player().epoch,
              sequence: n + 1,
              state: content.defaults[n % 2 ? 'stone' : 'sand'],
            },
            f.now,
          );
        f.tick();
        states.push(Array.from(f.state()));
      }
      return states;
    } finally {
      f.room.dispose();
    }
  };
  assert.deepEqual(
    trace(true),
    trace(false),
    'catalog traffic changes no fixed-step motion or control liveness',
  );
});
