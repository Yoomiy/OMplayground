import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { connectProbe } from '../fixtures/socket-probe.ts';
import type { SocketProbe } from '../fixtures/socket-probe.ts';
import { developmentAdmission } from '../../tools/development-admission.ts';
import type { FromRoom, ToRoom } from '../../src/server/room-worker-protocol.ts';
import type { RoomCheckpoint } from '../../src/sim/room-checkpoint.ts';
import type { ServerMessage } from '../../src/shared/protocol.ts';
import type { RoomPolicy } from '../../src/server/room-policy.ts';
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
async function harness() {
  const control = { state: 'playing' as RoomPolicy['state'], unavailable: false, ttl: 600 };
  const gateway = await createGateway({
    build,
    content,
    worldDefaults: { mode: 'survival' },
    admit: async (req) => {
      const id = String(req.headers['x-test-actor'] ?? 'kid'),
        observer = id === 'staff';
      return developmentAdmission({
        id,
        role: observer ? 'observer' : 'participant',
        capabilities: {
          build: !observer,
          fly: true,
          observe: observer,
          combat: !observer,
          explosives: !observer,
        },
      });
    },
    roomPolicy: async () => {
      if (control.unavailable) throw new Error('private provider detail');
      return { state: control.state, expiresAt: Date.now() + control.ttl };
    },
  });
  assert.ok(gateway.address && typeof gateway.address === 'object');
  const origin = `http://127.0.0.1:${gateway.address.port}`,
    probes: SocketProbe[] = [];
  let request = 0;
  return {
    gateway,
    control,
    async join(id: string) {
      const p = await connectProbe(origin, 'lifecycle', content.blocks.length, id);
      probes.push(p);
      const ready = await p.ready();
      p.send({ type: 'focus', epoch: ready.epoch, active: true });
      await p.wait(
        (event): event is Extract<ServerMessage, { type: 'baseline' }> =>
          'type' in event &&
          event.type === 'baseline' &&
          event.reason === 'focus' &&
          event.epoch > ready.epoch,
      );
      return p;
    },
    async capture(): Promise<RoomCheckpoint> {
      const worker = gateway.rooms.get('lifecycle')!.worker,
        id = ++request;
      const result = new Promise<RoomCheckpoint>((resolve, reject) => {
        const timeout = setTimeout(() => {
          worker.off('message', listen);
          reject(new Error('capture timeout'));
        }, 5000);
        const listen = (event: FromRoom) => {
          if (event.type !== 'checkpoint' || event.requestId !== id) return;
          clearTimeout(timeout);
          worker.off('message', listen);
          resolve(event.checkpoint);
        };
        worker.on('message', listen);
      });
      worker.postMessage({ type: 'checkpoint', requestId: id, pause: false } satisfies ToRoom);
      return result;
    },
    async close() {
      for (const p of probes) p.socket.terminate();
      await gateway.close();
    },
  };
}
const lifecycle = (probe: SocketProbe, state: string, reason: string, after = 0) =>
  probe.wait(
    (event): event is Extract<ServerMessage, { type: 'lifecycle' }> =>
      'type' in event &&
      event.type === 'lifecycle' &&
      event.state === state &&
      event.reason === reason &&
      probe.events.indexOf(event) >= after,
  );

test(
  'authorized observers keep camera control while only current participants advance world time',
  { timeout: 10000 },
  async () => {
    const h = await harness();
    let timer: ReturnType<typeof setInterval> | undefined;
    try {
      const staff = await h.join('staff');
      await lifecycle(staff, 'paused', 'no_participants');
      const first = await h.capture(),
        y = first.players.find((p) => p.id === 'staff')!.state[1];
      let sequence = 0;
      const latest = staff.events.findLast((e) => 'type' in e && e.type === 'baseline') as Extract<
        ServerMessage,
        { type: 'baseline' }
      >;
      timer = setInterval(
        () =>
          staff.send({
            type: 'input',
            frames: [1, 2].map(() => ({
              epoch: latest.epoch,
              sequence: ++sequence,
              x: 0,
              z: 0,
              yaw: 0,
              pitch: 0,
              jump: true,
              sneak: false,
              sprint: false,
            })),
          }),
        33,
      );
      await delay(300);
      const moved = await h.capture();
      assert.equal(moved.tick, first.tick);
      assert.ok(moved.players.find((p) => p.id === 'staff')!.state[1] > y + 0.5);
      h.gateway.resume('lifecycle');
      await delay(60);
      assert.equal((await h.capture()).tick, first.tick);
      clearInterval(timer);
      timer = undefined;
      const kid = await h.join('kid');
      await delay(120);
      const playing = await h.capture();
      assert.ok(playing.tick > first.tick);
      const at = staff.events.length;
      kid.socket.terminate();
      await lifecycle(staff, 'paused', 'no_participants', at);
      const paused = await h.capture();
      await delay(150);
      assert.equal((await h.capture()).tick, paused.tick);
    } finally {
      if (timer) clearInterval(timer);
      await h.close();
    }
  },
);

test(
  'session and expired-policy pauses resist resume, recover without offline ticks, and ended sessions retire',
  { timeout: 12000 },
  async () => {
    const h = await harness();
    try {
      const kid = await h.join('kid'),
        staff = await h.join('staff');
      let at = staff.events.length;
      h.control.state = 'paused';
      await lifecycle(staff, 'paused', 'session', at);
      const paused = await h.capture();
      h.gateway.resume('lifecycle');
      await delay(150);
      assert.equal((await h.capture()).tick, paused.tick);
      at = staff.events.length;
      h.control.unavailable = true;
      await lifecycle(staff, 'paused', 'policy_unavailable', at);
      const unknown = await h.capture();
      h.gateway.resume('lifecycle');
      await delay(150);
      assert.equal((await h.capture()).tick, unknown.tick);
      at = staff.events.length;
      h.control.unavailable = false;
      h.control.state = 'playing';
      await lifecycle(staff, 'playing', 'allowed', at);
      await delay(120);
      const resumed = await h.capture();
      assert.ok(resumed.tick > unknown.tick && resumed.tick < unknown.tick + 12);
      h.control.state = 'ended';
      assert.equal((await kid.event('error')).code, 'SESSION_ENDED');
      assert.equal((await staff.event('error')).code, 'SESSION_ENDED');
      for (let n = 0; h.gateway.rooms.size && n < 100; n++) await delay(10);
      assert.equal(h.gateway.rooms.size, 0);
    } finally {
      await h.close();
    }
  },
);
