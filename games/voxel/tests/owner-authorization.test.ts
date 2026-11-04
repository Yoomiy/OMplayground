import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { resolveOwnerAuthorizations } from '../src/server/owner-authorization.ts';
const actor = (id: string) => ({
  id,
  role: 'participant' as const,
  capabilities: { build: true, fly: true, observe: false, combat: true, explosives: true },
});

test('owner refresh processes every identity with bounded IO, immutable policies and explicit null denials', async () => {
  const ids = Array.from({ length: 129 }, (_, n) => `owner-${n}`);
  let active = 0,
    maximum = 0,
    calls = 0;
  const values = new Map(ids.map((id) => [id, actor(id)]));
  const result = await resolveOwnerAuthorizations(
    async (room, id) => {
      assert.equal(room, 'room');
      maximum = Math.max(maximum, ++active);
      calls++;
      await delay(1);
      active--;
      return id === 'owner-12' ? null : values.get(id)!;
    },
    'room',
    ids,
  );
  assert.equal(calls, 129);
  assert.equal(maximum, 4);
  assert.deepEqual(
    result.map(([id]) => id),
    ids,
  );
  assert.equal(result[12][1], null);
  values.get('owner-1')!.capabilities.explosives = false;
  assert.equal(result[1][1]!.capabilities.explosives, true);
  assert.ok(
    Object.isFrozen(result) &&
      Object.isFrozen(result[1]) &&
      Object.isFrozen(result[1][1]!.capabilities),
  );
});

test('unknown, forged or malformed owner results never produce a partial denial or leave unobserved IO', async () => {
  let release!: () => void,
    failed = false;
  const held = new Promise<void>((resolve) => (release = resolve));
  const pending = resolveOwnerAuthorizations(
    async (_room, id) => {
      if (id === 'broken') throw new Error('private provider details');
      await held;
      return actor(id);
    },
    'room',
    ['broken', 'still-reading'],
  ).catch((error) => {
    failed = true;
    throw error;
  });
  const rejected = assert.rejects(pending, /^Error: owner authorization unavailable$/);
  await delay(10);
  assert.equal(failed, false);
  release();
  await rejected;
  await assert.rejects(
    resolveOwnerAuthorizations(async () => actor('other'), 'room', ['owner']),
    /unavailable/,
  );
  await assert.rejects(
    resolveOwnerAuthorizations(async () => undefined as any, 'room', ['owner']),
    /unavailable/,
  );
  await assert.rejects(
    resolveOwnerAuthorizations(async () => null, 'room', ['owner', 'owner']),
    /invalid owner identities/,
  );
});
