import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withDeadline } from '../src/shared/request-deadline.ts';
test('a provider that ignores abort still cannot hold a request open, and late completion is retired', async () => {
  let release!: (value: number) => void;
  let signal!: AbortSignal;
  const pending = withDeadline((s) => {
    signal = s;
    return new Promise<number>((resolve) => (release = resolve));
  }, 15);
  await assert.rejects(pending, (error) => error instanceof Error && error.name === 'TimeoutError');
  assert.equal(signal.aborted, true);
  release(7);
  await Promise.resolve();
});
test('caller cancellation ends a hanging request and successful work retires its timer', async () => {
  const controller = new AbortController();
  const pending = withDeadline(() => new Promise(() => {}), 10000, controller.signal);
  controller.abort();
  await assert.rejects(pending, (error) => error instanceof Error && error.name === 'AbortError');
  assert.equal(await withDeadline(async () => 42, 10000), 42);
});

test('providers rejecting with an empty reason still fail instead of appearing successful', async () => {
  for (const reason of [undefined, null, false, '', 0]) {
    let rejected = false;
    try {
      await withDeadline(() => Promise.reject(reason), 10000);
    } catch (error) {
      rejected = true;
      assert.equal(error, reason);
    }
    assert(rejected);
  }
});
