import assert from 'node:assert/strict';
import { test } from 'node:test';
import { updateClock } from '../src/client/update-clock.ts';
test('interleaved fallback timers and stale RAF callbacks never mint prediction time', () => {
  let last = 0,
    seconds = 0;
  for (let second = 0; second < 3600; second++) {
    for (let tick = 1; tick <= 30; tick++) {
      const timer = second * 1000 + (tick * 1000) / 30;
      for (const timestamp of [timer, timer - 80]) {
        const sample = updateClock(last, timestamp);
        assert(sample.now >= last);
        last = sample.now;
        seconds += sample.dt;
      }
    }
  }
  assert(Math.abs(seconds - 3600) < 1e-6, `earned ${seconds} seconds`);
});
test('a long browser stall is capped once without replaying its elapsed time', () => {
  const first = updateClock(0, 5000);
  assert.equal(first.dt, 0.1);
  const stale = updateClock(first.now, 1000);
  assert.equal(stale.dt, 0);
  const resumed = updateClock(stale.now, 5010);
  assert.equal(resumed.dt, 0.01);
});
