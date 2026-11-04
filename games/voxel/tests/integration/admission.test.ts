import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { SocketProbe } from '../fixtures/socket-probe.ts';
import type { AdmissionGrant, Authorization } from '../../src/server/admission.ts';
import type { AdmittedActor } from '../../src/sim/game-room.ts';
import type { GatewayOptions } from '../../src/server/gateway.ts';
import { MemoryCheckpoints } from '../fixtures/checkpoint-storage.ts';
import { SessionEnded } from '../../src/server/admission.ts';
const { createGateway }: typeof import('../../src/server/gateway.ts') = process.env
  .VOXEL_TEST_BUNDLE
  ? await import(new URL('../../dist-server/gateway.js', import.meta.url).href)
  : await import('../../src/server/gateway.ts');
const build = JSON.parse(
  readFileSync(new URL('../../artifacts/build.json', import.meta.url), 'utf8'),
);
const content = JSON.parse(
  readFileSync(new URL('../../artifacts/content.json', import.meta.url), 'utf8'),
);
const participant: AdmittedActor = {
  id: 'verified',
  role: 'participant',
  capabilities: { build: true, fly: true, observe: false, combat: true, explosives: true },
};
function grant(revalidate: AdmissionGrant['revalidate'], actor = participant): AdmissionGrant {
  return { actor, expiresAt: Date.now() + 30000, revalidate };
}
async function harness(
  issue: () => Promise<AdmissionGrant>,
  options: Pick<GatewayOptions, 'persistence' | 'sessions' | 'roomPolicy'> = {},
) {
  const gateway = await createGateway({ build, content, admit: issue, ...options });
  assert.ok(gateway.address && typeof gateway.address === 'object');
  const origin = `http://127.0.0.1:${gateway.address.port}`;
  const ticket = async (body: unknown = { room: 'authorization' }) => {
    const response = await fetch(origin + '/api/voxel/admission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { response, value: (await response.json()) as { ticket: string; buildId: string } };
  };
  const connect = async (value: { ticket: string; buildId: string }) => {
    const probe = new SocketProbe(origin.replace(/^http/, 'ws') + '/voxel', content.blocks.length);
    await once(probe.socket, 'open');
    probe.send({ type: 'hello', ...value });
    return probe;
  };
  return { gateway, origin, ticket, connect };
}

test(
  'slow membership acceptance and school-sized renewal latency do not cycle a durable room through reconnects',
  { timeout: 15000 },
  async () => {
    const backend = new MemoryCheckpoints();
    let proofExpiresAt = 0,
      renewals = 0;
    const h = await harness(
      async () =>
        grant(async (stage) => {
          const expiresAt = Date.now() + 5000;
          proofExpiresAt = expiresAt;
          if (stage === 'actor') {
            renewals++;
            await delay(1000);
          }
          return { actor: participant, expiresAt };
        }),
      {
        persistence: { objects: backend, metadata: backend },
        roomPolicy: async () => ({ state: 'playing', expiresAt: Date.now() + 5000 }),
        sessions: {
          async initialize() {},
          async accept() {
            // Startup and platform membership leave a still-valid aged proof.
            await delay(Math.max(0, proofExpiresAt - Date.now() - 1600));
          },
          async project() {
            return true;
          },
        },
      },
    );
    let probe: SocketProbe | undefined;
    try {
      probe = await h.connect((await h.ticket()).value);
      await probe.ready();
      const room = h.gateway.rooms.get('authorization');
      await delay(6500);
      assert.equal(probe.socket.readyState, WebSocket.OPEN);
      assert.ok(renewals >= 3, 'multiple real gateway-to-worker renewals completed');
      assert.equal(h.gateway.rooms.get('authorization'), room, 'same worker and owner retained');
      assert.equal(backend.rows.get('authorization')!.epoch, 1);
      assert.equal(
        probe.events.some((event) => 'type' in event && event.type === 'error'),
        false,
      );
    } finally {
      probe?.socket.terminate();
      await h.gateway.close();
    }
  },
);

test(
  'ticket consumption revalidates current authority before allocating a room',
  { timeout: 10000 },
  async () => {
    let allowed = true,
      checks = 0;
    const h = await harness(async () =>
      grant(async () => {
        checks++;
        return allowed ? { actor: participant, expiresAt: Date.now() + 30000 } : null;
      }),
    );
    let probe: SocketProbe | undefined;
    try {
      const { value, response } = await h.ticket();
      assert.equal(response.status, 200);
      allowed = false;
      probe = await h.connect(value);
      assert.equal((await probe.event('error')).code, 'UNAUTHORIZED');
      assert.equal(checks, 1);
      assert.equal(h.gateway.rooms.size, 0);
    } finally {
      probe?.socket.terminate();
      await h.gateway.close();
    }
  },
);

test(
  'a ticket obtains the fresh staff role and cannot restore its earlier gameplay capabilities',
  { timeout: 10000 },
  async () => {
    const observer: AdmittedActor = {
      id: participant.id,
      role: 'observer',
      capabilities: { build: false, fly: true, observe: true, combat: false, explosives: false },
    };
    const h = await harness(async () =>
      grant(async () => ({ actor: observer, expiresAt: Date.now() + 30000 })),
    );
    let probe: SocketProbe | undefined;
    try {
      probe = await h.connect((await h.ticket()).value);
      const welcome = await probe.event('welcome');
      assert.equal(welcome.role, 'observer');
      assert.equal(welcome.combat, false);
      assert.equal(welcome.explosives, false);
    } finally {
      probe?.socket.terminate();
      await h.gateway.close();
    }
  },
);

test(
  'authorization refresh keeps an unchanged connection alive, then capability revocation requires a new admission',
  { timeout: 10000 },
  async () => {
    let checks = 0,
      allowed = true;
    const h = await harness(async () =>
      grant(async () => {
        checks++;
        return {
          actor: allowed
            ? participant
            : { ...participant, capabilities: { ...participant.capabilities, build: false } },
          expiresAt: Date.now() + 1600,
        };
      }),
    );
    let probe: SocketProbe | undefined;
    try {
      probe = await h.connect((await h.ticket()).value);
      await probe.ready();
      await delay(1850);
      assert.equal(probe.socket.readyState, WebSocket.OPEN);
      assert.ok(checks >= 3);
      allowed = false;
      assert.equal((await probe.event('error')).code, 'UNAUTHORIZED');
    } finally {
      probe?.socket.terminate();
      await h.gateway.close();
    }
  },
);

test(
  'a delayed renewal cannot revive a connection after its prior authorization expired',
  { timeout: 10000 },
  async () => {
    let checks = 0,
      unblock!: (value: Authorization) => void;
    const held = new Promise<Authorization>((resolve) => (unblock = resolve));
    const h = await harness(async () =>
      grant(async () =>
        ++checks === 1 ? { actor: participant, expiresAt: Date.now() + 1600 } : held,
      ),
    );
    let probe: SocketProbe | undefined;
    try {
      probe = await h.connect((await h.ticket()).value);
      await probe.event('welcome');
      const closed = once(probe.socket, 'close');
      const expired = await probe.event('error');
      assert.equal(expired.code, 'RECOVERING');
      assert.equal(expired.retryable, true);
      await closed;
      unblock({ actor: participant, expiresAt: Date.now() + 30000 });
      await delay(20);
      assert.equal(probe.socket.readyState, WebSocket.CLOSED);
    } finally {
      unblock({ actor: participant, expiresAt: Date.now() + 30000 });
      probe?.socket.terminate();
      await h.gateway.close();
    }
  },
);

test(
  'session completion keeps its terminal reason during ticket consumption and connected renewal',
  { timeout: 10000 },
  async () => {
    for (const connected of [false, true]) {
      let ended = !connected;
      const h = await harness(async () =>
        grant(async () => {
          if (!ended) return { actor: participant, expiresAt: Date.now() + 1200 };
          throw new SessionEnded();
        }),
      );
      let probe: SocketProbe | undefined;
      try {
        probe = await h.connect((await h.ticket()).value);
        if (connected) {
          await probe.ready();
          ended = true;
        }
        const error = await probe.event('error');
        assert.equal(error.code, 'SESSION_ENDED');
        assert.equal(error.retryable, false);
        if (!connected) assert.equal(h.gateway.rooms.size, 0);
      } finally {
        probe?.socket.terminate();
        await h.gateway.close();
      }
    }
  },
);

test(
  'provider failure stays recovering and malformed admission claims never reach the authority provider',
  { timeout: 10000 },
  async () => {
    let issued = 0;
    const h = await harness(async () => {
      issued++;
      return grant(async () => {
        throw new Error('private provider failure');
      });
    });
    let probe: SocketProbe | undefined;
    try {
      const bad = await h.ticket({ room: 'authorization', capabilities: { build: true } });
      assert.equal(bad.response.status, 400);
      assert.equal(issued, 0);
      probe = await h.connect((await h.ticket()).value);
      const error = await probe.event('error');
      assert.equal(error.code, 'RECOVERING');
      assert.equal(error.retryable, true);
      assert.equal(h.gateway.rooms.size, 0);
    } finally {
      probe?.socket.terminate();
      await h.gateway.close();
    }
  },
);

test(
  'a connected local cutoff survives provider outages and ends with a terminal recess reason',
  { timeout: 10000 },
  async () => {
    let checks = 0;
    const backend = new MemoryCheckpoints();
    const h = await harness(
      async () => ({
        actor: participant,
        expiresAt: Date.now() + 30000,
        revalidate: async () => ({ actor: participant, expiresAt: Date.now() + 500 }),
        connected: () => ({
          authorization: { actor: participant, expiresAt: Date.now() + 1800 },
          expiresReason: 'RECESS_CLOSED',
          recheckMs: 100,
          revalidate: async () => {
            checks++;
            throw new Error('provider unavailable');
          },
        }),
      }),
      { persistence: { objects: backend, metadata: backend } },
    );
    let probe: SocketProbe | undefined;
    try {
      probe = await h.connect((await h.ticket()).value);
      await probe.ready();
      await delay(700);
      assert.ok(checks > 0);
      assert.equal(probe.socket.readyState, WebSocket.OPEN);
      assert.equal(
        probe.events.some((e) => 'type' in e && e.type === 'error'),
        false,
      );
      const error = await probe.event('error');
      assert.equal(error.code, 'RECESS_CLOSED');
      assert.equal(error.retryable, false);
    } finally {
      probe?.socket.terminate();
      await h.gateway.close();
    }
  },
);
