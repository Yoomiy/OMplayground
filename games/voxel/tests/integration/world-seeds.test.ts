import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { MemoryCheckpoints } from '../fixtures/checkpoint-storage.ts';
import { connectProbe } from '../fixtures/socket-probe.ts';
import type { SocketProbe } from '../fixtures/socket-probe.ts';
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
  id: 'seed-player',
  role: 'participant' as const,
  capabilities: { build: true, fly: false, observe: false, combat: true, explosives: true },
};

// The PostgreSQL reservation/uniqueness contract is checked independently. This
// fixture exercises how real gateway workers consume that durable reservation.
class SeededMetadata extends MemoryCheckpoints {
  seeds = new Map<string, number>();
  override async acquire(room: string, owner: string) {
    const lease = await super.acquire(room, owner);
    if (!lease) return null;
    if (!this.seeds.has(room)) this.seeds.set(room, (1013904223 + this.seeds.size * 1664525) >>> 0);
    return { ...lease, seed: this.seeds.get(room)! };
  }
}

test(
  'fresh workers use distinct reserved seeds, retain them before the first checkpoint and restore the committed seed',
  { timeout: 30000 },
  async () => {
    const backend = new SeededMetadata(),
      probes: SocketProbe[] = [];
    const options = {
      build,
      content,
      worldDefaults: { mode: 'survival' as const },
      admit: async () => {
        const grant = () => ({ actor, expiresAt: Date.now() + 30000 });
        return { ...grant(), revalidate: async () => grant() };
      },
      persistence: { objects: backend, metadata: backend },
    };
    let gateway = await createGateway(options);
    const origin = () => {
      assert.ok(gateway.address && typeof gateway.address === 'object');
      return `http://127.0.0.1:${gateway.address.port}`;
    };
    try {
      const first = await connectProbe(origin(), 'first-seed', content.blocks.length);
      probes.push(first);
      const a = await first.event('welcome');
      await first.ready();
      const second = await connectProbe(origin(), 'second-seed', content.blocks.length);
      probes.push(second);
      const b = await second.event('welcome');
      await second.ready();
      assert.notEqual(a.seed, b.seed);
      assert.equal(a.seed, backend.seeds.get('first-seed'));
      assert.equal(b.seed, backend.seeds.get('second-seed'));
      assert.equal(backend.rows.get('first-seed')!.checkpoint, null);
      await gateway.rooms.get('first-seed')!.worker.terminate();
      for (let n = 0; n < 500 && gateway.rooms.has('first-seed'); n++) await delay(10);
      assert.equal(gateway.rooms.has('first-seed'), false);
      assert.equal(backend.rows.get('first-seed')!.checkpoint, null);
      const beforeSave = await connectProbe(origin(), 'first-seed', content.blocks.length);
      probes.push(beforeSave);
      assert.equal((await beforeSave.event('welcome')).seed, a.seed);
      await beforeSave.ready();
      await gateway.close();
      assert.ok(backend.rows.get('first-seed')!.checkpoint);
      // A new process/default must not replace a seed already recorded in a save.
      gateway = await createGateway({ ...options, worldDefaults: { mode: 'survival', seed: 7 } });
      const restored = await connectProbe(origin(), 'first-seed', content.blocks.length);
      probes.push(restored);
      assert.equal((await restored.event('welcome')).seed, a.seed);
      await restored.ready();
    } finally {
      for (const probe of probes) probe.socket.terminate();
      await gateway.close();
    }
  },
);
