import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readAuthorization, ConnectionAuthorization } from '../src/server/admission.ts';
test('private authorization validates every grant and canonicalizes copied capabilities without accepting client timers or a different identity', () => {
  const now = Date.now(),
    actor = {
      id: 'verified',
      role: 'participant',
      capabilities: { fly: true, build: true, explosives: true, observe: false, combat: true },
    };
  const value = { actor, expiresAt: now + 5000 },
    read = readAuthorization(value, now, 'verified');
  actor.capabilities.build = false;
  assert.equal(read.actor.capabilities.build, true);
  assert.equal(Object.isFrozen(read.actor.capabilities), true);
  const equivalent = readAuthorization(
    {
      actor: {
        ...read.actor,
        capabilities: { combat: true, observe: false, explosives: true, build: true, fly: true },
      },
      expiresAt: now + 5000,
    },
    now,
  );
  assert.equal(JSON.stringify(equivalent.actor), JSON.stringify(read.actor));
  for (const bad of [
    { ...value, expiresAt: now },
    { ...value, expiresAt: Infinity },
    { ...value, expiresAt: now + 60001 },
    { ...value, capabilities: {} },
    { ...value, actor: { ...actor, role: 'administrator' } },
    { ...value, actor: { ...actor, capabilities: { ...actor.capabilities, build: 1 } } },
    {
      ...value,
      actor: {
        ...actor,
        role: 'observer',
        capabilities: { ...actor.capabilities, observe: false },
      },
    },
  ])
    assert.throws(() => readAuthorization(bad, now));
  assert.throws(() => readAuthorization(value, now, 'different'));
});

test('private membership revisions survive canonicalization and malformed generations cannot bypass the grant boundary', () => {
  const now = Date.now(),
    value = {
      actor: {
        id: 'verified',
        role: 'participant',
        capabilities: { build: true, fly: true, observe: false, combat: true, explosives: true },
      },
      expiresAt: now + 5000,
    };
  assert.equal(readAuthorization({ ...value, membershipRevision: 17 }, now).membershipRevision, 17);
  for (const membershipRevision of [
    -1,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    '17',
    undefined,
  ])
    assert.throws(() => readAuthorization({ ...value, membershipRevision }, now));
});

test('a connection retains its original admission generation when a fresh policy response renews its deadline', async () => {
  const actor = {
    id: 'kid',
    role: 'participant' as const,
    capabilities: { build: true, fly: true, observe: false, combat: true, explosives: true },
  };
  let renewed!: () => void;
  const renewal = new Promise<void>((resolve) => {
    renewed = resolve;
  });
  const current = { actor, expiresAt: Date.now() + 150, membershipRevision: 4 };
  const connection = new ConnectionAuthorization(
    {
      ...current,
      revalidate: async () => ({ actor, expiresAt: Date.now() + 1000, membershipRevision: 9 }),
    },
    current,
    () => renewed(),
    () => {
      throw new Error('unexpected expiry');
    },
  );
  try {
    await renewal;
    assert.equal(connection.actorId, 'kid');
    assert.equal(connection.admissionRevision, 4);
    assert.equal(connection.valid(), true);
  } finally {
    connection.close();
  }
});
