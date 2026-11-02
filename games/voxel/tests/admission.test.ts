import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
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

test(
  'startup-aged grants renew without another half-window wait and sustained provider latency leaves renewal headroom',
  { timeout: 5000 },
  async () => {
    const actor = {
      id: 'kid',
      role: 'participant' as const,
      capabilities: { build: true, fly: true, observe: false, combat: true, explosives: true },
    };
    // A five-second school proof has already spent most of its time in startup IO.
    const current = { actor, expiresAt: Date.now() + 500 };
    const losses: string[] = [];
    let renewals = 0;
    const connection = new ConnectionAuthorization(
      {
        ...current,
        revalidate: async () => {
          const expiresAt = Date.now() + 900;
          await delay(350);
          return { actor, expiresAt };
        },
      },
      current,
      () => renewals++,
      (reason) => losses.push(reason),
    );
    try {
      for (let n = 0; n < 200 && renewals < 3 && !losses.length; n++) await delay(10);
      assert.deepEqual(losses, [], 'valid slow renewal must not trigger a reconnect');
      assert.ok(renewals >= 3, 'connection must survive successive request-start-bounded proofs');
      assert.equal(connection.valid(), true);
    } finally {
      connection.close();
    }
  },
);

test(
  'a transient renewal error retries inside the original proof, while a confirmed denial closes immediately',
  { timeout: 3000 },
  async () => {
    const actor = {
      id: 'kid',
      role: 'participant' as const,
      capabilities: { build: true, fly: true, observe: false, combat: true, explosives: true },
    };
    const current = { actor, expiresAt: Date.now() + 2000 };
    let checks = 0;
    const lost = new Promise<string>((resolve) => {
      const connection = new ConnectionAuthorization(
        {
          ...current,
          revalidate: async () => {
            if (++checks === 1) throw new Error('temporary provider outage');
            return null;
          },
        },
        current,
        () => assert.fail('neither an outage nor a denial renews authority'),
        (reason) => {
          connection.close();
          resolve(reason);
        },
      );
    });
    assert.equal(await lost, 'UNAUTHORIZED');
    assert.equal(checks, 2);
    assert.ok(Date.now() < current.expiresAt);
  },
);

test(
  'expiry diagnostics distinguish provider retry failures from an in-flight renewal and retain proof headroom',
  { timeout: 3000 },
  async () => {
    const actor = {
      id: 'kid',
      role: 'participant' as const,
      capabilities: { build: true, fly: true, observe: false, combat: true, explosives: true },
    };
    const current = { actor, expiresAt: Date.now() + 150 };
    let attempts = 0;
    const diagnostic = await new Promise<Record<string, string | number | boolean>>((resolve) => {
      new ConnectionAuthorization(
        {
          ...current,
          revalidate: async () => {
            attempts++;
            throw new DOMException('https://provider.invalid?token=private', 'TimeoutError');
          },
        },
        current,
        () => assert.fail('failed renewal cannot update the deadline'),
        (_reason, detail) => resolve(detail),
      );
    });
    assert.equal(diagnostic.authorizationFailure, 'expired');
    assert.equal(diagnostic.renewalAttempts, attempts);
    assert.equal(diagnostic.renewalFailures, attempts);
    assert.equal(diagnostic.lastRenewalFailure, 'TimeoutError');
    assert.equal(diagnostic.renewalInFlight, false);
    assert.ok(Number(diagnostic.proofRemainingMs) <= 2);
    assert.ok(Number(diagnostic.proofLifetimeMs) > 0);
    assert.doesNotMatch(JSON.stringify(diagnostic), /provider.invalid|private/);
  },
);
