import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { MemoryCheckpoints } from '../fixtures/checkpoint-storage.ts';
import { connectProbe } from '../fixtures/socket-probe.ts';
import { developmentAdmission } from '../../tools/development-admission.ts';
import type { StaffCommand } from '../../src/shared/staff.ts';
import type { FromRoom } from '../../src/server/room-worker-protocol.ts';
const { createGateway }: typeof import('../../src/server/gateway.ts') = process.env
  .VOXEL_TEST_BUNDLE
  ? await import(new URL('../../dist-server/gateway.js', import.meta.url).href)
  : await import('../../src/server/gateway.ts');
const build = JSON.parse(
    readFileSync(new URL('../../artifacts/build.json', import.meta.url), 'utf8'),
  ),
  content = JSON.parse(
    readFileSync(new URL('../../artifacts/content.json', import.meta.url), 'utf8'),
  );
async function fixture() {
  const backend = new MemoryCheckpoints();
  let selected = {
    requestId: randomUUID(),
    revision: 1,
    command: { kind: 'mode', mode: 'creative' } as StaffCommand,
  };
  const gateway = await createGateway({
    build,
    content,
    persistence: { objects: backend, metadata: backend },
    sessions: { initialize: async () => {}, accept: async () => {}, project: async () => true },
    roomPolicy: async () => ({ state: 'playing', expiresAt: Date.now() + 5000 }),
    worldDefaults: { mode: 'survival' },
    admit: async () =>
      developmentAdmission({
        id: 'teacher',
        role: 'observer',
        capabilities: { observe: true, build: false, fly: true, combat: false, explosives: false },
      }),
    control: async () => ({
      room: 'staff',
      execute: (c) => c.staff({ ...selected, actorId: 'teacher', expiresAt: Date.now() + 4000 }),
    }),
  });
  assert.ok(gateway.address && typeof gateway.address === 'object');
  const origin = `http://127.0.0.1:${gateway.address.port}`,
    probe = await connectProbe(origin, 'staff', content.blocks.length);
  await probe.ready();
  return {
    gateway,
    probe,
    set(value: typeof selected) {
      selected = value;
    },
    async post() {
      const response = await fetch(origin + '/api/voxel/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      assert.equal(response.status, 200);
      return response.json();
    },
    async close() {
      probe.socket.terminate();
      await gateway.close();
    },
  };
}
test(
  'trusted worker mode/teleport retries return cached outcomes and cache eviction never reexecutes an earlier revision',
  { timeout: 15000 },
  async () => {
    const f = await fixture();
    try {
      const first = await f.post();
      assert.deepEqual(first, { ok: true, reason: 'mode' });
      const initial = await f.probe.wait(
        (e): e is any => 'type' in e && e.type === 'baseline' && e.reason === 'mode',
      );
      assert.deepEqual(await f.post(), first);
      assert.equal(f.probe.events.filter((e) => 'type' in e && e.type === 'rules').length, 1);
      const id = randomUUID();
      f.set({ requestId: id, revision: 2, command: { kind: 'teleport', target: 'spawn' } });
      assert.equal((await f.post()).reason, 'teleport');
      const moved = await f.probe.wait(
        (e): e is any => 'type' in e && e.type === 'baseline' && e.reason === 'teleport',
      );
      assert.ok(moved.epoch > initial.epoch);
      assert.equal((await f.post()).reason, 'teleport');
      for (let revision = 3; revision < 133; revision++) {
        f.set({ requestId: randomUUID(), revision, command: { kind: 'mode', mode: 'creative' } });
        assert.equal((await f.post()).reason, 'unchanged');
      }
      f.set({ requestId: id, revision: 2, command: { kind: 'teleport', target: 'spawn' } });
      assert.deepEqual(await f.post(), { ok: false, reason: 'retired' });
      assert.equal(
        f.probe.events.filter(
          (e) => 'type' in e && e.type === 'baseline' && e.reason === 'teleport',
        ).length,
        1,
      );
    } finally {
      await f.close();
    }
  },
);
test(
  'a paused worker independently rejects an expired private staff deadline without changing its mode',
  { timeout: 10000 },
  async () => {
    const f = await fixture();
    try {
      const handle = f.gateway.rooms.get('staff')!,
        requestId = randomUUID();
      const result = new Promise<Extract<FromRoom, { type: 'staff-result' }>>((resolve, reject) => {
        const timer = setTimeout(() => {
          handle.worker.off('message', receive);
          reject(new Error('no staff result'));
        }, 3000);
        const receive = (e: FromRoom) => {
          if (e.type === 'staff-result' && e.requestId === requestId) {
            clearTimeout(timer);
            handle.worker.off('message', receive);
            resolve(e);
          }
        };
        handle.worker.on('message', receive);
      });
      handle.worker.postMessage({
        type: 'staff',
        requestId,
        revision: 1,
        actorId: 'teacher',
        command: { kind: 'mode', mode: 'creative' },
        deadline: performance.now() - 1,
      });
      assert.deepEqual((await result).result, { ok: false, reason: 'expired' });
      assert.equal(
        f.probe.events.some((e) => 'type' in e && e.type === 'rules'),
        false,
      );
      f.set({ requestId: randomUUID(), revision: 2, command: { kind: 'mode', mode: 'creative' } });
      assert.equal((await f.post()).ok, true);
    } finally {
      await f.close();
    }
  },
);
