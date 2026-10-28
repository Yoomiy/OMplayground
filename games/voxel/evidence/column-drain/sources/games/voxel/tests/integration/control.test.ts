import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { MemoryCheckpoints } from '../fixtures/checkpoint-storage.ts';
import { connectProbe } from '../fixtures/socket-probe.ts';
import { developmentAdmission } from '../../tools/development-admission.ts';
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
test(
  'private controls serialize pause/resume and a disconnect cannot retire the worker during its committed-save acknowledgement',
  { timeout: 12000 },
  async () => {
    const backend = new MemoryCheckpoints(),
      events: string[] = [];
    let release!: () => void, entered!: () => void;
    const held = new Promise<void>((r) => (release = r)),
      saving = new Promise<void>((r) => (entered = r));
    backend.failCommit = async () => {
      entered();
      await held;
    };
    const gateway = await createGateway({
      build,
      content,
      persistence: { objects: backend, metadata: backend },
      sessions: { initialize: async () => {}, accept: async () => {}, project: async () => true },
      roomPolicy: async () => ({ state: 'playing', expiresAt: Date.now() + 5000 }),
      admit: async () =>
        developmentAdmission({
          id: 'kid',
          role: 'participant',
          capabilities: { build: true, observe: false, fly: true, combat: true, explosives: true },
        }),
      control: async (_req, body) => ({
        room: 'controlled',
        execute: async (c) => {
          const action = (body as { action: string }).action;
          events.push('begin-' + action);
          if (action === 'pause') {
            const pointer = await c.savePaused();
            assert.ok(pointer.sequence > 0);
            events.push('end-pause');
            return { saved: true };
          }
          c.resume();
          events.push('end-resume');
          return { saved: false };
        },
      }),
    });
    assert.ok(gateway.address && typeof gateway.address === 'object');
    const origin = `http://127.0.0.1:${gateway.address.port}`,
      p = await connectProbe(origin, 'controlled', content.blocks.length);
    await p.ready();
    const post = (action: string) =>
      fetch(origin + '/api/voxel/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
    try {
      const paused = post('pause');
      await saving;
      const resumed = post('resume');
      await delay(50);
      assert.deepEqual(events, ['begin-pause']);
      p.socket.close();
      await delay(50);
      assert.equal(gateway.rooms.size, 1);
      assert.equal(backend.rows.get('controlled')!.deadline, 30000);
      release();
      assert.equal((await paused).status, 200);
      assert.equal((await resumed).status, 200);
      assert.deepEqual(events, ['begin-pause', 'end-pause', 'begin-resume', 'end-resume']);
      for (let i = 0; i < 300 && gateway.rooms.size; i++) await delay(10);
      assert.equal(gateway.rooms.size, 0);
      assert.equal(backend.rows.get('controlled')!.deadline, backend.now);
    } finally {
      release();
      p.socket.terminate();
      await gateway.close();
    }
  },
);
