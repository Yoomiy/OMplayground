import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { MemoryCheckpoints } from '../fixtures/checkpoint-storage.ts';
import { SocketProbe } from '../fixtures/socket-probe.ts';
import { developmentAdmission } from '../../tools/development-admission.ts';
import type { AdmissionPolicy } from '../../src/server/gateway.ts';
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
const actor = (id: string) => ({
  id,
  role: 'participant' as const,
  capabilities: { build: true, fly: true, observe: false, combat: true, explosives: true },
});
function gate() {
  let release!: () => void;
  const promise = new Promise<void>((r) => (release = r));
  return { promise, release };
}
async function until(predicate: () => boolean) {
  for (let n = 0; n < 500 && !predicate(); n++) await delay(10);
  assert.ok(predicate(), 'condition did not become true');
}
async function harness(backend?: MemoryCheckpoints, admission?: AdmissionPolicy) {
  const events: string[] = [],
    control = { cancelOnReady: false };
  const gateway = await createGateway({
    build,
    content,
    ...(backend ? { persistence: { objects: backend, metadata: backend } } : {}),
    admit:
      admission ??
      (async (req) => developmentAdmission(actor(String(req.headers['x-test-actor'])))),
    onEvent(name) {
      events.push(name);
      if (name === 'VOXEL_ROOM_READY' && control.cancelOnReady)
        for (const ws of gateway.sockets.clients) ws.terminate();
    },
  });
  assert.ok(gateway.address && typeof gateway.address === 'object');
  const origin = `http://127.0.0.1:${gateway.address.port}`,
    probes: SocketProbe[] = [];
  return {
    gateway,
    events,
    control,
    async raw(id: string) {
      const response = await fetch(origin + '/api/voxel/admission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-actor': id },
        body: JSON.stringify({ room: 'allocation' }),
      });
      assert.equal(response.status, 200);
      const value = (await response.json()) as { ticket: string; buildId: string };
      const p = new SocketProbe(origin.replace(/^http/, 'ws') + '/voxel', content.blocks.length);
      probes.push(p);
      await once(p.socket, 'open');
      p.send({ type: 'hello', ...value });
      return p;
    },
    async close() {
      for (const p of probes) p.socket.terminate();
      await gateway.close();
    },
  };
}

test(
  'cancelled admission at worker readiness stops an unjoined volatile worker and releases an unjoined durable owner',
  { timeout: 15000 },
  async () => {
    for (const backend of [undefined, new MemoryCheckpoints()]) {
      const h = await harness(backend);
      try {
        h.control.cancelOnReady = true;
        const p = await h.raw('cancelled');
        if (p.socket.readyState !== 3) await once(p.socket, 'close');
        await until(() =>
          h.events.includes(backend ? 'VOXEL_ROOM_SAVED_AND_RELEASED' : 'VOXEL_EMPTY_ROOM_STOPPED'),
        );
        assert.equal(h.gateway.rooms.size, 0);
        assert.equal(
          p.events.some((event) => 'type' in event && event.type === 'welcome'),
          false,
        );
        if (backend) assert.equal(backend.rows.get('allocation')!.deadline, backend.now);
      } finally {
        await h.close();
      }
    }
  },
);

test(
  'one cancelled admission cannot retire a shared allocation still needed by a valid pending admission',
  { timeout: 12000 },
  async () => {
    const backend = new MemoryCheckpoints(),
      entered = gate(),
      held = gate(),
      acquire = backend.acquire.bind(backend);
    backend.acquire = async (room, owner) => {
      const lease = await acquire(room, owner);
      entered.release();
      await held.promise;
      return lease;
    };
    const h = await harness(backend);
    try {
      const cancelled = await h.raw('cancelled');
      await entered.promise;
      const valid = await h.raw('valid');
      const closed = once(cancelled.socket, 'close');
      cancelled.socket.terminate();
      await closed;
      held.release();
      await valid.event('welcome');
      await valid.ready();
      assert.equal(backend.rows.get('allocation')!.epoch, 1);
      assert.equal(h.gateway.rooms.size, 1);
      assert.equal(h.gateway.rooms.get('allocation')!.connections.size, 1);
    } finally {
      held.release();
      await h.close();
    }
  },
);

test(
  'revalidation that crosses retirement reacquires the replacement worker before attaching',
  { timeout: 12000 },
  async () => {
    const backend = new MemoryCheckpoints(),
      initialProof = gate(),
      proofRead = gate(),
      proofHeld = gate(),
      readyHeld = gate(),
      commitEntered = gate(),
      commitHeld = gate();
    let checks = 0;
    const h = await harness(backend, async (req) => {
      const id = String(req.headers['x-test-actor']),
        grant = developmentAdmission(actor(id));
      if (id !== 'waiting') return grant;
      return {
        ...grant,
        revalidate: async () => {
          if (++checks === 1) {
            initialProof.release();
            return { actor: actor(id), expiresAt: Date.now() + 50 };
          }
          proofRead.release();
          await proofHeld.promise;
          return { actor: actor(id), expiresAt: Date.now() + 30000 };
        },
      };
    });
    try {
      const old = await h.raw('old');
      await old.event('welcome');
      await old.ready();
      const handle = h.gateway.rooms.get('allocation')!;
      handle.ready = readyHeld.promise;
      const waiting = await h.raw('waiting');
      await initialProof.promise;
      await delay(90);
      readyHeld.release();
      await proofRead.promise;
      backend.failCommit = async () => {
        backend.failCommit = null;
        commitEntered.release();
        await commitHeld.promise;
      };
      old.socket.terminate();
      await commitEntered.promise;
      let welcomed = false;
      const welcome = waiting.event('welcome').then((value) => {
        welcomed = true;
        return value;
      });
      proofHeld.release();
      await delay(80);
      assert.equal(welcomed, false);
      commitHeld.release();
      await welcome;
      await waiting.ready();
      assert.notEqual(h.gateway.rooms.get('allocation'), handle);
      assert.equal(backend.rows.get('allocation')!.epoch, 2);
    } finally {
      readyHeld.release();
      proofHeld.release();
      commitHeld.release();
      await h.close();
    }
  },
);
