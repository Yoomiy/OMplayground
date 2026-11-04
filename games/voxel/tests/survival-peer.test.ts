import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { WebSocketServer } from 'ws';
import { SurvivalPeer } from '../tools/survival-peer.ts';
import type { InventoryView } from '../src/shared/inventory.ts';
import type { ServerMessage } from '../src/shared/protocol.ts';

const view = (revision: number): InventoryView => ({
  version: 2,
  catalog: false,
  revision,
  selected: 0,
  bag: Array(36).fill(null),
  craft2: Array(4).fill(null),
  craft3: Array(9).fill(null),
  equipment: Array(5).fill(null),
  station: 'personal',
  container: null,
});

test('survival commands wait for the post-receipt inventory across split socket reads, including unchanged cached/rejected views', async () => {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address === 'object');
  const connected = once(server, 'connection');
  const peer = new SurvivalPeer('fixture', `ws://127.0.0.1:${address.port}`, 1);
  peer.epoch = 1;
  const [socket] = await connected;
  const send = (message: ServerMessage) => socket.send(JSON.stringify(message));
  try {
    await once(peer.socket, 'open');
    send({ type: 'inventory', epoch: 1, view: view(0) });
    await peer.until(() => !!peer.inventory, 'initial inventory');
    const message = {
      type: 'inventory' as const,
      epoch: 1,
      sequence: 1,
      operation: { kind: 'craft' as const, grid: 2 as const, count: 1, revision: 0 },
    };
    for (const [status, ok, revision] of [
      ['applied', true, 1],
      ['cached', true, 1],
      ['applied', false, 2],
    ] as const) {
      const command = ok
        ? message
        : {
            ...message,
            sequence: 2,
            operation: { ...message.operation, revision: peer.view().revision },
          };
      let settled = false;
      const received = once(socket, 'message');
      const pending = peer.transact(command).then((value) => {
        settled = true;
        return value;
      });
      await received;
      // An unrelated earlier view must not satisfy the post-receipt boundary.
      send({ type: 'inventory', epoch: 1, view: peer.view() });
      const after = peer.serial;
      send({
        type: 'result',
        epoch: 1,
        sequence: command.sequence,
        status,
        outcome: { ok, reason: ok ? 'crafted' : 'conflict' },
      });
      await peer.event(
        (event): event is Extract<ServerMessage, { type: 'result' }> =>
          'type' in event && event.type === 'result',
        after,
        'receipt',
      );
      await setImmediate();
      assert.equal(settled, false, `${status}/${ok} must wait for refreshed inventory`);
      send({ type: 'inventory', epoch: 1, view: view(revision) });
      assert.equal((await pending).result.status, status);
      assert.equal(peer.view().revision, revision);
    }
  } finally {
    peer.socket.terminate();
    for (const client of server.clients) client.terminate();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
