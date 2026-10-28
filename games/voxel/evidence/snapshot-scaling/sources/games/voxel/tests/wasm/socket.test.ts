import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { WebSocket, WebSocketServer } from 'ws';
import { stepMovement } from '../../src/shared/movement.ts';
import { MovementRoom } from '../../src/sim/movement-room.ts';
import { flatWorld } from './fixture.ts';
const frame = (sequence: number) => ({
  epoch: 1,
  sequence,
  x: 1,
  z: 0,
  yaw: 0,
  pitch: 0,
  jump: false,
  sneak: false,
  sprint: false,
});
/** Regression for research/voxel-runtime/input-time-socket.ts; transport carries no dt. */
test(
  'real WebSocket bursts cannot accelerate actual Wasm physics',
  { timeout: 10000 },
  async () => {
    const world = flatWorld(),
      started = performance.now(),
      room = new MovementRoom(world, started);
    const server = new WebSocketServer({
      host: '127.0.0.1',
      port: 0,
      maxPayload: 16384,
      perMessageDeflate: false,
    });
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const slots: number[] = [];
    let connections = 0,
      rejected = 0,
      overflows = 0;
    server.on('connection', (socket) => {
      const id = String(connections++),
        slot = world.player_add(0.5, 3, 0.5);
      slots.push(slot);
      world.set_flying(slot, true);
      room.add(id, slot, 1);
      socket.on('message', (bytes) => {
        let value: unknown;
        try {
          value = JSON.parse(bytes.toString());
        } catch {
          rejected++;
          return;
        }
        const result = room.receive(id, value, performance.now());
        if (result === 'invalid') rejected++;
        if (result === 'resync') overflows++;
        socket.send(JSON.stringify({ sequence: (value as { sequence?: number }).sequence ?? 0 }));
      });
    });
    const a = new WebSocket(`ws://127.0.0.1:${address.port}`),
      b = new WebSocket(`ws://127.0.0.1:${address.port}`);
    let tickTimer: ReturnType<typeof setInterval> | undefined,
      sendTimer: ReturnType<typeof setInterval> | undefined;
    try {
      await Promise.all([once(a, 'open'), once(b, 'open')]);
      let ordinary = 0,
        burst = 0,
        ticks = 0;
      function receipt(socket: WebSocket, sequence: number): Promise<void> {
        return new Promise((resolve) => {
          const listener = (bytes: import('ws').RawData) => {
            if (JSON.parse(bytes.toString()).sequence === sequence) {
              socket.off('message', listener);
              resolve();
            }
          };
          socket.on('message', listener);
        });
      }
      const readyA = receipt(a, 1),
        readyB = receipt(b, 60);
      a.send(JSON.stringify(frame(++ordinary)));
      for (let n = 0; n < 60; n++) b.send(JSON.stringify(frame(++burst)));
      b.send(JSON.stringify({ ...frame(++burst), dt: 0.1 }));
      b.send(JSON.stringify({ type: 'dev', source: 'move 10000' }));
      await Promise.all([readyA, readyB]);
      room.resetClock(performance.now());
      tickTimer = setInterval(() => {
        ticks += room.advance(performance.now()).steps;
      }, 4);
      sendTimer = setInterval(() => {
        for (let n = 0; n < 2; n++) {
          a.send(JSON.stringify(frame(++ordinary)));
          b.send(JSON.stringify(frame(++burst)));
        }
      }, 1000 / 30);
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const normal = world.player_state(slots[0])[0] - 0.5,
        burstDistance = world.player_state(slots[1])[0] - 0.5;
      assert.equal(rejected, 2);
      assert.ok(overflows > 0);
      assert.ok(normal > 2);
      const reference = world.player_add(0.5, 3, 0.5);
      world.set_flying(reference, true);
      for (let step = 0; step < ticks * 2; step++) stepMovement(world, reference, frame(1));
      const earnedDistance = world.player_state(reference)[0] - 0.5;
      assert.ok(
        Math.abs(burstDistance - normal) < 1e-9,
        `burst ${burstDistance} vs normal ${normal}`,
      );
      assert.ok(
        burstDistance <= earnedDistance + 1e-9,
        'burst must remain within scheduled authoritative movement time',
      );
    } finally {
      clearInterval(tickTimer);
      clearInterval(sendTimer);
      a.terminate();
      b.terminate();
      for (const client of server.clients) client.terminate();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      world.free();
    }
  },
);
