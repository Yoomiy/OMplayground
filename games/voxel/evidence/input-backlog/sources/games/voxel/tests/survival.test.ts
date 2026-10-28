import assert from 'node:assert/strict';
import { test } from 'node:test';
import { source } from '../content/index.ts';
import { compileContent } from '../tools/compile-content.ts';
import { Inventories } from '../src/sim/inventory.ts';
import { miningPlan } from '../src/sim/mining.ts';
import { parseClientMessage, parseServerMessage } from '../src/shared/protocol.ts';
const content = compileContent(source).manifest;
const inventory = () => {
  const value = new Inventories(content, { station: () => null, canUse: () => false });
  value.join('a');
  return value;
};
test('owned placement commits one item with the world, rejects stale selection/revision, and rolls back a failed edit', () => {
  const i = inventory();
  i.transact('a', { kind: 'give', itemType: 'dirt', count: 3, revision: 0 }, true);
  let edits = 0;
  assert.equal(
    i.place('a', 1, 'stone', () => {
      edits++;
      return true;
    }).reason,
    'not_owned',
  );
  assert.equal(edits, 0);
  const before = i.view('a');
  assert.equal(i.place('a', 1, 'dirt', () => false).ok, false);
  assert.deepEqual(i.view('a'), before);
  assert.equal(
    i.place('a', 1, 'dirt', () => {
      edits++;
      return true;
    }).ok,
    true,
  );
  assert.equal(i.view('a').bag[0]?.count, 2);
  assert.equal(edits, 1);
  assert.equal(
    i.place('a', 1, 'dirt', () => {
      edits++;
      return true;
    }).reason,
    'conflict',
  );
  i.transact('a', { kind: 'select', slot: 1, revision: 2 }, false);
  assert.equal(
    i.place('a', 3, 'dirt', () => {
      edits++;
      return true;
    }).reason,
    'not_owned',
  );
  assert.equal(edits, 1);
});
test('mining requirements/speed come from content and tool wear breaks the final durable instance exactly once', () => {
  const stone = content.behavior.find((b) => b.family === 'stone')!;
  assert.equal(miningPlan(stone, undefined).allowed, false);
  assert.equal(
    miningPlan(
      stone,
      content.items.find((i) => i.itemType === 'wooden_shovel'),
    ).allowed,
    false,
  );
  assert.deepEqual(
    miningPlan(
      stone,
      content.items.find((i) => i.itemType === 'wooden_pickaxe'),
    ),
    { allowed: true, ticks: 15 },
  );
  const i = inventory();
  i.transact('a', { kind: 'give', itemType: 'wooden_pickaxe', count: 1, revision: 0 }, true);
  let blocks = 0;
  const original = i.held('a');
  assert.equal(i.mine('a', original.slot, original.stack, () => false).ok, false);
  assert.equal(i.held('a').stack?.instance?.durability, 60);
  for (let n = 0; n < 60; n++) {
    const held = i.held('a');
    assert.equal(
      i.mine('a', held.slot, held.stack, () => {
        blocks++;
        return true;
      }).ok,
      true,
    );
  }
  assert.equal(blocks, 60);
  assert.equal(i.held('a').stack, null);
  assert.equal(
    i.mine('a', original.slot, original.stack, () => {
      blocks++;
      return true;
    }).reason,
    'tool_changed',
  );
  assert.equal(blocks, 60);
});
test('partial pickups preserve remainder and durable metadata, and failed throw callbacks do not consume the bag', () => {
  const i = inventory();
  i.transact('a', { kind: 'give', itemType: 'wooden_pickaxe', count: 35, revision: 0 }, true);
  i.transact('a', { kind: 'give', itemType: 'stone', count: 63, revision: 1 }, true);
  assert.equal(i.receive('a', { itemType: 'stone', count: 5 }), 1);
  assert.equal(i.receive('a', { itemType: 'stone', count: 4 }), 0);
  assert.equal(i.view('a').bag[35]?.count, 64);
  const previous = i.view('a');
  assert.throws(() =>
    i.drop('a', 35, 1, previous.revision, () => {
      throw new Error('failed allocation');
    }),
  );
  assert.deepEqual(i.view('a'), previous);
  let thrown: unknown;
  assert.equal(
    i.drop('a', 0, 1, previous.revision, (stack) => {
      thrown = stack;
    }).ok,
    true,
  );
  assert.equal(
    i.receive('a', { itemType: 'wooden_pickaxe', count: 1, instance: { durability: 7 } }),
    1,
  );
  assert.deepEqual(i.view('a').bag[0], {
    itemType: 'wooden_pickaxe',
    count: 1,
    instance: { durability: 7 },
  });
  assert.deepEqual(thrown, { itemType: 'wooden_pickaxe', count: 1, instance: { durability: 60 } });
});
test('mining and drop protocol carries intents only, bounds replication batches and rejects forged completion/positions', () => {
  const message = {
    type: 'mining',
    epoch: 1,
    sequence: 1,
    inputSequence: 1,
    target: [0, 64, -2],
    revision: 0,
    inventoryRevision: 0,
  };
  assert.ok(parseClientMessage(JSON.stringify(message)));
  for (const extra of [
    { elapsed: 1e9 },
    { position: [0, 0, 0] },
    { complete: true },
    { seconds: 0 },
  ])
    assert.equal(parseClientMessage(JSON.stringify({ ...message, ...extra })), null);
  assert.equal(parseClientMessage(JSON.stringify({ ...message, target: [256, 64, 0] })), null);
  assert.ok(
    parseServerMessage(
      JSON.stringify({ type: 'mining', epoch: 1, target: null, total: 0, elapsed: 0 }),
    ),
  );
  assert.equal(
    parseServerMessage(
      JSON.stringify({ type: 'mining', epoch: 1, target: [0, 64, 0], total: 30, elapsed: 31 }),
    ),
    null,
  );
  const drop = {
    id: 'drop-1',
    revision: 0,
    position: [0.5, 64, -2.5],
    stack: { itemType: 'dirt', count: 1 },
  };
  assert.ok(
    parseServerMessage(JSON.stringify({ type: 'drops', reset: true, upsert: [drop], removed: [] })),
  );
  assert.equal(
    parseServerMessage(
      JSON.stringify({ type: 'drops', reset: true, upsert: Array(65).fill(drop), removed: [] }),
    ),
    null,
  );
  assert.equal(
    parseServerMessage(
      JSON.stringify({
        type: 'drops',
        reset: true,
        upsert: [{ ...drop, stack: { itemType: 'dirt', count: 0 } }],
        removed: [],
      }),
    ),
    null,
  );
});
