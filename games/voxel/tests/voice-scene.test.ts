import assert from 'node:assert/strict';
import { test } from 'node:test';
import { voiceScene, VOICE_RADIUS } from '../src/client/voice-scene.ts';
test('semantic voice uses world-space eye poses, correct camera axes and bounded distance/occlusion gain', () => {
  const calls: unknown[] = [];
  const scene = voiceScene(
    [1000, 60, -2000],
    Math.PI / 2,
    0,
    [
      { id: 'near', position: [1002, 60, -2000] },
      { id: 'wall', position: [1004, 60, -2000] },
      { id: 'far', position: [1000 + VOICE_RADIUS, 60, -2000] },
    ],
    (from, to) => {
      calls.push([from, to]);
      return to[0] !== 1004;
    },
  )!;
  assert.deepEqual(scene.listener.position, [1000, 61.62, -2000]);
  assert(Math.abs(scene.listener.forward[0] - 1) < 1e-12);
  assert(Math.abs(scene.listener.forward[2]) < 1e-12);
  assert(scene.listener.up.every((v, i) => Math.abs(v - [0, 1, 0][i]) < 1e-12));
  assert.equal(scene.sources[0].gain, 1);
  assert.equal(scene.sources[1].occluded, true);
  assert(scene.sources[1].gain > 0 && scene.sources[1].gain < 0.16);
  assert.equal(scene.sources[2].gain, 0);
  assert.equal(calls.length, 2);
  const shifted = voiceScene(
    [0, 60, 0],
    Math.PI / 2,
    0,
    [
      { id: 'near', position: [2, 60, 0] },
      { id: 'wall', position: [4, 60, 0] },
    ],
    (_from, to) => to[0] !== 4,
  )!;
  assert.deepEqual(
    shifted.sources.map((s) => s.gain),
    scene.sources.slice(0, 2).map((s) => s.gain),
  );
});
test('voice scene never caps participants, aliases mutable positions or exposes native failures', () => {
  const origin = [0, 0, 0],
    poses = Array.from({ length: 257 }, (_, i) => ({ id: String(i), position: [i % 4, 0, i % 3] }));
  const sample = voiceScene(origin, 0, 0, poses, () => true)!;
  assert.equal(sample.sources.length, 257);
  origin[0] = 99;
  poses[0].position[1] = 50;
  assert.deepEqual(sample.listener.position, [0, 1.62, 0]);
  assert.deepEqual(sample.sources[0].position, [0, 1.62, 0]);
  assert.equal(
    voiceScene([NaN, 0, 0], 0, 0, poses, () => true),
    null,
  );
  assert.equal(
    voiceScene([0, 0, 0], Infinity, 0, poses, () => true),
    null,
  );
  assert.equal(
    voiceScene([0, 0, 0], 0, 0, poses, () => {
      throw new Error('native trap');
    }),
    null,
  );
  assert.deepEqual(
    voiceScene([0, 0, 0], 0, 0, [{ id: 'bad', position: [Infinity, 0, 0] }], () => true)?.sources,
    [],
  );
});
