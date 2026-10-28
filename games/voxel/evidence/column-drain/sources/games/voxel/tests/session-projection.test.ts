import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { SessionOutbox } from '../src/server/session-projection.ts';
import type { SessionView } from '../src/server/session-projection.ts';

test('projection IO coalesces arbitrary worker changes and final empty presence follows the in-flight write', async () => {
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  const writes: { sequence: number; view: SessionView }[] = [];
  const outbox = new SessionOutbox(
    async (sequence, view) => {
      writes.push({ sequence, view });
      if (sequence === 1) await held;
      return true;
    },
    () => assert.fail('unexpected IO failure'),
  );
  outbox.offer({ state: 'playing', participants: ['first'] });
  for (let i = 0; i < 10000; i++) outbox.offer({ state: 'playing', participants: [String(i)] });
  assert.equal(writes.length, 1);
  release();
  await delay(0);
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[1].view.participants, ['9999']);
  await outbox.finish();
  assert.deepEqual(writes[2], { sequence: 3, view: { state: 'paused', participants: [] } });
  outbox.offer({ state: 'playing', participants: ['late'] });
  await delay(0);
  assert.equal(writes.length, 3);
});

test('completion cannot be overwritten and a failed final projection can be retried before lease release', async () => {
  let available = false,
    errors = 0;
  const writes: SessionView[] = [];
  const outbox = new SessionOutbox(
    async (_, view) => {
      writes.push(view);
      if (!available) throw new Error('outage');
      return true;
    },
    () => errors++,
  );
  outbox.offer({ state: 'ended', participants: [] });
  await delay(0);
  outbox.offer({ state: 'playing', participants: ['late'] });
  await assert.rejects(outbox.finish(), /outage/);
  assert.equal(errors, 1);
  available = true;
  await outbox.finish();
  assert.deepEqual(writes.at(-1), { state: 'ended', participants: [] });
  outbox.close();
});
