import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import fs from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { tcpShaper } from './fixtures/tcp-shaper.ts';
const evidence: Record<string, unknown>[] = [];
after(() => {
  const reportFile =
    process.env.VOXEL_SHAPER_REPORT_PATH ??
    fileURLToPath(new URL('../test-results/tcp-shaper.json', import.meta.url));
  fs.mkdirSync(dirname(reportFile), { recursive: true });
  fs.writeFileSync(
    reportFile,
    JSON.stringify(
      {
        result:
          evidence.length === 2
            ? 'SHAPED_TCP_SHARED_RATE_ORDER_CLEAN_HALF_CLOSE_AND_CANCELLATION_PASS'
            : 'FAIL',
        checkedAt: new Date().toISOString(),
        node: process.version,
        cases: evidence,
      },
      null,
      2,
    ) + '\n',
  );
});

test(
  'shaped real TCP preserves binary streams and shares its bandwidth across connections',
  { timeout: 10000 },
  async (t) => {
    const payloads = [Buffer.alloc(262144, 0xa7), Buffer.alloc(262144, 0x3c)];
    const waiting: { socket: net.Socket; bytes: Buffer }[] = [];
    const serverSockets = new Set<net.Socket>(),
      clientSockets = new Set<net.Socket>();
    const server = net.createServer({ allowHalfOpen: true }, (socket) => {
      serverSockets.add(socket);
      socket.on('close', () => serverSockets.delete(socket));
      const chunks: Buffer[] = [];
      let length = 0;
      socket.on('data', (chunk) => {
        chunks.push(chunk);
        length += chunk.length;
        if (length === payloads[0].length) {
          waiting.push({ socket, bytes: Buffer.concat(chunks) });
          // Both uploads must finish before either response starts: two shared-rate phases.
          if (waiting.length === 2) for (const peer of waiting) peer.socket.end(peer.bytes);
        }
      });
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert(address && typeof address === 'object');
    const profile = { rttMs: 60, jitterMs: 10, mbps: 4 };
    const relay = await tcpShaper(address.port, profile);
    let elapsedMs = 0,
      lowerBoundMs = 0;
    try {
      const began = performance.now();
      await Promise.all(
        payloads.map(async (payload) => {
          const socket = net.connect({ host: '127.0.0.1', port: relay.port }),
            chunks: Buffer[] = [];
          clientSockets.add(socket);
          socket.on('data', (chunk) => chunks.push(chunk));
          await once(socket, 'connect', { signal: t.signal });
          socket.end(payload);
          await once(socket, 'close', { signal: t.signal });
          assert.deepEqual(Buffer.concat(chunks), payload);
        }),
      );
      const elapsed = performance.now() - began,
        total = payloads.reduce((n, p) => n + p.length, 0);
      const serializationMs = (2 * total * 8000) / (profile.mbps * 1e6);
      const packetSlackMs = (2 * relay.stats.packetBytes * 8000) / (profile.mbps * 1e6);
      elapsedMs = elapsed;
      lowerBoundMs = serializationMs + profile.rttMs - 2 * profile.jitterMs - packetSlackMs - 5;
      assert(elapsed >= lowerBoundMs);
      const stats = relay.stats;
      assert.equal(stats.up.forwardedBytes, total);
      assert.equal(stats.down.forwardedBytes, total);
      for (const direction of [stats.up, stats.down]) {
        assert(direction.readPauses > 0);
        assert(direction.peakFlowQueuedBytes <= 131072);
        assert(direction.trace.every((t) => t.forwardedAt >= t.eligibleAt));
        for (let n = 1; n < direction.trace.length; n++) {
          const previous = direction.trace[n - 1],
            next = direction.trace[n];
          assert(
            next.forwardedAt - previous.forwardedAt >=
              (previous.bytes * 8000) / (profile.mbps * 1e6) - 0.001,
          );
        }
      }
    } finally {
      await relay.close();
      for (const socket of [...serverSockets, ...clientSockets]) socket.destroy();
      await new Promise<void>((r) => server.close(() => r()));
    }
    assert.equal(relay.stats.live, 0);
    assert.equal(relay.stats.opened, relay.stats.closed);
    for (const direction of [relay.stats.up, relay.stats.down]) {
      assert.equal(direction.queuedBytes, 0);
      assert.equal(direction.timers, 0);
      assert.equal(direction.flows, 0);
    }
    evidence.push({
      case: 'two-shared-rate-streams-and-clean-half-close',
      profile,
      streams: 2,
      bytesPerStream: payloads[0].length,
      elapsedMs,
      lowerBoundMs,
      transport: relay.stats,
    });
  },
);

test(
  'closing a shaped TCP relay retires queued bytes and timers without waiting for latency',
  { timeout: 5000 },
  async (t) => {
    const sockets = new Set<net.Socket>();
    const server = net.createServer((socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert(address && typeof address === 'object');
    const relay = await tcpShaper(address.port, { rttMs: 10000, jitterMs: 0, mbps: 1 });
    const socket = net.connect({ host: '127.0.0.1', port: relay.port });
    socket.on('error', () => {});
    try {
      await once(socket, 'connect', { signal: t.signal });
      socket.write(Buffer.alloc(131072, 0xd3));
      const deadline = performance.now() + 2000;
      while (!relay.stats.up.queuedBytes && performance.now() < deadline) await delay(5);
      assert(relay.stats.up.queuedBytes > 0);
      const began = performance.now();
      await relay.close();
      assert(performance.now() - began < 500);
      assert.equal(relay.stats.up.queuedBytes, 0);
      assert.equal(relay.stats.up.timers, 0);
      assert.equal(relay.stats.live, 0);
      evidence.push({
        case: 'pending-byte-and-timer-cancellation',
        elapsedMs: performance.now() - began,
        transport: relay.stats,
      });
    } finally {
      await relay.close();
      socket.destroy();
      for (const peer of sockets) peer.destroy();
      await new Promise<void>((r) => server.close(() => r()));
    }
  },
);
