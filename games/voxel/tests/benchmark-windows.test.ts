import assert from 'node:assert/strict';
import { test } from 'node:test';
import { containedWindows } from '../tools/benchmark-windows.ts';
test('benchmark windows exclude startup and partial intervals, preserving separate room reports at exact boundaries', () => {
  const window = (room: string, a: number, b: number) => ({
    room,
    windowStartedAtMs: a,
    windowEndedAtMs: b,
    windowMs: b - a,
  });
  const rows = [
    window('a', 0, 10),
    window('b', 3, 13),
    window('a', 10, 20),
    window('b', 13, 23),
    window('a', 20, 30),
  ];
  assert.deepEqual(containedWindows(rows, 10, 23), rows.slice(2, 4));
  assert.deepEqual(containedWindows(rows, 10, 20), [rows[2]]);
  assert.deepEqual(containedWindows(rows, 14, 19), []);
});
test('benchmark windows cannot infer containment from missing or invalid worker bounds', () => {
  const rows = [
    { windowMs: 10 },
    { windowMs: 0, windowStartedAtMs: 1, windowEndedAtMs: 1 },
    { windowMs: 10, windowStartedAtMs: 1, windowEndedAtMs: 12 },
    { windowMs: 10, windowStartedAtMs: NaN, windowEndedAtMs: 20 },
    { windowMs: Infinity, windowStartedAtMs: 1, windowEndedAtMs: 20 },
  ];
  assert.deepEqual(containedWindows(rows, 0, 30), []);
  assert.throws(() => containedWindows(rows, 30, 0), /invalid benchmark interval/);
  assert.throws(() => containedWindows(rows, 0, Infinity), /invalid benchmark interval/);
});
