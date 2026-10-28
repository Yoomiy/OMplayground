import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseClientMessage, parseServerMessage } from '../src/shared/protocol.ts';
import { encodeChunk, decodeChunk } from '../src/shared/chunk-wire.ts';
import { InputQueue } from '../src/sim/input-queue.ts';
import { sameJob } from '../src/world/jobs.ts';
test('gameplay schema rejects dev commands, forged positions/clocks, and oversize input batches', () => {
  const frame = {
    epoch: 1,
    sequence: 1,
    x: 0,
    z: 0,
    yaw: 0,
    pitch: 0,
    jump: false,
    sneak: false,
    sprint: false,
  };
  assert.ok(
    parseClientMessage(
      JSON.stringify({ type: 'input', frames: [frame, { ...frame, sequence: 2 }] }),
    ),
  );
  for (const value of [
    { type: 'dev', source: 'arbitrary code' },
    { type: 'position', position: [1, 2, 3] },
    { type: 'input', frames: [{ ...frame, dt: 100 }] },
    { type: 'input', frames: Array(5).fill(frame) },
  ])
    assert.equal(parseClientMessage(JSON.stringify(value)), null);
  assert.equal(
    parseServerMessage(
      JSON.stringify({
        type: 'snapshot',
        time: 1,
        tick: 1,
        self: { epoch: 1, ack: 1, state: [NaN] },
        actors: [],
      }),
    ),
    null,
  );
});
test('binary subscription baselines preserve high states and reject format/length/index corruption', () => {
  const frame = {
    kind: 'baseline' as const,
    x: -16,
    z: 15,
    subscription: 7,
    revision: 3,
    edits: [
      [65535, 256],
      [0, 300],
    ] as const,
  };
  const bytes = encodeChunk(frame);
  assert.deepEqual(decodeChunk(bytes, 301), frame);
  assert.equal(decodeChunk(bytes, 300), null);
  assert.equal(decodeChunk(bytes.slice(0, -1), 301), null);
  const bad = bytes.slice();
  bad[3] = 49;
  assert.equal(decodeChunk(bad, 301), null);
  const reserved = encodeChunk({ ...frame, edits: [[0, 65535]] });
  assert.equal(decodeChunk(reserved, 65536), null);
});
test('acknowledgement includes discarded controls and worker identities include every freshness boundary', () => {
  const q = new InputQueue(1);
  for (let sequence = 1; sequence <= 13; sequence++)
    q.receive(
      {
        epoch: 1,
        sequence,
        x: 0,
        z: 1,
        yaw: 1,
        pitch: 0.2,
        jump: false,
        sneak: false,
        sprint: false,
      },
      0,
    );
  assert.equal(q.ack, 1);
  q.take(201);
  assert.equal(q.ack, 13);
  const tag = {
    worldId: 'world',
    contentHash: 'content',
    generatorVersion: 2,
    x: 0,
    z: 0,
    incarnation: 1,
    subscription: 1,
    revision: 0,
    version: 1,
  };
  assert.ok(sameJob(tag, { ...tag }));
  for (const key of Object.keys(tag) as (keyof typeof tag)[]) {
    const other = {
      ...tag,
      [key]: typeof tag[key] === 'number' ? Number(tag[key]) + 1 : `${tag[key]}x`,
    };
    assert.equal(sameJob(tag, other), false, key);
  }
});
