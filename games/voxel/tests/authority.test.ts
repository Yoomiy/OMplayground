import assert from 'node:assert/strict';
import { test } from 'node:test';
import { InputQueue } from '../src/sim/input-queue.ts';
import { FixedScheduler } from '../src/sim/scheduler.ts';
import { ActionLedger } from '../src/sim/action-ledger.ts';
import { isInputFrame, MOVEMENT_DT, movementWish, NEUTRAL } from '../src/shared/input.ts';
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
test('starved playback never invents movement or advances acknowledgements', () => {
  const q = new InputQueue(1),
    applied: number[] = [];
  q.receive(frame(1), 0);
  q.receive(frame(2), 0);
  q.advance(1 / 30, (f) => applied.push(f.sequence));
  assert.equal(applied.length, 0, 'prime a small cushion first');
  q.receive(frame(3), 33);
  q.advance(1 / 30, (f) => applied.push(f.sequence));
  for (let n = 0; n < 20; n++) q.advance(1 / 30, (f) => applied.push(f.sequence));
  assert.deepEqual(applied, [1, 2, 3]);
  assert.equal(q.ack, 3);
});
test('ordinary arrival jitter preserves every input and press, without resync', () => {
  const q = new InputQueue(1),
    applied: number[] = [],
    jumps: number[] = [];
  for (let n = 1; n <= 8; n++)
    assert.equal(q.receive({ ...frame(n), jump: n === 3 }, 0), 'accepted');
  assert.equal(q.ack, 0);
  for (let tick = 0; tick < 10; tick++)
    q.advance(1 / 30, (f) => {
      applied.push(f.sequence);
      if (f.jump) jumps.push(f.sequence);
    });
  assert.deepEqual(applied, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(jumps, [3]);
});
test('persistent surplus drains gradually without retiring identities', () => {
  const q = new InputQueue(1);
  let sequence = 0,
    applied = 0;
  for (let n = 0; n < 8; n++) q.receive(frame(++sequence), 0);
  for (let tick = 0; tick < 180; tick++) {
    for (let n = 0; n < 2; n++)
      assert.equal(q.receive(frame(++sequence), (tick * 1000) / 30), 'accepted');
    q.advance(1 / 30, () => applied++);
  }
  assert(q.size <= 5, `remaining cushion ${q.size}`);
  assert.equal(q.ack, applied);
});
test('a long transport backlog catches up without discarding input', () => {
  const q = new InputQueue(1),
    applied: number[] = [];
  for (let n = 1; n <= 60; n++) q.receive(frame(n), 0);
  for (let tick = 0; tick < 40; tick++) {
    let duration = 0;
    q.advance(1 / 30, (f) => {
      duration += f.dt ?? MOVEMENT_DT;
      applied.push(f.sequence);
    });
    assert(duration <= 1, 'catch-up remains bounded by the queue limit');
  }
  assert.deepEqual(
    applied,
    Array.from({ length: 60 }, (_, n) => n + 1),
  );
});
test('sample durations, not callback count, determine playback time', () => {
  const q = new InputQueue(1);
  for (let n = 1; n <= 120; n++) q.receive({ ...frame(n), dt: 1 / 120 }, 0);
  let duration = 0;
  for (let n = 0; n < 40; n++)
    q.advance(1 / 30, (f) => {
      duration += f.dt!;
    });
  assert(Math.abs(duration - 1) < 1e-9);
  assert.equal(q.ack, 120);
});
test('overflow and epoch changes retain bounded work and reject old identities', () => {
  const q = new InputQueue(1);
  for (let n = 1; n <= 240; n++) assert.equal(q.receive(frame(n), 0), 'accepted');
  assert.equal(q.receive(frame(241), 0), 'resync');
  assert.equal(q.size, 240);
  assert.equal(q.ack, 1);
  q.reset(2);
  assert.equal(q.size, 0);
  assert.equal(q.ack, 0);
  assert.equal(q.receive(frame(242), 0), 'stale_epoch');
  assert.equal(q.active(0), false);
});
test('epoch changes during playback cannot consume or acknowledge obsolete inputs', () => {
  const q = new InputQueue(1);
  for (let n = 1; n <= 8; n++) q.receive(frame(n), 0);
  q.advance(1 / 30, () => q.reset(2));
  assert.equal(q.ack, 0);
  assert.equal(q.size, 0);
});
test('bounded durations are accepted; positions, clocks and nonfinite controls are rejected', () => {
  assert(isInputFrame({ ...frame(1), dt: 1 / 144 }));
  for (const extra of [
    { dt: 10 },
    { dt: 0 },
    { dt: NaN },
    { dt: -1 },
    { position: [1, 2, 3] },
    { timestamp: 10 },
    { x: NaN },
    { yaw: Infinity },
    { epoch: 0 },
    { z: 2 },
  ])
    assert.equal(isInputFrame({ ...frame(1), ...extra }), false);
  assert.ok(Math.hypot(...movementWish({ ...frame(1), z: 1 })) <= 1.0000001);
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
