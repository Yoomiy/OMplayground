import assert from 'node:assert/strict';
import net from 'node:net';
import { once } from 'node:events';

/** Actual TCP read suspension. Never changes WebSocket bufferedAmount or frames. */
export async function tcpGate(port: number) {
  const pairs = new Set<{ client: net.Socket; upstream: net.Socket }>();
  let held = false,
    heldClient = false,
    bytesFromServer = 0,
    bytesFromClient = 0;
  const server = net.createServer((client) => {
    const upstream = net.connect({ host: '127.0.0.1', port }),
      pair = { client, upstream };
    pairs.add(pair);
    client.on('error', () => upstream.destroy());
    upstream.on('error', () => client.destroy());
    client.on('close', () => {
      pairs.delete(pair);
      upstream.destroy();
    });
    upstream.on('close', () => client.destroy());
    upstream.on('data', (bytes) => (bytesFromServer += bytes.byteLength));
    client.on('data', (bytes) => (bytesFromClient += bytes.byteLength));
    if (heldClient) client.pause();
    else client.pipe(upstream);
    if (held) upstream.pause();
    else upstream.pipe(client);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address === 'object');
  return {
    url: `ws://127.0.0.1:${address.port}/voxel`,
    get bytesFromServer() {
      return bytesFromServer;
    },
    get bytesFromClient() {
      return bytesFromClient;
    },
    /** Direction names identify the TCP source whose reads are suspended. */
    hold(direction: 'server' | 'client' = 'server') {
      if (direction === 'client') {
        if (heldClient) return;
        heldClient = true;
        for (const p of pairs) {
          p.client.unpipe(p.upstream);
          p.client.pause();
        }
        return;
      }
      if (held) return;
      held = true;
      for (const p of pairs) {
        p.upstream.unpipe(p.client);
        p.upstream.pause();
      }
    },
    release(direction: 'server' | 'client' = 'server') {
      if (direction === 'client') {
        if (!heldClient) return;
        heldClient = false;
        for (const p of pairs) {
          p.client.pipe(p.upstream);
          p.client.resume();
        }
        return;
      }
      if (!held) return;
      held = false;
      for (const p of pairs) {
        p.upstream.pipe(p.client);
        p.upstream.resume();
      }
    },
    async close() {
      for (const p of pairs) {
        p.client.destroy();
        p.upstream.destroy();
      }
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
