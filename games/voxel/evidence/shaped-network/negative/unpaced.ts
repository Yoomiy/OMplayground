import assert from 'node:assert/strict';
import net from 'node:net';
import { once } from 'node:events';

export type NetworkProfile = { rttMs: number; jitterMs: number; mbps: number };
const PACKET_BYTES = 8192;
const FLOW_BUFFER_BYTES = 65536;
type Chunk = { bytes: Buffer; offset: number; receivedAt: number; eligibleAt: number };
type Flow = {
  source: net.Socket;
  destination: net.Socket;
  queue: Chunk[];
  queuedBytes: number;
  blocked: boolean;
  ended: boolean;
};
/** Test-only byte forwarding. One shared rate budget per direction, across all connections. */
class Direction {
  private flows = new Set<Flow>();
  private timer?: ReturnType<typeof setTimeout>;
  private nextSendAt = 0;
  private serial = 0;
  private closed = false;
  private counters = {
    receivedBytes: 0,
    forwardedBytes: 0,
    queuedBytes: 0,
    peakQueuedBytes: 0,
    peakFlowQueuedBytes: 0,
    packets: 0,
    readPauses: 0,
    writePauses: 0,
    trace: [] as { receivedAt: number; eligibleAt: number; forwardedAt: number; bytes: number }[],
  };
  private profile: NetworkProfile;
  constructor(profile: NetworkProfile) {
    this.profile = profile;
  }
  add(source: net.Socket, destination: net.Socket): Flow {
    const flow: Flow = {
      source,
      destination,
      queue: [],
      queuedBytes: 0,
      blocked: false,
      ended: false,
    };
    this.flows.add(flow);
    source.on('data', (bytes: Buffer) => {
      if (!this.flows.has(flow)) return;
      const receivedAt = performance.now();
      const jitter = [-1, 0, 1, 0][this.serial++ % 4] * this.profile.jitterMs;
      flow.queue.push({
        bytes,
        offset: 0,
        receivedAt,
        eligibleAt: receivedAt + Math.max(0, this.profile.rttMs / 2 + jitter),
      });
      flow.queuedBytes += bytes.length;
      this.counters.receivedBytes += bytes.length;
      this.counters.queuedBytes += bytes.length;
      this.counters.peakQueuedBytes = Math.max(
        this.counters.peakQueuedBytes,
        this.counters.queuedBytes,
      );
      this.counters.peakFlowQueuedBytes = Math.max(
        this.counters.peakFlowQueuedBytes,
        flow.queuedBytes,
      );
      if (flow.queuedBytes >= FLOW_BUFFER_BYTES && !source.isPaused()) {
        source.pause();
        this.counters.readPauses++;
      }
      this.arm();
    });
    source.on('end', () => {
      flow.ended = true;
      if (!flow.queue.length && !destination.destroyed) destination.end();
    });
    destination.on('drain', () => {
      flow.blocked = false;
      this.arm();
    });
    return flow;
  }
  remove(flow: Flow) {
    if (!this.flows.delete(flow)) return;
    this.counters.queuedBytes -= flow.queuedBytes;
    flow.queuedBytes = 0;
    flow.queue = [];
    this.arm();
  }
  private arm() {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (this.closed) return;
    let eligibleAt = Infinity;
    for (const f of this.flows)
      if (!f.blocked && f.queue[0]) eligibleAt = Math.min(eligibleAt, f.queue[0].eligibleAt);
    if (!Number.isFinite(eligibleAt)) return;
    const due = Math.max(eligibleAt, this.nextSendAt);
    this.timer = setTimeout(() => this.pump(), Math.max(0, due - performance.now()));
  }
  private pump() {
    this.timer = undefined;
    const now = performance.now();
    if (now < this.nextSendAt) {
      this.arm();
      return;
    }
    // Rotating eligible flows prevents one connection's large response starving another.
    for (const f of this.flows) {
      const head = f.queue[0];
      if (f.blocked || !head || head.eligibleAt > now) continue;
      if (f.destination.destroyed) {
        this.remove(f);
        break;
      }
      const packet = head.bytes.subarray(head.offset, head.offset + PACKET_BYTES);
      head.offset += packet.length;
      f.queuedBytes -= packet.length;
      this.counters.queuedBytes -= packet.length;
      this.counters.forwardedBytes += packet.length;
      this.counters.packets++;
      if (this.counters.trace.length < 32)
        this.counters.trace.push({
          receivedAt: head.receivedAt,
          eligibleAt: head.eligibleAt,
          forwardedAt: now,
          bytes: packet.length,
        });
      this.nextSendAt = now;
      if (!f.destination.write(packet)) {
        f.blocked = true;
        this.counters.writePauses++;
      }
      if (head.offset === head.bytes.length) f.queue.shift();
      if (f.queuedBytes < FLOW_BUFFER_BYTES / 2 && f.source.isPaused() && !f.ended)
        f.source.resume();
      if (!f.queue.length && f.ended) f.destination.end();
      this.flows.delete(f);
      this.flows.add(f);
      break;
    }
    this.arm();
  }
  get stats() {
    return {
      ...structuredClone(this.counters),
      flows: this.flows.size,
      timers: Number(!!this.timer),
    };
  }
  close() {
    this.closed = true;
    clearTimeout(this.timer);
    this.timer = undefined;
    for (const flow of [...this.flows]) this.remove(flow);
  }
}

/** Local shaped TCP, not OS packet loss emulation or physical network qualification. */
export async function tcpShaper(port: number, profile: NetworkProfile) {
  assert(Number.isFinite(profile.rttMs) && profile.rttMs >= 0);
  assert(Number.isFinite(profile.jitterMs) && profile.jitterMs >= 0);
  assert(Number.isFinite(profile.mbps) && profile.mbps > 0);
  const up = new Direction(profile),
    down = new Direction(profile);
  const pairs = new Set<{ client: net.Socket; upstream: net.Socket; close(): void }>();
  let opened = 0,
    closed = 0;
  const server = net.createServer({ allowHalfOpen: true }, (client) => {
    const upstream = net.connect({ host: '127.0.0.1', port, allowHalfOpen: true });
    const a = up.add(client, upstream),
      b = down.add(upstream, client);
    let disposed = false;
    const pair = {
      client,
      upstream,
      close() {
        if (disposed) return;
        disposed = true;
        up.remove(a);
        down.remove(b);
        pairs.delete(pair);
        closed++;
        client.destroy();
        upstream.destroy();
      },
    };
    pairs.add(pair);
    opened++;
    for (const socket of [client, upstream]) {
      socket.on('error', () => pair.close());
      socket.on('close', (failed) => {
        // A clean half-close can precede delivery of bytes held by the shaper.
        // Keep that FIFO until both streams drain; errors/cancellation discard it.
        if (
          failed ||
          !socket.readableEnded ||
          (a.ended && b.ended && !a.queue.length && !b.queue.length)
        )
          pair.close();
      });
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address === 'object');
  return {
    origin: `http://127.0.0.1:${address.port}`,
    port: address.port,
    get stats() {
      return {
        profile: { ...profile },
        packetBytes: PACKET_BYTES,
        flowBufferBytes: FLOW_BUFFER_BYTES,
        opened,
        closed,
        live: pairs.size,
        up: up.stats,
        down: down.stats,
      };
    },
    async close() {
      up.close();
      down.close();
      for (const pair of [...pairs]) pair.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
