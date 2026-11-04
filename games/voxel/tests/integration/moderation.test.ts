import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { WebSocket } from 'ws';
import { MemoryCheckpoints } from '../fixtures/checkpoint-storage.ts';
import { SocketProbe, connectProbe } from '../fixtures/socket-probe.ts';
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
  let revision = 0;
  let acceptHook: (actor: string) => Promise<void> = async () => {};
  const gateway = await createGateway({
    build,
    content,
    persistence: { objects: backend, metadata: backend },
    roomPolicy: async () => ({ state: 'playing', expiresAt: Date.now() + 5000 }),
    sessions: {
      initialize: async () => {},
      project: async () => true,
      accept: async (_lease, actor) => acceptHook(actor.id),
    },
    admit: async (req) => {
      const actor = {
          id: String(req.headers['x-test-actor'] ?? 'kid'),
          role: 'participant' as const,
          capabilities: { build: true, fly: true, observe: false, combat: true, explosives: true },
        },
        issued = revision;
      const proof = () => ({ actor, expiresAt: Date.now() + 5000, membershipRevision: issued });
      return { ...proof(), revalidate: async () => proof() };
    },
    api: {
      '/api/voxel/revoke-fixture': async (_req, body, _res, context) => {
        assert.ok(context);
        const value = body as { target: string; revision: number };
        context.revoke('moderation', value.target, value.revision);
        return { ok: true };
      },
    },
  });
  assert.ok(gateway.address && typeof gateway.address === 'object');
  const origin = `http://127.0.0.1:${gateway.address.port}`;
  return {
    gateway,
    origin,
    setAccept(hook: typeof acceptHook) {
      acceptHook = hook;
    },
    async revoke(value: number) {
      revision = Math.max(revision, value);
      const result = await fetch(origin + '/api/voxel/revoke-fixture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'kid', revision: value }),
      });
      assert.equal(result.status, 200);
    },
  };
}
test(
  'trusted removal closes previous admissions while replay cannot evict a later explicit rejoin or its peers',
  { timeout: 15000 },
  async () => {
    const f = await fixture(),
      probes: SocketProbe[] = [];
    try {
      const peer = await connectProbe(f.origin, 'moderation', content.blocks.length, 'peer');
      probes.push(peer);
      await peer.ready();
      const old = await connectProbe(f.origin, 'moderation', content.blocks.length, 'kid');
      probes.push(old);
      await old.ready();
      const closed = once(old.socket, 'close');
      await f.revoke(1);
      assert.equal((await closed)[0], 1008);
      assert.equal((await old.event('error')).code, 'UNAUTHORIZED');
      const fresh = await connectProbe(f.origin, 'moderation', content.blocks.length, 'kid');
      probes.push(fresh);
      await fresh.ready();
      await f.revoke(1);
      assert.equal(fresh.socket.readyState, WebSocket.OPEN);
      assert.equal(peer.socket.readyState, WebSocket.OPEN);
      assert.equal(f.gateway.rooms.get('moderation')!.connections.size, 2);
    } finally {
      for (const probe of probes) probe.socket.terminate();
      await f.gateway.close();
    }
  },
);
test(
  'revocation fences an admission whose earlier membership acceptance is still returning',
  { timeout: 15000 },
  async () => {
    const f = await fixture(),
      probes: SocketProbe[] = [];
    let release!: () => void, entered!: () => void;
    const blocked = new Promise<void>((resolve) => {
        release = resolve;
      }),
      accepted = new Promise<void>((resolve) => {
        entered = resolve;
      });
    try {
      const peer = await connectProbe(f.origin, 'moderation', content.blocks.length, 'peer');
      probes.push(peer);
      await peer.ready();
      f.setAccept(async (actor) => {
        if (actor === 'kid') {
          entered();
          await blocked;
        }
      });
      const response = await fetch(f.origin + '/api/voxel/admission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-actor': 'kid' },
        body: JSON.stringify({ room: 'moderation' }),
      });
      const ticket = await response.json();
      const old = new SocketProbe(
        f.origin.replace(/^http/, 'ws') + '/voxel',
        content.blocks.length,
      );
      probes.push(old);
      await once(old.socket, 'open');
      old.send({ type: 'hello', ...ticket });
      await accepted;
      const closed = once(old.socket, 'close');
      await f.revoke(1);
      release();
      assert.equal((await old.event('error')).code, 'UNAUTHORIZED');
      assert.equal((await closed)[0], 1008);
      assert.equal(
        old.events.some((event) => 'type' in event && event.type === 'welcome'),
        false,
      );
      assert.equal(f.gateway.rooms.get('moderation')!.connections.size, 1);
    } finally {
      release();
      for (const probe of probes) probe.socket.terminate();
      await f.gateway.close();
    }
  },
);
