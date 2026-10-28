import assert from 'node:assert/strict';
import { test } from 'node:test';
import { source } from '../content/index.ts';
import { compileContent } from '../tools/compile-content.ts';
import { Drops } from '../src/sim/drops.ts';
import { Explosives } from '../src/sim/explosives.ts';
import type { WorldPort } from '../src/shared/engine-port.ts';
import { DROP_LIFETIME_TICKS } from '../src/shared/gameplay.ts';
const content = compileContent(source).manifest,
  tnt = content.blocks.findIndex((block) => block.name === 'tnt'),
  rule = content.behavior.find((block) => block.family === 'tnt')!.explosive!;
const unloaded = { has_column: () => false } as unknown as WorldPort;
const json = (value: unknown) => JSON.parse(JSON.stringify(value));

test('drop JSON recovery preserves pickup order, partial ownership, delays, frozen time and exact expiry', () => {
  const original = new Drops(content);
  for (let i = 0; i < 12; i++)
    original.add({ itemType: 'stone', count: 3 }, [0.5, 65, 0.5], 100, 'a');
  original.take('drop-2', 3);
  original.take('drop-7', 1);
  original.add(
    { itemType: 'iron_pickaxe', count: 1, instance: { durability: 17 } },
    [1.5, 65, 0.5],
    100,
  );
  const snapshot = original.checkpoint(103),
    restored = Drops.fromCheckpoint(content, json(snapshot)),
    bytes = JSON.stringify(snapshot);
  assert.deepEqual(restored.checkpoint(103), snapshot);
  assert.deepEqual(
    snapshot.entries.map((drop) => drop.id),
    [
      'drop-1',
      'drop-3',
      'drop-4',
      'drop-5',
      'drop-6',
      'drop-7',
      'drop-8',
      'drop-9',
      'drop-10',
      'drop-11',
      'drop-12',
      'drop-13',
    ],
  );
  assert.equal(Object.isFrozen(snapshot.entries[0].stack), true);
  assert.equal(Object.isFrozen(snapshot.entries[0].position), true);
  assert.equal(Object.isFrozen(snapshot.entries.at(-1)!.stack.instance), true);
  assert.throws(() => original.checkpoint(99), /predates/);
  assert.equal(restored.eligible('drop-1', 'b', 105), false);
  assert.equal(restored.eligible('drop-1', 'b', 106), true);
  assert.equal(restored.eligible('drop-1', 'a', 129), false);
  assert.equal(restored.eligible('drop-1', 'a', 130), true);
  assert.deepEqual(
    restored.checkpoint(103),
    snapshot,
    'wall time or reconstruction does not advance saved timers',
  );
  for (const drops of [original, restored]) {
    drops.take('drop-7', 1);
    assert.equal(drops.add({ itemType: 'dirt', count: 1 }, [0.5, 65, 0.5], 104), 'drop-14');
    drops.step(unloaded, 100 + DROP_LIFETIME_TICKS - 1);
  }
  assert.deepEqual(restored.checkpoint(9099), original.checkpoint(9099));
  assert.equal(JSON.stringify(snapshot), bytes);
  for (const drops of [original, restored]) drops.step(unloaded, 9100);
  assert.deepEqual(
    restored.nearby([0, 65, 0], 10).map((drop) => drop.id),
    ['drop-14'],
  );
  restored.step(unloaded, 9104);
  assert.equal(restored.size, 0);
});

test('drop recovery rejects corrupt stacks, duplicate identities, impossible delays, bodies and content before installing state', () => {
  const drops = new Drops(content);
  drops.add({ itemType: 'stone', count: 2 }, [0.5, 65, 0.5], 10, 'a');
  const snapshot = drops.checkpoint(13),
    before = JSON.stringify(snapshot);
  const mutations: ((v: any) => void)[] = [
    (v) => (v.schema = 2),
    (v) => (v.contentHash = 'wrong'),
    (v) => (v.extra = 1),
    (v) => (v.tick = -1),
    (v) => (v.nextId = 0),
    (v) => v.entries.push(v.entries[0]),
    (v) => (v.entries = Array(1)),
    (v) => (v.entries[0].id = 'drop-01'),
    (v) => (v.entries[0].stack.count = 65),
    (v) => (v.entries[0].stack = Object.create(v.entries[0].stack)),
    (v) => (v.entries[0].position = [256, 65, 0]),
    (v) => (v.entries[0].position = Array(3)),
    (v) => (v.entries[0].velocity = [13, 0, 0]),
    (v) => (v.entries[0].revision = Infinity),
    (v) => (v.entries[0].expiresIn = 9001),
    (v) => (v.entries[0].pickupIn = 7),
    (v) => (v.entries[0].ownerPickupIn = 2),
    (v) => (v.entries[0].owner = ''),
    (v) => (v.entries[0].expiresIn = 1),
    (v) => (v.entries[0].ownerPickupIn = 31),
    (v) =>
      v.entries.push({ ...v.entries[0], id: 'drop-2', stack: { itemType: 'missing', count: 1 } }),
  ];
  for (const mutate of mutations) {
    const v = json(snapshot);
    mutate(v);
    assert.throws(() => Drops.fromCheckpoint(content, v), /invalid drops checkpoint/);
  }
  assert.equal(JSON.stringify(drops.checkpoint(13)), before);
  const input = json(snapshot),
    restored = Drops.fromCheckpoint(content, input);
  input.entries[0].stack.count = 64;
  assert.equal(restored.nearby([0, 65, 0], 10)[0].stack.count, 2);
});

test('primed TNT recovery preserves due-work order, exact chain/normal remainders and derives strength from matched content', () => {
  const original = new Explosives();
  for (let i = 0; i < 12; i++)
    original.add(`owner-${i}`, tnt, [0.5, 65, 0.5], rule, i % 2 ? 30 : rule.fuse);
  for (let i = 0; i < 23; i++) original.step(unloaded);
  const snapshot = original.checkpoint(content),
    restored = Explosives.fromCheckpoint(content, json(snapshot)),
    bytes = JSON.stringify(snapshot);
  assert.deepEqual(restored.checkpoint(content), snapshot);
  assert.equal(Object.isFrozen(snapshot.entries[0].velocity), true);
  assert.equal(snapshot.entries[1].remaining, 7);
  for (let i = 0; i < 7; i++) {
    original.step(unloaded);
    restored.step(unloaded);
  }
  assert.deepEqual(
    restored.due().map((body) => body.id),
    ['tnt-2', 'tnt-4', 'tnt-6', 'tnt-8', 'tnt-10', 'tnt-12'],
  );
  assert.deepEqual(
    restored.due().map((body) => body.rule),
    Array(6).fill(rule),
  );
  for (const explosives of [original, restored])
    for (const body of explosives.due().slice(0, 2)) explosives.remove(body.id);
  const due = Explosives.fromCheckpoint(content, json(restored.checkpoint(content)));
  assert.deepEqual(
    due.due(),
    restored.due(),
    'already due bodies remain due through unavailable terrain and restart',
  );
  assert.deepEqual(restored.checkpoint(content), original.checkpoint(content));
  assert.equal(JSON.stringify(snapshot), bytes);
  assert.equal(restored.add('owner', tnt, [0.5, 65, 0.5], rule), 'tnt-13');
});

test('TNT recovery rejects forged strength/state/timing, duplicates and nonfinite data without mutating a live collection', () => {
  const explosives = new Explosives();
  explosives.add('a', tnt, [0.5, 65, 0.5], rule);
  for (let i = 0; i < 10; i++) explosives.step(unloaded);
  const snapshot = explosives.checkpoint(content),
    before = JSON.stringify(snapshot);
  const mutations: ((v: any) => void)[] = [
    (v) => (v.schema = 2),
    (v) => (v.contentHash = 'wrong'),
    (v) => (v.next = 0),
    (v) => (v.extra = true),
    (v) => v.entries.push(v.entries[0]),
    (v) => (v.entries = Array(1)),
    (v) => (v.entries[0].state = 0),
    (v) => (v.entries[0].rule = { fuse: 900, radius: 4, damage: 20 }),
    (v) => (v.entries[0].damage = 20),
    (v) => (v.entries[0].remaining = 121),
    (v) => (v.entries[0].remaining = 111),
    (v) => (v.entries[0].total = 901),
    (v) => (v.entries[0].position = [0, 256, 0]),
    (v) => (v.entries[0].velocity = [NaN, 0, 0]),
    (v) => (v.entries[0].owner = ''),
    (v) => (v.entries[0].revision = -1),
    (v) => v.entries.push({ ...v.entries[0], id: 'tnt-2', state: 1 }),
  ];
  for (const mutate of mutations) {
    const v = json(snapshot);
    mutate(v);
    assert.throws(() => Explosives.fromCheckpoint(content, v), /invalid explosives checkpoint/);
  }
  assert.equal(JSON.stringify(explosives.checkpoint(content)), before);
  const wrong = new Explosives();
  wrong.add('a', tnt, [0, 65, 0], { ...rule, damage: rule.damage - 1 });
  assert.throws(() => wrong.checkpoint(content), /content mismatch/);
});
