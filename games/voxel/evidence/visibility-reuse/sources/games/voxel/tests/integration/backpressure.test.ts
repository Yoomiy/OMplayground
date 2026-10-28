import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import type { WebSocket } from 'ws';
import { developmentAdmission } from '../../tools/development-admission.ts';
import { SocketProbe } from '../fixtures/socket-probe.ts';
import { NEUTRAL } from '../../src/shared/input.ts';
import type { ServerMessage } from '../../src/shared/protocol.ts';
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

async function harness() {
  let attaching = '';
  const serverPeers = new Map<string, WebSocket>(),
    probes: SocketProbe[] = [],
    events: string[] = [];
  const gateway = await createGateway({
    build,
    content,
    onEvent(name) {
      events.push(name);
    },
    admit: async (req) => {
      const id = String(req.headers['x-test-actor']),
        observer = id !== 'mover';
      return developmentAdmission({
        id,
        role: observer ? 'observer' : 'participant',
        capabilities: {
          build: !observer,
          fly: observer,
          observe: observer,
          combat: !observer,
          explosives: !observer,
        },
      });
    },
  });
  gateway.sockets.on('connection', (socket) => serverPeers.set(attaching, socket));
  const address = gateway.address;
  assert(address && typeof address === 'object');
  const origin = `http://127.0.0.1:${address.port}`;
  const connect = async (id: string, key = id) => {
    const response = await fetch(origin + '/api/voxel/admission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-actor': id },
      body: JSON.stringify({ room: 'backpressure' }),
    });
    assert.equal(response.status, 200);
    const ticket = (await response.json()) as { ticket: string; buildId: string };
    attaching = key;
    const probe = new SocketProbe(origin.replace(/^http/, 'ws') + '/voxel', content.blocks.length);
    probes.push(probe);
    await once(probe.socket, 'open');
    probe.send({ type: 'hello', ...ticket });
    await probe.event('welcome');
    const ready = await probe.ready();
    probe.send({ type: 'focus', epoch: ready.epoch, active: true });
    const baseline = await probe.wait(
      (e): e is Extract<ServerMessage, { type: 'baseline' }> =>
        'type' in e && e.type === 'baseline' && e.reason === 'focus',
    );
    return { probe, baseline };
  };
  return {
    gateway,
    events,
    serverPeers,
    connect,
    async close() {
      for (const p of probes) p.socket.terminate();
      await gateway.close();
    },
  };
}
const yaw = (probe: SocketProbe, value: number) =>
  probe.wait(
    (e): e is Extract<ServerMessage, { type: 'snapshot' }> =>
      'type' in e &&
      e.type === 'snapshot' &&
      e.actors.some((a) => a.id === 'mover' && a.yaw === value),
  );

test(
  'temporary output pressure cannot silently lose a final actor delta while healthy peers continue',
  { timeout: 15000 },
  async () => {
    const h = await harness();
    try {
      const mover = await h.connect('mover'),
        slow = await h.connect('slow'),
        healthy = await h.connect('healthy');
      await slow.probe.wait(
        (e): e is Extract<ServerMessage, { type: 'actor_joined' }> =>
          'type' in e && e.type === 'actor_joined' && e.actor.id === 'mover',
      );
      await healthy.probe.wait(
        (e): e is Extract<ServerMessage, { type: 'actor_joined' }> =>
          'type' in e && e.type === 'actor_joined' && e.actor.id === 'mover',
      );
      const server = h.serverPeers.get('slow')!;
      assert(server);
      let pressured = true;
      const native = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(server),
        'bufferedAmount',
      )!.get!;
      // Deterministic transport-pressure injection. Packets still use real WS/native workers;
      // this case does not claim a physical TCP stall or network qualification.
      Object.defineProperty(server, 'bufferedAmount', {
        configurable: true,
        get: () => (pressured ? 80 * 1024 : native.call(server)),
      });
      mover.probe.send({
        type: 'input',
        frames: [1, 2].map((sequence) => ({
          ...NEUTRAL,
          yaw: 0.9,
          epoch: mover.baseline.epoch,
          sequence,
        })),
      });
      await yaw(healthy.probe, 0.9);
      await delay(200);
      pressured = false;
      await yaw(slow.probe, 0.9);
      assert.equal(slow.probe.socket.readyState, 1);
      assert.equal(healthy.probe.socket.readyState, 1);
    } finally {
      await h.close();
    }
  },
);

test(
  'snapshot pressure above the shared output budget closes only that peer and readmission receives a fresh baseline',
  { timeout: 15000 },
  async () => {
    const h = await harness();
    try {
      const mover = await h.connect('mover'),
        slow = await h.connect('slow'),
        healthy = await h.connect('healthy');
      await delay(250); // Let initial reliable actor/drop baselines drain before snapshot-only pressure.
      const server = h.serverPeers.get('slow')!;
      assert(server);
      Object.defineProperty(server, 'bufferedAmount', {
        configurable: true,
        get: () => 2 * 1024 * 1024,
      });
      const [code] = await once(slow.probe.socket, 'close', { signal: AbortSignal.timeout(4000) });
      assert.equal(code, 1013);
      assert.equal(healthy.probe.socket.readyState, 1);
      assert.equal(mover.probe.socket.readyState, 1);
      const fresh = await h.connect('slow', 'fresh');
      assert.equal(fresh.probe.socket.readyState, 1);
      assert(h.events.includes('VOXEL_BACKPRESSURE_RECOVERY'));
    } finally {
      await h.close();
    }
  },
);
