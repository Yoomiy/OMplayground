import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TimingHistogram } from '../src/server/timing-histogram.ts';

test('timing quantiles conservatively bound nearest-rank samples within 0.05 ms', () => {
  const histogram = new TimingHistogram();
  const samples = Array.from({ length: 1000 }, (_, i) => ((i * 997) % 1000) * 0.173);
  for (const ms of samples) histogram.record(ms);
  const summary = histogram.take();
  samples.sort((a, b) => a - b);
  assert.equal(summary.samples, samples.length);
  assert.equal(summary.maxMs, samples.at(-1));
  assert(Math.abs(summary.meanMs - samples.reduce((a, b) => a + b, 0) / samples.length) < 1e-10);
  for (const [fraction, upper] of [
    [0.95, summary.p95UpperMs],
    [0.99, summary.p99UpperMs],
  ]) {
    const actual = samples[Math.ceil(samples.length * fraction) - 1];
    assert(upper >= actual);
    assert(upper - actual < 0.05);
  }
});

test('timing windows reset all counts, distinguish empty from zero and ignore invalid samples', () => {
  const histogram = new TimingHistogram();
  const empty = { samples: 0, meanMs: 0, p95UpperMs: 0, p99UpperMs: 0, maxMs: 0 };
  for (const value of [-1, Infinity, -Infinity, NaN]) histogram.record(value);
  assert.deepEqual(histogram.take(), empty);
  histogram.record(0);
  assert.deepEqual(histogram.take(), { ...empty, samples: 1 });
  histogram.record(0.051);
  assert.deepEqual(histogram.take(), {
    samples: 1,
    meanMs: 0.051,
    p95UpperMs: 0.051,
    p99UpperMs: 0.051,
    maxMs: 0.051,
  });
  assert.deepEqual(histogram.take(), empty);
});

test('timing overflow cannot underreport slow quantiles or grow storage', () => {
  const histogram = new TimingHistogram();
  for (let i = 0; i < 94; i++) histogram.record(200);
  for (const ms of [200.001, 250, 300, 500, 1000, 5000]) histogram.record(ms);
  const summary = histogram.take();
  assert.equal(summary.samples, 100);
  assert.equal(summary.p95UpperMs, 5000);
  assert.equal(summary.p99UpperMs, 5000);
  assert.equal(summary.maxMs, 5000);
  histogram.record(200);
  assert.equal(histogram.take().p95UpperMs, 200);
});
