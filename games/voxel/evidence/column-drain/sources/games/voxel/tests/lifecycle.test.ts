import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseClientMessage, parseServerMessage } from '../src/shared/protocol.ts';
import { readRoomPolicy } from '../src/server/room-policy.ts';
import { WorldClock } from '../src/client/world-clock.ts';

test('world lifecycle wire carries coherent public state and cannot be supplied by a browser', () => {
  assert.ok(
    parseServerMessage(JSON.stringify({ type: 'error', code: 'SESSION_ENDED', retryable: false })),
  );
  assert.equal(
    parseServerMessage(JSON.stringify({ type: 'error', code: 'SESSION_ENDED', retryable: true })),
    null,
  );
  for (const [state, reason] of [
    ['playing', 'allowed'],
    ['paused', 'session'],
    ['paused', 'manual'],
    ['paused', 'no_participants'],
    ['paused', 'policy_unavailable'],
    ['ended', 'ended'],
  ]) {
    const value = { type: 'lifecycle', state, reason, tick: 120 };
    assert.deepEqual(parseServerMessage(JSON.stringify(value)), value);
    assert.equal(parseClientMessage(JSON.stringify(value)), null);
  }
  for (const bad of [
    { state: 'playing', reason: 'session', tick: 1 },
    { state: 'ended', reason: 'allowed', tick: 1 },
    { state: 'paused', reason: 'ended', tick: 1 },
    { state: 'paused', reason: 'session', tick: -1 },
    { state: 'paused', reason: 'session', tick: 1.5 },
    { state: 'paused', reason: 'session', tick: 1, capabilities: {} },
  ])
    assert.equal(parseServerMessage(JSON.stringify({ type: 'lifecycle', ...bad })), null);
});
test('room policy is a short private lease and rejects unknown state, browser claims and expired provider replies', () => {
  const now = 10000,
    value = { state: 'playing', expiresAt: now + 5000 };
  const read = readRoomPolicy(value, now);
  value.state = 'ended';
  assert.equal(read.state, 'playing');
  assert.ok(Object.isFrozen(read));
  for (const bad of [
    null,
    {},
    { ...value, expiresAt: now },
    { ...value, expiresAt: now + 5001 },
    { ...value, expiresAt: Infinity },
    { ...value, state: 'recovering' },
    { ...value, owner: 'browser' },
  ])
    assert.throws(() => readRoomPolicy(bad, now));
  assert.throws(() => readRoomPolicy(value, NaN));
});
test('explicit world pause freezes presentation at the authoritative tick and resume cannot earn offline time', () => {
  const clock = new WorldClock();
  clock.reset(1200, 0);
  assert.equal(clock.read(250), 1207.5);
  clock.reset(1203, 250, false);
  assert.equal(clock.read(20000), 1203);
  assert.equal(clock.observe(1203, 20000), false);
  assert.equal(clock.observe(1204, 20001), true);
  assert.equal(clock.read(30000), 1204);
  clock.reset(1204, 30000, true);
  assert.equal(clock.read(30050), 1205.5);
});
