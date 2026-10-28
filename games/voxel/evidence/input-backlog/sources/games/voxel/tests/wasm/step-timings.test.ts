import assert from 'node:assert/strict';
import { test } from 'node:test';
import { roomFixture } from './room-fixture.ts';
test('each catch-up step is timed separately, and paused observer steps never count as world steps', () => {
  const samples: { kind: string; ms: number }[] = [];
  const f = roomFixture('survival', 0, false, (kind, ms) => samples.push({ kind, ms }));
  try {
    samples.length = 0;
    const result = f.elapse(500);
    assert.equal(result.steps, 4);
    assert(result.droppedMs > 0);
    assert.equal(samples.length, 4);
    assert(samples.every((s) => s.kind === 'world' && Number.isFinite(s.ms) && s.ms >= 0));
    samples.length = 0;
    f.room.setPaused(true, f.now);
    const tick = f.room.checkpoint(f.now).tick;
    assert.equal(f.elapse(500).steps, 0);
    assert.equal(f.room.checkpoint(f.now).tick, tick);
    assert.equal(samples.length, 4);
    assert(samples.every((s) => s.kind === 'observer' && Number.isFinite(s.ms) && s.ms >= 0));
    samples.length = 0;
    f.room.end(f.now);
    f.elapse(500);
    assert.equal(samples.length, 0);
  } finally {
    f.room.dispose();
  }
});
