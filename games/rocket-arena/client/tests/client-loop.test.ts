import assert from 'node:assert/strict';
import test from 'node:test';
import { ClientLoop } from '../src/client-loop.js';

function fixture() {
  let next = 0;
  const pending = new Map<number, FrameRequestCallback>();
  const cancelled: number[] = [];
  let renders = 0;
  const loop = new ClientLoop(() => renders++, {
    request(callback) { pending.set(++next, callback); return next; },
    cancel(id) { cancelled.push(id); pending.delete(id); },
  });
  const take = () => {
    const [id, callback] = pending.entries().next().value!;
    pending.delete(id);
    return callback;
  };
  return { loop, pending, cancelled, take, renders: () => renders };
}

test('stop/resume maintains one render chain even if a cancelled callback is delivered late', () => {
  const f = fixture();
  f.loop.start(); f.loop.start();
  assert.equal(f.pending.size, 1);
  const old = f.take();
  f.loop.stop(); f.loop.start();
  old(16);
  assert.equal(f.renders(), 0);
  assert.equal(f.pending.size, 1);
  f.take()(32);
  assert.equal(f.renders(), 1);
  assert.equal(f.pending.size, 1);
  f.loop.dispose();
  assert.equal(f.pending.size, 0);
});

test('terminal disposal cancels future frames and cannot restart', () => {
  const f = fixture();
  f.loop.start();
  const old = f.take();
  f.loop.dispose(); f.loop.dispose(); f.loop.start();
  old(16);
  assert.equal(f.renders(), 0);
  assert.equal(f.pending.size, 0);
});

test('disposing from inside a frame does not schedule its successor', () => {
  let callback: FrameRequestCallback | null = null;
  let requests = 0;
  const loop = new ClientLoop(() => loop.dispose(), {
    request(next) { callback = next; return ++requests; }, cancel() {},
  });
  loop.start();
  callback!(16);
  assert.equal(requests, 1);
});
