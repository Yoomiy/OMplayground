import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { MemoryCheckpoints } from '../fixtures/checkpoint-storage.ts';
import { SocketProbe } from '../fixtures/socket-probe.ts';
import { developmentAdmission } from '../../tools/development-admission.ts';
import type { SessionView } from '../../src/server/session-projection.ts';
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
const actor = {
  id: 'member',
  role: 'participant' as const,
  capabilities: { build: true, fly: true, observe: false, combat: true, explosives: true },
};
async function until(check: () => boolean) {
  for (let i = 0; i < 300 && !check(); i++) await delay(10);
  assert.ok(check(), 'condition did not settle');
}

test(
  'durable membership must succeed before welcome; failed final presence retains the lease until a successful drain',
  { timeout: 15000 },
  async () => {
    const backend = new MemoryCheckpoints(),
      writes: { sequence: number; view: SessionView }[] = [];
    let release!: () => void,
      acceptEntered = false,
      failFinal = false;
    const held = new Promise<void>((r) => (release = r));
    const gateway = await createGateway({
      build,
      content,
      admit: async () => developmentAdmission(actor),
      persistence: { objects: backend, metadata: backend },
      roomPolicy: async () => ({ state: 'playing', expiresAt: Date.now() + 5000 }),
      sessions: {
        async initialize(lease) {
          assert.equal(lease.epoch, 1);
        },
        async accept(lease, value) {
          assert.equal(value.id, actor.id);
          assert.equal(lease.room, 'projection');
          acceptEntered = true;
          await held;
        },
        async project(lease, sequence, view) {
          assert.equal(lease.epoch, 1);
          if (failFinal && view.participants.length === 0)
            throw new Error('injected final presence outage');
          writes.push({ sequence, view });
          return true;
        },
      },
    });
    assert.ok(gateway.address && typeof gateway.address === 'object');
    const origin = `http://127.0.0.1:${gateway.address.port}`;
    const admission = await fetch(origin + '/api/voxel/admission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: 'projection' }),
    });
    const ticket = (await admission.json()) as { ticket: string; buildId: string };
    const p = new SocketProbe(origin.replace(/^http/, 'ws') + '/voxel', content.blocks.length);
    let closed = false;
    try {
      await once(p.socket, 'open');
      p.send({ type: 'hello', ...ticket });
      await until(() => acceptEntered);
      await delay(80);
      assert.equal(
        p.events.some((e) => 'type' in e && e.type === 'welcome'),
        false,
      );
      release();
      await p.ready();
      await until(() => writes.some((w) => w.view.participants.includes('member')));
      failFinal = true;
      p.socket.close();
      await until(() => gateway.rooms.get('projection')?.retiring === true);
      await delay(100);
      assert.equal(
        backend.rows.get('projection')!.deadline,
        30000,
        'failed projection cannot acknowledge release',
      );
      assert.ok(backend.commits.length > 0, 'world save precedes final presence');
      failFinal = false;
      await gateway.close();
      closed = true;
      assert.deepEqual(writes.at(-1)!.view, { state: 'paused', participants: [] });
      assert.equal(backend.rows.get('projection')!.deadline, backend.now);
      assert.ok(writes.every((w, i) => i === 0 || w.sequence > writes[i - 1].sequence));
    } finally {
      release();
      p.socket.terminate();
      if (!closed) await gateway.close();
    }
  },
);

test(
  'rejected accepted-member IO never attaches an actor and retires its unjoined owner',
  { timeout: 10000 },
  async () => {
    const backend = new MemoryCheckpoints();
    const gateway = await createGateway({
      build,
      content,
      admit: async () => developmentAdmission(actor),
      persistence: { objects: backend, metadata: backend },
      roomPolicy: async () => ({ state: 'playing', expiresAt: Date.now() + 5000 }),
      sessions: {
        initialize: async () => {},
        accept: async () => {
          throw new Error('membership unavailable');
        },
        project: async () => true,
      },
    });
    assert.ok(gateway.address && typeof gateway.address === 'object');
    try {
      const origin = `http://127.0.0.1:${gateway.address.port}`;
      const response = await fetch(origin + '/api/voxel/admission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: 'denied' }),
      });
      assert.equal(response.status, 200);
      const ticket = (await response.json()) as { ticket: string; buildId: string };
      const probe = new SocketProbe(
        origin.replace(/^http/, 'ws') + '/voxel',
        content.blocks.length,
      );
      await once(probe.socket, 'open');
      const closed = once(probe.socket, 'close');
      probe.send({ type: 'hello', ...ticket });
      assert.equal((await probe.event('error')).code, 'RECOVERING');
      await closed;
      assert.equal(
        probe.events.some((e) => 'type' in e && e.type === 'welcome'),
        false,
      );
      await until(() => gateway.rooms.size === 0);
      assert.equal(backend.rows.get('denied')!.deadline, backend.now);
    } finally {
      await gateway.close();
    }
  },
);
