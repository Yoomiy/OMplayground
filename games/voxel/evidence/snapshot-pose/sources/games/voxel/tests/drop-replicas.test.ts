import assert from 'node:assert/strict';
import { test } from 'node:test';
import { source } from '../content/index.ts';
import { compileContent } from '../tools/compile-content.ts';
import { Drops } from '../src/sim/drops.ts';
import type { WorldPort } from '../src/shared/engine-port.ts';
import { DROP_LIFETIME_TICKS } from '../src/shared/gameplay.ts';
const content = compileContent(source).manifest;
test('shared drop replicas retain immutable public ownership across viewers, movement, partial pickup and recovery', () => {
  const drops = new Drops(content);
  const id = drops.add(
    { itemType: 'iron_pickaxe', count: 1, instance: { durability: 17 } },
    [0, 65, 0],
    0,
    'private-owner',
  );
  const stone = drops.add({ itemType: 'stone', count: 3 }, [2, 65, 0], 0);
  const a = drops.snapshot([0, 65, 0], 2),
    b = drops.snapshot([1, 65, 0], 1);
  assert.deepEqual(a, drops.nearby([0, 65, 0], 2));
  assert.equal(a[0], b[0]);
  assert.equal(a[1], b[1]);
  assert.deepEqual(Object.keys(a[0]), ['id', 'revision', 'stack', 'position']);
  assert.equal(a[0].id, id);
  assert(
    Object.isFrozen(a[0]) &&
      Object.isFrozen(a[0].stack) &&
      Object.isFrozen(a[0].stack.instance) &&
      Object.isFrozen(a[0].position),
  );
  const bytes = JSON.stringify(a);
  assert.equal(Reflect.set(a[0].stack.instance!, 'durability', 1), false);
  const mutable = drops.nearby([0, 65, 0], 2);
  assert.equal(Reflect.set(mutable[0].stack.instance!, 'durability', 1), true);
  assert.equal(drops.nearby([0, 65, 0], 2)[0].stack.instance!.durability, 17);
  a.pop();
  assert.equal(b.length, 2);
  drops.take(stone, 1);
  const partial = drops.snapshot([0, 65, 0], 2);
  assert.notEqual(partial[1], b[1]);
  assert.equal(partial[1].stack.count, 2);
  assert.equal(b[1].stack.count, 3);
  const world = {
    has_column: () => true,
    sweep_body: (x: number, y: number, z: number) => [x + 0.25, y, z, 0, 0, 0],
  } as unknown as WorldPort;
  drops.step(world, 1);
  const moved = drops.snapshot([0, 65, 0], 3);
  assert.notEqual(moved[0], b[0]);
  assert.equal(moved[0].position[0], 0.25);
  assert.equal(JSON.stringify(b), bytes);
  const restored = Drops.fromCheckpoint(content, JSON.parse(JSON.stringify(drops.checkpoint(1))));
  assert.deepEqual(restored.snapshot([0, 65, 0], 3), moved);
  drops.take(stone, 2);
  assert.equal(drops.snapshot([0, 65, 0], 3).length, 1);
  drops.step(world, DROP_LIFETIME_TICKS);
  assert.deepEqual(drops.snapshot([0, 65, 0], 3), []);
  restored.dispose();
  assert.deepEqual(restored.snapshot([0, 65, 0], 3), []);
});
test('replica radius queries preserve insertion order and exact inclusion boundaries', () => {
  const drops = new Drops(content);
  for (const x of [0, 1, 2, -2, 2.000001])
    drops.add({ itemType: 'stone', count: 1 }, [x, 65, 0], 0);
  for (const radius of [0, 1, 2, -1, NaN, Infinity])
    assert.deepEqual(drops.snapshot([0, 65, 0], radius), drops.nearby([0, 65, 0], radius));
});
