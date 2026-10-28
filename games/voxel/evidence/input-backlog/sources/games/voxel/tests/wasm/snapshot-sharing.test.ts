import assert from 'node:assert/strict';
import { test } from 'node:test';
import { roomFixture } from './room-fixture.ts';
import { SnapshotEncoder } from '../../src/server/snapshot-encoder.ts';
import type { ServerMessage } from '../../src/shared/protocol.ts';
type Snapshot = Extract<ServerMessage, { type: 'snapshot' }>;
test('real room shares identical deltas across viewers without changing visibility or private self', () => {
  const f = roomFixture();
  try {
    f.join('b');
    f.join('c');
    f.join('teacher', 'observer');
    f.tick(6);
    for (const events of f.events.values()) events.length = 0;
    f.controls.set('a', { ...f.controls.get('a')!, yaw: 0.7, pitch: -0.2 });
    f.controls.set('teacher', { ...f.controls.get('teacher')!, yaw: -0.8 });
    f.tick(2);
    const snapshot = (id: string) =>
      f.events.get(id)!.findLast((e): e is Snapshot => 'type' in e && e.type === 'snapshot')!;
    const b = snapshot('b'),
      c = snapshot('c');
    assert(b && c);
    const deltaB = b.actors.find((a) => a.id === 'a'),
      deltaC = c.actors.find((a) => a.id === 'a');
    assert(deltaB && deltaC);
    assert.equal(deltaB, deltaC, 'one owned delta can be reused across identical viewer baselines');
    assert.equal(
      b.actors.some((a) => a.id === 'teacher'),
      false,
    );
    assert.equal(
      c.actors.some((a) => a.id === 'teacher'),
      false,
    );
    const encoder = new SnapshotEncoder();
    for (const id of ['a', 'b', 'c', 'teacher'])
      for (const event of f.events.get(id)!) {
        if ('type' in event) assert.deepEqual(JSON.parse(encoder.encode(event)), event);
      }
    const frozen = JSON.stringify(b);
    f.controls.set('a', { ...f.controls.get('a')!, yaw: -0.4 });
    f.tick(4);
    assert.equal(JSON.stringify(b), frozen, 'later ticks cannot mutate a prior shared delta');
  } finally {
    f.room.dispose();
  }
});
