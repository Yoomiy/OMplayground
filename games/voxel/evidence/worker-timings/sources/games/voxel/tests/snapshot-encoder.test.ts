import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SnapshotEncoder } from '../src/server/snapshot-encoder.ts';
import { emptyAppearance } from '../src/shared/appearance.ts';
import type { ActorDelta, ServerMessage } from '../src/shared/protocol.ts';

type Snapshot = Extract<ServerMessage, { type: 'snapshot' }>;
const state = (x: number) => [x, 64, 2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
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
