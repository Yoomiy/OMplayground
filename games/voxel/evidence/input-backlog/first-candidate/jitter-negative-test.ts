import assert from 'node:assert/strict';
import { test } from 'node:test';
import { InputQueue } from '/tmp/voxel-input-backlog-first-queue.ts';
import { FixedScheduler } from '/home/ubuntu/OMplayground/games/voxel/src/sim/scheduler.ts';
import { ActionLedger } from '/home/ubuntu/OMplayground/games/voxel/src/sim/action-ledger.ts';
import { isInputFrame, MOVEMENT_DT, movementWish, NEUTRAL } from '/home/ubuntu/OMplayground/games/voxel/src/shared/input.ts';
const frame = (sequence: number, epoch = 1) => ({
  epoch,
  sequence,
  x: 1,
  z: 0,
  yaw: 0,
  pitch: 0,
  jump: false,
  sneak: false,
  sprint: false,
});
test('input bursts cannot buy more simulated movement time', () => {
  function run(burst: number) {
    const q = new InputQueue(1),
      scheduler = new FixedScheduler(0);
    let sequence = 0,
      distance = 0,
      steps = 0;
    for (let i = 0; i < burst; i++) q.receive(frame(++sequence), 0);
    for (let time = 1; time <= 1000; time++) {
      if (time % 16 === 0) q.receive(frame(++sequence), time);
      scheduler.advance(time, () => {
        for (let i = 0; i < 2; i++) {
          distance += q.take(time).controls.x * MOVEMENT_DT * 4;
          steps++;
        }
      });
    }
    return { distance, steps };
  }
  const normal = run(0),
    burst = run(10000);
  assert.equal(burst.steps, 60);
  assert.equal(normal.steps, 60);
  assert.equal(burst.distance, normal.distance);
  assert.ok(burst.distance <= 4.000001);
});
test('a recovered steady 60 Hz stream clears transport backlog without extra simulation steps', () => {
  const queue = new InputQueue(1);
  let sequence = 0,
    steps = 0;
  // One second of controls arrives together after a real link resumes.
  for (let n = 0; n < 60; n++) queue.receive(frame(++sequence), 1000);
  for (let tick = 0; tick < 90; tick++) {
    const now = 1000 + (tick * 1000) / 30;
    for (let n = 0; n < 2; n++) queue.receive(frame(++sequence), now);
    for (let n = 0; n < 2; n++) {
      queue.take(now);
      steps++;
    }
  }
  assert.equal(steps, 180, 'draining backlog never creates movement substeps');
  assert(
    queue.received - queue.ack <= 2,
    'a restored link must not retain old input latency indefinitely',
  );
});
test('backlog recovery retires stale presses while consuming fresh look and jump only on scheduled steps', () => {
  const queue = new InputQueue(1);
  for (let sequence = 1; sequence <= 8; sequence++)
    queue.receive({ ...frame(sequence), jump: sequence === 1, yaw: -1 }, 0);
  queue.receive({ ...frame(9), x: 0, yaw: 0.5 }, 0);
  queue.receive({ ...frame(10), x: 0, yaw: 0.6, jump: true }, 0);
  assert.equal(queue.ack, 0, 'receipts alone do not consume pending look or controls');
  const first = queue.take(100);
  assert.equal(first.resync, true);
  assert.equal(first.controls.x, 0);
  assert.equal(first.controls.yaw, 0.5);
  assert.equal(first.controls.jump, false);
  const next = queue.take(100);
  assert.equal(next.controls.yaw, 0.6);
  assert.equal(next.controls.jump, true);
  assert.equal(queue.ack, 10);
  assert.equal(queue.take(101).controls.jump, false);
});
test('brief packet jitter drains naturally without retiring valid controls or requesting resync', () => {
  const queue = new InputQueue(1);
  for (let sequence = 1; sequence <= 6; sequence++)
    queue.receive({ ...frame(sequence), jump: sequence === 1 }, 0);
  // Three packets arrive together, followed by a gap while the next two ticks drain.
  const consumed = [];
  for (const now of [0, 0, 1000 / 30, 1000 / 30, 2000 / 30, 2000 / 30]) {
    const input = queue.take(now);
    assert.equal(input.resync, false);
    consumed.push({ ack: queue.ack, jump: input.controls.jump });
  }
  assert.deepEqual(
    consumed.map((x) => x.ack),
    [1, 2, 3, 4, 5, 6],
  );
  assert.deepEqual(
    consumed.map((x) => x.jump),
    [true, false, false, false, false, false],
  );
  assert.equal(queue.size, 0);
});
test('a smaller persistent backlog also clears after the jitter grace period without overflow', () => {
  const queue = new InputQueue(1);
  let sequence = 0,
    resyncs = 0;
  for (let n = 0; n < 6; n++) queue.receive(frame(++sequence), 0);
  for (let tick = 0; tick < 30; tick++) {
    const now = (tick * 1000) / 30;
    for (let n = 0; n < 2; n++) queue.receive(frame(++sequence), now);
    for (let n = 0; n < 2; n++) if (queue.take(now).resync) resyncs++;
    if (tick >= 4) assert(queue.received - queue.ack <= 2);
  }
  assert.equal(resyncs, 1);
});
test('fresh queued input proves liveness while consumed aim stays authoritative; rejected packets never renew it', () => {
  const q = new InputQueue(1);
  q.receive(frame(1), 0);
  assert.equal(
    q.take(150).controls.x,
    1,
    'a scheduled frame remains valid within the 200 ms queue age',
  );
  assert.equal(q.active(150), false);
  q.receive({ ...frame(2), yaw: 1 }, 150);
  assert.equal(
    q.active(150),
    true,
    'fresh accepted input must not look offline behind an older consumed frame',
  );
  assert.equal(q.take(151).controls.yaw, 1);
  assert.equal(q.receive(frame(2), 249), 'duplicate');
  assert.equal(q.receive(frame(3, 2), 249), 'stale_epoch');
  assert.equal(q.receive({ ...frame(3), x: Infinity }, 249), 'invalid');
  assert.equal(q.active(251), false);
  q.reset(2);
  assert.equal(q.active(251), false);
});
test('queues expire, transient presses clear, overflow requests resync, epochs invalidate', () => {
  const q = new InputQueue(1);
  for (let i = 1; i <= 12; i++) assert.equal(q.receive(frame(i), 0), 'accepted');
  assert.equal(q.receive(frame(13), 0), 'resync');
  assert.equal(q.size, 12);
  assert.equal(q.receive(frame(13), 1), 'duplicate');
  assert.equal(q.take(201).resync, true);
  assert.equal(q.take(202).controls.x, 0);
  assert.equal(q.receive({ ...frame(14), jump: true }, 210), 'accepted');
  assert.equal(q.take(210).controls.jump, true);
  assert.equal(q.take(220).controls.jump, false);
  assert.equal(q.take(311).controls.x, 0);
  q.receive(frame(15), 312);
  q.reset(2);
  assert.equal(q.take(313).controls.x, 0);
  assert.equal(q.receive(frame(16), 313), 'stale_epoch');
  assert.equal(q.receive(frame(1, 2), 314), 'accepted');
});
test('positions, durations, client clocks, and nonfinite controls are rejected', () => {
  for (const extra of [
    { dt: 10 },
    { position: [1, 2, 3] },
    { timestamp: 10 },
    { x: NaN },
    { yaw: Infinity },
    { epoch: 0 },
    { z: 2 },
  ]) {
    assert.equal(isInputFrame({ ...frame(1), ...extra }), false);
  }
  assert.ok(Math.hypot(...movementWish({ ...frame(1), z: 1 })) <= 1.0000001);
});
test('epoch resets retain consumed look direction while discarding pending view and movement', () => {
  const queue = new InputQueue(1);
  queue.receive({ ...frame(1), yaw: 1, pitch: 0.3, jump: true }, 0);
  queue.take(0);
  queue.receive({ ...frame(2), yaw: 2, pitch: -0.4 }, 1);
  queue.reset(2);
  assert.deepEqual(queue.take(2).controls, { ...NEUTRAL, yaw: 1, pitch: 0.3 });
  assert.equal(queue.size, 0);
  assert.equal(queue.ack, 0);
  assert.equal(queue.receive(frame(3), 3), 'stale_epoch');
  const rejoined = new InputQueue(7, { yaw: 1, pitch: 0.3 });
  assert.deepEqual(rejoined.take(100).controls, { ...NEUTRAL, yaw: 1, pitch: 0.3 });
});
test('scheduler bounds stalls without an unbounded catch-up queue', () => {
  const s = new FixedScheduler(0);
  let ticks = 0;
  const result = s.advance(10000, () => ticks++);
  assert.equal(ticks, 4);
  assert.ok(result.droppedMs > 9800);
  assert.equal(s.advance(10000, () => ticks++).steps, 0);
  assert.throws(() => s.advance(9999, () => {}));
});
test('evicted command results cannot execute again, including after reconnect', () => {
  const ledger = new ActionLedger<number>(1, 2);
  let items = 0;
  const craft = () => ++items;
  assert.deepEqual(ledger.run(1, 1, craft), { status: 'applied', value: 1 });
  assert.deepEqual(ledger.run(1, 1, craft), { status: 'cached', value: 1 });
  ledger.run(1, 2, craft);
  ledger.run(1, 3, craft);
  assert.deepEqual(ledger.run(1, 1, craft), { status: 'retired' });
  assert.equal(items, 3);
  ledger.reset(2);
  assert.deepEqual(ledger.run(1, 4, craft), { status: 'stale_epoch' });
  assert.equal(items, 3);
  ledger.run(2, 1, craft);
  assert.equal(items, 4);
});
