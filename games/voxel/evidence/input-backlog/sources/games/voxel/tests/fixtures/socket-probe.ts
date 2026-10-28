import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { parseServerMessage, around } from '../../src/shared/protocol.ts';
import type { ClientMessage, ServerMessage } from '../../src/shared/protocol.ts';
import { decodeChunk } from '../../src/shared/chunk-wire.ts';
import type { ChunkFrame } from '../../src/shared/chunk-wire.ts';
export class SocketProbe {
  socket: WebSocket;
  events: (ServerMessage | ChunkFrame)[] = [];
  listeners = new Set<() => void>();
  constructor(url: string, states: number) {
    this.socket = new WebSocket(url);
    this.socket.on('error', () => {});
    this.socket.on('message', (raw, binary) => {
      const event = binary
        ? decodeChunk(new Uint8Array(raw as Buffer), states)
        : parseServerMessage(raw.toString());
      assert.ok(event);
      this.events.push(event);
      for (const notify of this.listeners) notify();
    });
  }
  send(message: ClientMessage) {
    this.socket.send(JSON.stringify(message));
  }
  wait<T extends ServerMessage | ChunkFrame>(
    predicate: (event: ServerMessage | ChunkFrame) => event is T,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const check = () => {
        const found = this.events.find(predicate);
        if (found) {
          clearTimeout(timer);
          this.listeners.delete(check);
          resolve(found);
        }
      };
      const timer = setTimeout(() => {
        this.listeners.delete(check);
        reject(new Error('socket event timeout'));
      }, 10000);
      this.listeners.add(check);
      check();
    });
  }
  async event<T extends ServerMessage['type']>(type: T) {
    return this.wait(
      (event): event is Extract<ServerMessage, { type: T }> =>
        'type' in event && event.type === type,
    );
  }
  async ready() {
    const baseline = await this.wait(
      (event): event is Extract<ServerMessage, { type: 'baseline' }> =>
        'type' in event && event.type === 'baseline' && event.reason === 'join',
    );
    const columns = around(
      Math.floor(baseline.state[0] / 16),
      Math.floor(baseline.state[2] / 16),
      1,
    ).map((column) => {
      const current = this.events.findLast(
        (event): event is ChunkFrame =>
          'kind' in event && event.x === column.x && event.z === column.z,
      );
      assert.ok(current);
      return { ...column, revision: current.revision };
    });
    this.send({ type: 'ready', epoch: baseline.epoch, columns });
    return this.wait(
      (event): event is Extract<ServerMessage, { type: 'baseline' }> =>
        'type' in event && event.type === 'baseline' && event.reason === 'ready',
    );
  }
}
export async function connectProbe(origin: string, room: string, states: number, actor = 'a') {
  const response = await fetch(`${origin}/api/voxel/admission`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test-actor': actor },
    body: JSON.stringify({ room }),
  });
  assert.equal(response.status, 200);
  const ticket = (await response.json()) as { ticket: string; buildId: string };
  const probe = new SocketProbe(origin.replace(/^http/, 'ws') + '/voxel', states);
  try {
    await once(probe.socket, 'open');
    probe.send({ type: 'hello', ...ticket });
    await probe.event('welcome');
    return probe;
  } catch (error) {
    probe.socket.terminate();
    throw error;
  }
}
