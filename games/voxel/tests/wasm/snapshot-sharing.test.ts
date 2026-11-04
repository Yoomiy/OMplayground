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

test('public playback lead smooths whole-input timing without contaminating self reconciliation', () => {
  const f = roomFixture('creative');
  try {
    f.join('b');
    const a = f.player();
    // A 25 ms sample leaves a fractional remainder in a 30 Hz server tick.
    f.room.receive(
      'a',
      {
        type: 'input',
        frames: [1, 2].map((sequence) => ({
          epoch: a.epoch,
          sequence,
          dt: 0.025,
          x: 1,
          z: 0,
          yaw: 0,
          pitch: 0,
          jump: false,
          sneak: false,
          sprint: false,
        })),
      },
      f.now,
    );
    f.elapse(1000 / 30);
    const snapshot = (id: string) =>
      f.events.get(id)!.findLast((e): e is Snapshot => 'type' in e && e.type === 'snapshot')!;
    const own = snapshot('a').self!.state,
      raw = f.state();
    assert.equal(own[0], Math.round(raw[0] * 10000) / 10000);
    const peer = snapshot('b').actors.find((delta) => delta.id === 'a');
    const visible = peer?.state ?? f.player('b').visible.get('a')!.state;
    assert(a.queue.lead > 0);
    assert.equal(visible[0], Math.round((own[0] + own[3] * a.queue.lead) * 10000) / 10000);
    assert(visible[0] > own[0]);
    assert.equal(snapshot('a').self!.ack, 1);
    // The first publication may be actor_joined. Apply subsequent wire deltas
    // exactly as a peer does; each must retain the same compensated timeline.
    let replica = f.player('b').visible.get('a')!;
    let sawDelta = false;
    for (let sequence = 3; sequence <= 10; sequence++) {
      f.events.get('b')!.length = 0;
      f.room.receive(
        'a',
        {
          type: 'input',
          frames: [
            {
              epoch: a.epoch,
              sequence,
              dt: 0.025,
              x: 1,
              z: 0,
              yaw: 0,
              pitch: 0,
              jump: false,
              sneak: false,
              sprint: false,
            },
          ],
        },
        f.now,
      );
      f.elapse(1000 / 30);
      for (const event of f.events.get('b')!) {
        if (!('type' in event)) continue;
        if (event.type === 'snapshot')
          for (const delta of event.actors)
            if (delta.id === 'a') {
              sawDelta = true;
              replica = { ...replica, ...delta };
            }
      }
      const self = snapshot('a').self!.state;
      assert.deepEqual(
        replica.state,
        self.map((value, axis, body) =>
          axis < 3 && !body[12]
            ? Math.round((value + body[axis + 3] * a.queue.lead) * 10000) / 10000
            : value,
        ),
        `peer delta at input ${sequence} must preserve public playback lead`,
      );
      assert.deepEqual(replica, f.player('b').visible.get('a'));
      assert.equal(self[0], Math.round(f.state()[0] * 10000) / 10000);
    }
    assert(sawDelta, 'exercise ongoing movement deltas rather than only actor_joined');
  } finally {
    f.room.dispose();
  }
});
