import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { RoomDurability } from '../src/server/room-durability.ts';
import { MemoryCheckpoints } from './fixtures/checkpoint-storage.ts';
const content = JSON.parse(
  readFileSync(new URL('../artifacts/content.json', import.meta.url), 'utf8'),
);
const build = JSON.parse(readFileSync(new URL('../artifacts/build.json', import.meta.url), 'utf8'));
const flush = async () => {
  for (let n = 0; n < 10; n++) await Promise.resolve();
};
test('a late lease acquisition after timeout is released instead of blocking all later joins', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const backend = new MemoryCheckpoints();
  const lease = (await backend.acquire('late-acquire', 'owner'))!;
  let release!: (value: typeof lease) => void;
  backend.acquire = () => new Promise((resolve) => (release = resolve));
  const pending = RoomDurability.acquire(
    { objects: backend, metadata: backend },
    content,
    build,
    'late-acquire',
    'owner',
    () => {},
  );
  t.mock.timers.tick(10001);
  await assert.rejects(pending, (error) => error instanceof Error && error.name === 'TimeoutError');
  release(lease);
  await flush();
  assert.equal(backend.rows.get('late-acquire')!.deadline, 0);
});
test('a six-second renewal within the last confirmed proof is accepted without losing ownership', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let now = 0;
  t.mock.method(performance, 'now', () => now);
  const backend = new MemoryCheckpoints();
  let release!: (value: { validForMs: number }) => void;
  backend.renew = () => new Promise((resolve) => (release = resolve));
  const owner = await RoomDurability.acquire(
    { objects: backend, metadata: backend },
    content,
    build,
    'slow-renew',
    'owner',
    () => {},
  );
  try {
    const oldDeadline = owner.ownershipDeadline;
    now = 10000;
    t.mock.timers.tick(10000);
    await flush();
    now = 16000;
    t.mock.timers.tick(6000);
    await flush();
    release({ validForMs: 30000 });
    await flush();
    assert(owner.owned());
    assert(owner.ownershipDeadline > oldDeadline);
  } finally {
    await owner.close();
  }
});

test('an unresponsive renewal cannot extend ownership and a late proof cannot revive an expired room', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let now = 0,
    losses = 0;
  t.mock.method(performance, 'now', () => now);
  const backend = new MemoryCheckpoints();
  const acquire = backend.acquire.bind(backend);
  backend.acquire = async (room, owner) => ({ ...(await acquire(room, owner))!, validForMs: 3000 });
  let release!: (value: { validForMs: number }) => void;
  backend.renew = () => new Promise((resolve) => (release = resolve));
  const owner = await RoomDurability.acquire(
    { objects: backend, metadata: backend },
    content,
    build,
    'expired-renew',
    'owner',
    () => losses++,
  );
  const publications: unknown[] = [];
  owner.attach((message) => publications.push(message));
  try {
    now = 700;
    t.mock.timers.tick(700);
    await flush();
    assert(owner.owned());
    now = 2001;
    t.mock.timers.tick(1301);
    await flush();
    assert.equal(owner.owned(), false);
    assert.equal(losses, 1);
    release({ validForMs: 30000 });
    await flush();
    assert.equal(owner.owned(), false);
    assert.equal(losses, 1);
    assert.equal(publications.length, 1, 'only the original confirmed proof reached the worker');
  } finally {
    await owner.close();
  }
});
