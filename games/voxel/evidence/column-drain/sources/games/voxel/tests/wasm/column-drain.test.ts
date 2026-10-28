import assert from 'node:assert/strict';
import { test } from 'node:test';
import { roomFixture } from './room-fixture.ts';
import { content } from './fixture.ts';
import { localIndex } from '../../src/shared/chunk-wire.ts';
import type { ChunkFrame } from '../../src/shared/chunk-wire.ts';
import type { Cell } from '../../src/shared/protocol.ts';

test('delayed baselines include accepted edits; sent baselines retain contiguous patches and resync captures current state', () => {
  let held = true;
  const f = roomFixture('creative', 0, false, undefined, undefined, () => !held);
  try {
    const a = f.target('stone'),
      b: Cell = [a[0] + 1, a[1], a[2]],
      c: Cell = [a[0] + 2, a[1], a[2]];
    f.store.set(...b, content.defaults.stone);
    f.store.set(...c, content.defaults.stone);
    const frames = () => f.events.get('a')!.filter((e): e is ChunkFrame => 'kind' in e);
    const remove = (cell: Cell) => {
      f.aim(cell);
      const result = f.send({
        type: 'action',
        kind: 'remove',
        epoch: f.player().epoch,
        sequence: f.next(),
        inputSequence: f.inputs.get('a')!,
        target: cell,
        state: 0,
        inventoryRevision: f.room.inventories.held('a').revision,
        revisions: [
          {
            x: cell[0] >> 4,
            z: cell[2] >> 4,
            revision: f.store.revision(cell[0] >> 4, cell[2] >> 4),
          },
        ],
      });
      assert.equal(result.outcome?.ok, true, JSON.stringify(result));
    };
    remove(a);
    assert.equal(frames().length, 0, 'no patch precedes a pending initial baseline');
    held = false;
    f.room.flushChunks('a');
    assert.equal(frames().length, 49);
    const first = frames().find((e) => e.x === a[0] >> 4 && e.z === a[2] >> 4)!;
    assert.equal(first.kind, 'baseline');
    assert.equal(first.revision, 4);
    assert(first.edits.some(([index, state]) => index === localIndex(...a) && state === 0));
    remove(b);
    const patch = frames().at(-1)!;
    assert.equal(patch.kind, 'patch');
    assert.equal(patch.revision, first.revision + 1);
    assert.equal(first.revision, 4, 'retained baseline is immutable');
    held = true;
    f.room.receive(
      'a',
      { type: 'resync', x: first.x, z: first.z, subscription: first.subscription },
      f.now,
    );
    const count = frames().length;
    remove(c);
    assert.equal(frames().length, count, 'pending resync folds later edits into its baseline');
    held = false;
    f.room.flushChunks('a');
    const latest = frames().at(-1)!;
    assert.equal(latest.kind, 'baseline');
    assert.equal(latest.subscription, first.subscription);
    assert.equal(latest.revision, 6);
    for (const cell of [a, b, c])
      assert(latest.edits.some(([index, state]) => index === localIndex(...cell) && state === 0));
  } finally {
    f.room.dispose();
  }
});

test('pending terrain follows current subscriptions and cannot revive unloaded or disconnected incarnations', () => {
  let held = true;
  const f = roomFixture('creative', 0, false, undefined, undefined, () => !held);
  try {
    const old = new Set([...f.player().subscriptions.values()].map((s) => s.id));
    const p = f.state();
    p[0] += 128;
    f.store.world.player_restore(f.player().slot, p);
    f.tick(3);
    assert([...f.player().subscriptions.values()].every((s) => !old.has(s.id)));
    f.events.get('a')!.length = 0;
    held = false;
    f.room.flushChunks('a');
    const frames = f.events.get('a')!.filter((e): e is ChunkFrame => 'kind' in e);
    assert.equal(frames.length, 49);
    assert(frames.every((e) => !old.has(e.subscription)));
    held = true;
    const sub = [...f.player().subscriptions.values()][0];
    f.room.receive('a', { type: 'resync', x: sub.x, z: sub.z, subscription: sub.id }, f.now);
    f.room.disconnect('a', f.now);
    f.events.get('a')!.length = 0;
    held = false;
    f.room.flushChunks('a');
    assert.equal(f.events.get('a')!.length, 0);
    f.join('a');
    assert(f.events.get('a')!.some((e) => 'kind' in e && e.kind === 'baseline'));
  } finally {
    f.room.dispose();
  }
});
