import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DAY_TICKS,
  WEATHER_TICKS,
  ENVIRONMENT_VERSION,
  sampleEnvironment,
} from '../src/shared/environment.ts';
import { WorldClock } from '../src/client/world-clock.ts';
import { parseClientMessage, parseServerMessage } from '../src/shared/protocol.ts';

test('room-time atmosphere is deterministic, bounded, cyclic and weather transitions are continuous', () => {
  const noon = sampleEnvironment(0, 4242),
    night = sampleEnvironment(DAY_TICKS / 2, 4242);
  assert.ok(noon.daylight > 0.95);
  assert.ok(night.daylight < 0.1);
  assert.ok(noon.sky[2] > night.sky[2] * 3);
  assert.ok(Math.abs(sampleEnvironment(DAY_TICKS, 4242).daylight - noon.daylight) < 1e-10);
  let wet = false,
    dry = false,
    differs = false;
  for (let period = 0; period < 40; period++) {
    const tick = period * WEATHER_TICKS + 500,
      e = sampleEnvironment(tick, 4242);
    assert.deepEqual(e, sampleEnvironment(tick, 4242));
    assert.ok(Math.abs(Math.hypot(...e.sun) - 1) < 1e-12);
    for (const v of [e.rain, e.daylight, ...e.sky]) assert.ok(v >= 0 && v <= 1);
    wet ||= e.rain > 0.9;
    dry ||= e.rain < 0.1;
    differs ||= e.rain !== sampleEnvironment(tick, 19).rain;
    if (period > 0) {
      const before = sampleEnvironment(period * WEATHER_TICKS - 0.001, 4242);
      const after = sampleEnvironment(period * WEATHER_TICKS + 0.001, 4242);
      assert.ok(Math.abs(after.rain - before.rain) < 0.0001);
      assert.ok(Math.abs(after.daylight - before.daylight) < 0.0001);
    }
  }
  assert.ok(wet && dry && differs);
  for (const [tick, seed] of [
    [NaN, 0],
    [-1, 0],
    [0, -1],
    [0, 0x100000000],
  ])
    assert.throws(() => sampleEnvironment(tick, seed));
});

test('presentation clock aligns late joiners, rejects stale ticks, freezes on stalls and resets for a new world', () => {
  const a = new WorldClock(),
    b = new WorldClock();
  a.reset(3000, 0);
  b.reset(3003, 100);
  assert.equal(a.read(100), b.read(100));
  for (const clock of [a, b]) {
    assert.equal(clock.observe(3004, 135), true);
    assert.equal(clock.read(150), 3004.45);
    assert.equal(clock.observe(2999, 10000), false);
    assert.equal(clock.observe(3004, 10000), false);
    assert.equal(clock.read(10000), 3011.5);
    assert.equal(clock.read(20000), 3011.5);
    assert.equal(clock.read(0), 3011.5);
    clock.reset(0, 20000);
    assert.equal(clock.read(20000), 0);
    assert.equal(clock.read(20050), 1.5);
  }
  assert.deepEqual(sampleEnvironment(a.read(20050), 17), sampleEnvironment(b.read(20050), 17));
});

test('welcome requires matching environment format and valid authoritative ticks; clients cannot set world time', () => {
  const welcome = {
    type: 'welcome',
    actorId: 'a',
    epoch: 1,
    worldId: 'w',
    seed: 4242,
    tick: 123,
    environmentVersion: ENVIRONMENT_VERSION,
    spawn: [1.5, 68, -0.5],
    buildId: 'build',
    contentHash: 'content',
    generatorVersion: 2,
    role: 'participant',
    mode: 'creative',
    combat: false,
    explosives: false,
  };
  assert.ok(parseServerMessage(JSON.stringify(welcome)));
  for (const patch of [
    { tick: -1 },
    { tick: 1.5 },
    { environmentVersion: 999 },
    { seed: 0x100000000 },
  ])
    assert.equal(parseServerMessage(JSON.stringify({ ...welcome, ...patch })), null);
  assert.equal(parseClientMessage(JSON.stringify({ type: 'environment', tick: 1e9 })), null);
});
