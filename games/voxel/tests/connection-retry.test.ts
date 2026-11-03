import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConnectionRetry, retryableAdmission } from '../src/client/connection-retry.ts';

test('connection recovery keeps retrying with capped backoff and cancels on recovery/disposal', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let attempts = 0;
  const retry = new ConnectionRetry(() => {
    attempts++;
    retry.schedule();
  });
  retry.schedule();
  retry.schedule();
  t.mock.timers.tick(1499);
  assert.equal(attempts, 0);
  t.mock.timers.tick(1);
  assert.equal(attempts, 1);
  t.mock.timers.tick(3000);
  assert.equal(attempts, 2);
  t.mock.timers.tick(6000);
  assert.equal(attempts, 3);
  t.mock.timers.tick(10000);
  assert.equal(attempts, 4);
  t.mock.timers.tick(10000);
  assert.equal(attempts, 5);
  retry.reset();
  t.mock.timers.tick(20000);
  assert.equal(attempts, 5);
  retry.schedule();
  t.mock.timers.tick(1500);
  assert.equal(attempts, 6);
  retry.dispose();
  retry.schedule();
  t.mock.timers.tick(20000);
  assert.equal(attempts, 6);
});
test('transport and provider failures retry, while confirmed access decisions do not', () => {
  for (const error of [
    new Error('offline'),
    new DOMException('cancelled', 'AbortError'),
    { code: 'SCHOOL_POLICY_UNAVAILABLE', retryable: true },
    { code: 'UNAVAILABLE', retryable: true },
  ])
    assert.equal(retryableAdmission(error), true);
  for (const code of [
    'UNAUTHORIZED',
    'RECESS_CLOSED',
    'SESSION_ENDED',
    'BANNED',
    'REPLACED',
    'INCOMPATIBLE',
  ])
    assert.equal(retryableAdmission({ code }), false);
  assert.equal(retryableAdmission({ code: 'PROTOCOL', retryable: false }), false);
});
