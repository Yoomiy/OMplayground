import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { cpus, availableParallelism } from 'node:os';
import { WebSocket } from 'ws';
import { setTimeout as delay } from 'node:timers/promises';
import { performance, monitorEventLoopDelay } from 'node:perf_hooks';
import { loadServerRelease } from '../../../apps/voxel-server/src/release.ts';
import { developmentAdmission } from './development-admission.ts';
import { around } from '../src/shared/protocol.ts';
import { decodeChunk } from '../src/shared/chunk-wire.ts';
const releaseRoot = process.env.VOXEL_BENCH_RELEASE_ROOT;
const runtime = await loadServerRelease(
    releaseRoot ? pathToFileURL(path.resolve(releaseRoot) + path.sep) : undefined,
  ),
  runId = randomUUID();
const profiles = (process.env.VOXEL_BENCH_LAYOUTS ?? '1x16,1x32,1x64,1x128,2x32,4x16')
  .split(',')
  .map((text) => {
    assert(/^\d+x\d+$/.test(text));
    const pair = text.split('x').map(Number);
    assert(pair.every((n) => Number.isSafeInteger(n) && n > 0));
    return pair;
  });
const seconds = Number(process.env.VOXEL_BENCH_SECONDS ?? 10);
assert(Number.isFinite(seconds) && seconds >= 1);
const destination = new URL('../test-results/survival-sockets.json', import.meta.url);
fs.mkdirSync(new URL('../test-results/', import.meta.url), { recursive: true });
const summary = (values) => {
  assert(values.length);
  values.sort((a, b) => a - b);
  return {
    samples: values.length,
    mean: values.reduce((a, b) => a + b, 0) / values.length,
    p95: values[Math.ceil(values.length * 0.95) - 1],
    p99: values[Math.ceil(values.length * 0.99) - 1],
    max: values.at(-1),
  };
};
const report = {
  result: 'RUNNING',
  startedAt: new Date().toISOString(),
  buildId: runtime.build.buildId,
  releaseRoot: releaseRoot ? path.resolve(releaseRoot) : 'current',
  host: {
    node: process.version,
    arch: process.arch,
    cpu: cpus()[0]?.model,
    logicalCpus: cpus().length,
    availableParallelism: availableParallelism(),
  },
  samplingSeconds: seconds,
  scope:
    'Packaged gateway/native room workers with co-located real loopback WebSocket load clients, development identity fixture, natural survival movement/turning/jumping. No hosted writes, school Auth/SQL/Storage, crafting/TNT, browser/SFU, physical devices, impairment or deployment-capacity qualification.',
  profiles: [],
};
for (const [rooms, playersPerRoom] of profiles) {
  let gateway, timer, row;
  const peers = [],
    metrics = [],
    errors = [];
  const lag = monitorEventLoopDelay({ resolution: 10 });
  lag.enable();
  try {
    gateway = await runtime.createGateway({
      build: runtime.build,
      content: runtime.content,
      worldDefaults: { mode: 'survival', seed: 4242 },
      admit: async (req) =>
        developmentAdmission({
          id: String(req.headers['x-load-actor']),
          role: 'participant',
          capabilities: { build: true, fly: false, observe: false, combat: true, explosives: true },
        }),
      onEvent(name, context) {
        if (name === 'VOXEL_ROOM_METRICS') {
          assert.equal(context.worldStep_samples, context.ticks);
          assert(context.windowMs > 0);
          for (const kind of [
            'worldStep',
            'observerStep',
            'workerTurn',
            'generationJob',
            'command',
          ]) {
            for (const measure of ['samples', 'meanMs', 'p95UpperMs', 'p99UpperMs', 'maxMs'])
              assert(
                Number.isFinite(context[`${kind}_${measure}`]) &&
                  context[`${kind}_${measure}`] >= 0,
              );
            assert(context[`${kind}_meanMs`] <= context[`${kind}_maxMs`]);
            assert(context[`${kind}_p95UpperMs`] <= context[`${kind}_p99UpperMs`]);
            assert(context[`${kind}_p99UpperMs`] <= context[`${kind}_maxMs`]);
          }
          metrics.push(context);
        } else if (/FAILED|FAULT|OVERFLOW/.test(name)) errors.push(name);
      },
    });
    const address = gateway.address;
    assert(address && typeof address === 'object');
    const origin = `http://127.0.0.1:${address.port}`;
    const admissionStart = performance.now();
    async function connect(room, id) {
      const started = performance.now(),
        response = await fetch(origin + '/api/voxel/admission', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-load-actor': id },
          body: JSON.stringify({ room }),
        });
      assert.equal(response.status, 200);
      const ticket = await response.json();
      const peer = {
        id,
        epoch: 0,
        sequence: 0,
        readySent: 0,
        sent: new Map(),
        acks: [],
        joinMs: 0,
        bytes: 0,
        messages: 0,
        snapshots: 0,
        resyncs: 0,
        latestTick: 0,
        firstTick: null,
        lastTick: null,
        sampling: false,
        stopping: false,
        unexpectedClose: false,
        columns: new Map(),
      };
      peers.push(peer);
      peer.socket = new WebSocket(origin.replace(/^http/, 'ws') + '/voxel');
      const ready = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('load client readiness timeout')), 60000);
        const maybeReady = () => {
          const b = peer.baseline;
          if (!b || b.phase !== 'preparing' || peer.readySent === b.epoch) return;
          const required = around(Math.floor(b.state[0] / 16), Math.floor(b.state[2] / 16), 1),
            columns = required.map((c) => ({
              ...c,
              revision: peer.columns.get(`${c.x},${c.z}`)?.revision,
            }));
          if (columns.some((c) => c.revision === undefined)) return;
          peer.readySent = b.epoch;
          peer.socket.send(JSON.stringify({ type: 'ready', epoch: b.epoch, columns }));
        };
        peer.socket.on('open', () =>
          peer.socket.send(
            JSON.stringify({ type: 'hello', ticket: ticket.ticket, buildId: ticket.buildId }),
          ),
        );
        peer.socket.on('error', () => {
          clearTimeout(timeout);
          reject(new Error('load socket error'));
        });
        peer.socket.on('close', () => {
          if (!peer.stopping) peer.unexpectedClose = true;
          clearTimeout(timeout);
          reject(new Error('load socket closed'));
        });
        peer.socket.on('message', (data, binary) => {
          if (peer.sampling) {
            peer.bytes += data.byteLength;
            peer.messages++;
          }
          if (binary) {
            const e = decodeChunk(new Uint8Array(data), runtime.content.blocks.length);
            assert(e);
            peer.columns.set(`${e.x},${e.z}`, e);
            maybeReady();
            return;
          }
          const e = JSON.parse(data.toString());
          if (e.type === 'error') {
            errors.push(e.code);
            return;
          }
          if (e.type === 'baseline') {
            if (e.epoch !== peer.epoch) {
              peer.epoch = e.epoch;
              peer.sequence = e.ack;
              peer.sent.clear();
            } else peer.sequence = Math.max(peer.sequence, e.ack);
            peer.baseline = e;
            if (e.reason === 'resync') peer.resyncs++;
            if (e.reason === 'ready' && e.phase === 'playing')
              peer.socket.send(JSON.stringify({ type: 'focus', epoch: e.epoch, active: true }));
            if (e.reason === 'focus' && e.state[12] === 0) {
              clearTimeout(timeout);
              peer.joinMs = performance.now() - started;
              resolve();
            }
            maybeReady();
          }
          if (e.type === 'snapshot') {
            peer.latestTick = e.tick;
            if (peer.sampling) {
              peer.snapshots++;
              peer.firstTick ??= e.tick;
              peer.lastTick = e.tick;
            }
            if (e.self) {
              const sent = peer.sent.get(e.self.ack);
              if (sent !== undefined && peer.sampling) peer.acks.push(performance.now() - sent);
              for (const n of peer.sent.keys()) if (n <= e.self.ack) peer.sent.delete(n);
            }
          }
        });
      });
      await ready;
    }
    await Promise.all(
      Array.from({ length: rooms }, (_, r) =>
        Array.from({ length: playersPerRoom }, (_, i) =>
          connect('load-' + r + '-' + runId, 'room' + r + '-actor' + i),
        ),
      ).flat(),
    );
    const joinedMs = performance.now() - admissionStart;
    const inputStart = performance.now();
    let batches = 0,
      lastOrdinal = -1,
      skippedInputBatches = 0;
    timer = setInterval(() => {
      const now = performance.now(),
        ordinal = Math.floor(((now - inputStart) * 30) / 1000);
      if (ordinal <= lastOrdinal) return;
      skippedInputBatches += Math.max(0, ordinal - lastOrdinal - 1);
      lastOrdinal = ordinal;
      const phase = Math.floor((now - inputStart) / 1000);
      for (const peer of peers)
        if (peer.socket.readyState === WebSocket.OPEN) {
          const sentAt = performance.now();
          const frames = [1, 2].map((n) => {
            const sequence = ++peer.sequence;
            peer.sent.set(sequence, sentAt);
            return {
              epoch: peer.epoch,
              sequence,
              x: 0,
              z: 0,
              yaw: Math.sin((now - inputStart) / 1000) * 0.4,
              pitch: 0.1,
              jump: phase % 2 === 0 && batches % 30 === 0 && n === 1,
              sneak: false,
              sprint: false,
            };
          });
          peer.socket.send(JSON.stringify({ type: 'input', frames }));
        }
      batches++;
    }, 4);
    await delay(3000);
    for (const peer of peers) peer.sampling = true;
    lag.reset();
    const firstBatch = batches;
    skippedInputBatches = 0;
    const samplingStart = performance.now();
    await delay(seconds * 1000);
    const elapsed = performance.now() - samplingStart;
    clearInterval(timer);
    timer = undefined;
    for (const peer of peers) peer.sampling = false;
    assert(peers.every((p) => p.acks.length > 0 && !p.unexpectedClose));
    assert.deepEqual(errors, []);
    row = {
      rooms,
      playersPerRoom,
      totalPlayers: peers.length,
      inputBatchHz: ((batches - firstBatch) * 1000) / elapsed,
      skippedInputBatches,
      joinedMs,
      joinMs: summary(peers.map((p) => p.joinMs)),
      sampleMs: elapsed,
      ackMs: summary(peers.flatMap((p) => p.acks)),
      tickRate: summary(peers.map((p) => (p.lastTick - p.firstTick) / (elapsed / 1000))),
      messages: peers.reduce((n, p) => n + p.messages, 0),
      wireBytes: peers.reduce((n, p) => n + p.bytes, 0),
      resyncs: peers.reduce((n, p) => n + p.resyncs, 0),
      gatewayEventLoopP99Ms: lag.percentile(99) / 1e6,
      roomMetrics: metrics,
    };
    report.profiles.push(row);
    console.log(JSON.stringify(row));
  } catch (error) {
    report.result = 'FAIL';
    report.failure = {
      rooms,
      playersPerRoom,
      message: error instanceof Error ? error.message : 'load failed',
    };
    throw error;
  } finally {
    if (timer) clearInterval(timer);
    const closing = peers.map(
      (peer) =>
        new Promise((resolve) => {
          peer.stopping = true;
          if (peer.socket.readyState === WebSocket.CLOSED) return resolve();
          peer.socket.once('close', resolve);
          peer.socket.terminate();
        }),
    );
    await gateway?.close();
    await Promise.all(closing);
    lag.disable();
    assert(!gateway || gateway.rooms.size === 0);
    assert(peers.every((p) => p.socket.readyState === WebSocket.CLOSED));
    if (row) row.cleanup = { rooms: gateway.rooms.size, closedClients: peers.length };
    fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
  }
}
report.result = 'LOOPBACK_SURVIVAL_LOAD_COMPLETED';
report.finishedAt = new Date().toISOString();
fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
