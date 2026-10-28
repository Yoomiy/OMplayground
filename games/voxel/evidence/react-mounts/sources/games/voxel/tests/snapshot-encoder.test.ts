import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SnapshotEncoder } from '../src/server/snapshot-encoder.ts';
import { emptyAppearance } from '../src/shared/appearance.ts';
import type { ActorDelta, ServerMessage } from '../src/shared/protocol.ts';
import type { DropView } from '../src/shared/gameplay.ts';

type Snapshot = Extract<ServerMessage, { type: 'snapshot' }>;
const state = (x: number) => [x, 64, 2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
test('immutable drop JSON is reused across viewers and passes, preserving split/reset/removal and historical revisions', () => {
  const encoder = new SnapshotEncoder();
  let serializations = 0;
  const value = Object.freeze({
    id: 'drop-"\\שלום',
    revision: 0,
    stack: Object.freeze({
      itemType: 'iron_pickaxe',
      count: 1,
      instance: Object.freeze({ durability: 17 }),
    }),
    position: Object.freeze([0, 65, 1]) as readonly [number, number, number],
  });
  const drop = new Proxy<DropView>(value, {
    get(target, key, receiver) {
      if (key === 'toJSON') serializations++;
      return Reflect.get(target, key, receiver);
    },
  });
  const first: Extract<ServerMessage, { type: 'drops' }> = {
    type: 'drops',
    reset: true,
    upsert: [drop],
    removed: [],
  };
  const expected = JSON.stringify(first);
  serializations = 0;
  assert.equal(encoder.encode(first), expected);
  encoder.encode({ type: 'snapshot', time: 100, tick: 2, actors: [] });
  assert.equal(
    encoder.encode({ ...first, reset: false }),
    expected.replace('"reset":true', '"reset":false'),
  );
  assert.equal(serializations, 1);
  const next = Object.freeze({
    ...value,
    revision: 1,
    stack: Object.freeze({ ...value.stack, instance: Object.freeze({ durability: 16 }) }),
  });
  const updated = { ...first, reset: false, upsert: [next], removed: ['other-"\\שלום'] };
  assert.equal(encoder.encode(updated), JSON.stringify(updated));
  assert.equal(encoder.encode(first), expected);
  const split = { ...first, upsert: [], removed: [drop.id] };
  assert.equal(encoder.encode(split), JSON.stringify(split));
});
test('mutable drop views and shallowly frozen views never reuse stale nested data', () => {
  const encoder = new SnapshotEncoder();
  for (const freeze of [false, true]) {
    const drop: DropView = {
      id: 'same',
      revision: 0,
      stack: { itemType: 'stone', count: 3 },
      position: [0, 65, 1],
    };
    if (freeze) Object.freeze(drop);
    const message: Extract<ServerMessage, { type: 'drops' }> = {
      type: 'drops',
      reset: false,
      upsert: [drop],
      removed: [],
    };
    assert.equal(encoder.encode(message), JSON.stringify(message));
    Reflect.set(drop.stack, 'count', 2);
    Reflect.set(drop.position, '0', 4);
    assert.equal(encoder.encode(message), JSON.stringify(message));
  }
});
test('snapshot encoding preserves every delta shape, split message, self and escaped identity', () => {
  const encoder = new SnapshotEncoder();
  const actors: ActorDelta[] = Array.from({ length: 16 }, (_, mask) => ({
    id: `actor-"\\שלום-${mask}`,
    ...(mask & 1 ? { state: state(mask) } : {}),
    ...(mask & 2 ? { yaw: mask / 16 } : {}),
    ...(mask & 4 ? { pitch: -mask / 16 } : {}),
    ...(mask & 8 ? { appearance: emptyAppearance() } : {}),
  }));
  for (const self of [undefined, { epoch: 2, ack: 18, state: state(17) }]) {
    const snapshot: Snapshot = {
      type: 'snapshot',
      time: 1234.5,
      tick: 60,
      ...(self ? { self } : {}),
      actors,
    };
    assert.deepEqual(JSON.parse(encoder.encode(snapshot)), snapshot);
    assert.equal(encoder.encode(snapshot), JSON.stringify(snapshot));
  }
  const fallback: ServerMessage = { type: 'actor_removed', id: 'other' };
  assert.equal(encoder.encode(fallback), JSON.stringify(fallback));
});

test('shared actor deltas serialize once per pass while private self never crosses viewers', () => {
  const encoder = new SnapshotEncoder();
  let serializations = 0;
  const delta = new Proxy<ActorDelta>(
    { id: 'shared', state: state(5), yaw: 0.1 },
    {
      ownKeys(target) {
        serializations++;
        return Reflect.ownKeys(target);
      },
    },
  );
  for (const id of [21, 42]) {
    const snapshot: Snapshot = {
      type: 'snapshot',
      time: 100,
      tick: 3,
      self: { epoch: id, ack: id + 1, state: state(id) },
      actors: [delta],
    };
    const decoded = JSON.parse(encoder.encode(snapshot));
    assert.equal(decoded.self.epoch, id);
    assert.equal(decoded.self.state[0], id);
    assert.equal(decoded.actors[0].state[0], 5);
  }
  assert.equal(serializations, 1);
  const split: Snapshot = { type: 'snapshot', time: 100, tick: 3, actors: [delta] };
  assert.equal('self' in JSON.parse(encoder.encode(split)), false);
  assert.equal(serializations, 1);
  encoder.encode({ ...split, time: 101 });
  assert.equal(serializations, 2, 'paused observers advance time without advancing the world tick');
  encoder.encode({ ...split, time: 101, tick: 4 });
  assert.equal(serializations, 3);
});

test('a different viewer delta for the same actor never reuses omitted fields or another baseline', () => {
  const encoder = new SnapshotEncoder();
  const variants: ActorDelta[] = [
    { id: 'same', state: state(1), yaw: 0.5 },
    { id: 'same', appearance: emptyAppearance() },
    { id: 'same', pitch: 0.3 },
  ];
  for (const delta of variants) {
    const message: Snapshot = { type: 'snapshot', time: 1, tick: 1, actors: [delta] };
    assert.deepEqual(JSON.parse(encoder.encode(message)), message);
  }
});
