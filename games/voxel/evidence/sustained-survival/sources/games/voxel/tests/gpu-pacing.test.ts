import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GpuFramePacer } from '../src/render/gpu-pacing.ts';
function fixture() {
  let status = 1,
    lost = false,
    created = 0,
    deleted = 0,
    flushed = 0;
  const polls: unknown[] = [];
  const gl = {
    TIMEOUT_EXPIRED: 1,
    ALREADY_SIGNALED: 2,
    CONDITION_SATISFIED: 3,
    WAIT_FAILED: 4,
    SYNC_GPU_COMMANDS_COMPLETE: 5,
    isContextLost: () => lost,
    fenceSync: () => ({ id: ++created }),
    deleteSync: () => {
      deleted++;
    },
    flush: () => {
      flushed++;
    },
    clientWaitSync: (...args: unknown[]) => {
      polls.push(args);
      return status;
    },
  } as unknown as WebGL2RenderingContext;
  return {
    pacer: new GpuFramePacer(gl),
    polls,
    status: (value: number) => {
      status = value;
    },
    loss: (value: boolean) => {
      lost = value;
    },
    counts: () => ({ created, deleted, flushed }),
  };
}
test('a pending GPU frame skips new submission using only zero-timeout polls and resumes on completion', () => {
  const f = fixture();
  assert.equal(f.pacer.begin(), true);
  f.pacer.finish();
  for (let i = 0; i < 100; i++) assert.equal(f.pacer.begin(), false);
  assert.deepEqual(f.counts(), { created: 1, deleted: 0, flushed: 1 });
  assert.equal(f.pacer.stats.pending, 1);
  assert.equal(f.pacer.stats.skipped, 100);
  for (const poll of f.polls) assert.deepEqual((poll as unknown[]).slice(1), [0, 0]);
  assert.throws(() => f.pacer.finish(), /already pending/);
  f.status(3);
  assert.equal(f.pacer.begin(), true);
  assert.equal(f.pacer.stats.pending, 0);
  f.pacer.finish();
  assert.deepEqual(f.counts(), { created: 2, deleted: 1, flushed: 2 });
  f.pacer.dispose();
  f.pacer.dispose();
  assert.equal(f.pacer.stats.pending, 0);
  assert.deepEqual(f.counts(), { created: 2, deleted: 2, flushed: 2 });
  assert.equal(f.pacer.begin(), false);
});
test('context loss releases the old fence and restoration starts with a fresh GPU completion boundary', () => {
  const f = fixture();
  f.pacer.begin();
  f.pacer.finish();
  f.loss(true);
  assert.equal(f.pacer.begin(), false);
  assert.equal(f.pacer.stats.pending, 0);
  assert.equal(f.polls.length, 0);
  f.loss(false);
  assert.equal(f.pacer.begin(), true);
  f.pacer.finish();
  f.pacer.reset();
  assert.deepEqual(f.counts(), { created: 2, deleted: 2, flushed: 2 });
});
test('failed GPU completion is explicit and cannot silently accumulate submitted frames', () => {
  const f = fixture();
  f.pacer.begin();
  f.pacer.finish();
  f.status(4);
  assert.throws(() => f.pacer.begin(), /poll failed/);
  assert.equal(f.pacer.stats.failures, 1);
  assert.equal(f.pacer.stats.pending, 0);
  assert.deepEqual(f.counts(), { created: 1, deleted: 1, flushed: 1 });
});
