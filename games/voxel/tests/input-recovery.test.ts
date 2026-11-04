import assert from 'node:assert/strict';
import { test } from 'node:test';
import { InputRecovery } from '../src/client/input-recovery.ts';
test('five-second acknowledgement stalls recover locally, while longer stalls request exactly one baseline before reconnecting', () => {
  const recovery = new InputRecovery();
  recovery.pause(0);
  assert.equal(recovery.waiting, true);
  assert.equal(recovery.requestResync(5000), false);
  assert.equal(recovery.observe(0.1), true);
  assert.equal(recovery.waiting, false);
  recovery.pause(10000);
  assert.equal(recovery.requestResync(19999), false);
  assert.equal(recovery.requestResync(20000), true);
  assert.equal(recovery.requestResync(20001), false);
  assert.equal(recovery.shouldReconnect(29999), false);
  assert.equal(recovery.shouldReconnect(30000), true);
  recovery.reset();
  assert.equal(recovery.shouldReconnect(40000), false);
});
