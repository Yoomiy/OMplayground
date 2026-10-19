import assert from 'node:assert/strict';
import test from 'node:test';
import { PredictionInputQueue } from '../src/input-queue.js';
const command = { protocolVersion: 2, throttle: 1, steer: 0, pitch: 0, yaw: 0, roll: 0,
  jumpHeld: false, jumpSequence: 0, boostHeld: false, powerslideHeld: false, cameraToggleSequence: 0 };

test('input stream rejects duplicates and malformed sequences and ignores forged authority', () => {
  const queue = new PredictionInputQueue();
  assert.equal(queue.enqueue({ sequence: 1, command: { ...command, position: [999, 999, 999], throttle: 100 } }, 1), true);
  assert.equal(queue.enqueue({ sequence: 1, command }, 2), false);
  assert.equal(queue.enqueue({ sequence: NaN, command }, 2), false);
  assert.equal(queue.enqueue({ sequence: 20_000, command }, 2), false);
  const consumed = queue.consume(50)!;
  assert.equal(consumed.command.throttle, 1);
  assert.equal('position' in consumed.command, false);
  assert.equal(queue.acknowledgedSequence, 1);
  assert.equal(queue.inputAppliedTick, 50);
  assert.equal(queue.consume(51), null);
  assert.equal(queue.inputAppliedTick, 50, 'held controls retain their original application tick');
});

test('batched or stalled inputs have bounded queue cost and never cause extra physics steps', () => {
  const queue = new PredictionInputQueue();
  for (let sequence = 1; sequence <= 120; sequence++) assert.equal(queue.enqueue({ sequence, command }, 1), true);
  assert.equal(queue.enqueue({ sequence: 121, command: { ...command, throttle: -1, jumpSequence: 1 } }, 1), true);
  assert.equal(queue.consume()!.sequence, 120);
  const latest = queue.consume()!;
  assert.equal(latest.sequence, 121);
  assert.equal(latest.command.throttle, -1);
  assert.equal(latest.command.jumpSequence, 1);
  assert.equal(queue.consume(), null);
});
