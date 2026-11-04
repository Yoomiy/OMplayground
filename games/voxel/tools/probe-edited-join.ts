import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { loadServerRelease } from '../../../apps/voxel-server/src/release.ts';
import { initSync, set_content, VoxelWorld, TerrainGen } from '../engine/pkg/voxel_engine.js';
import { WorldStore } from '../src/sim/world-store.ts';
import { GameRoom } from '../src/sim/game-room.ts';
import { around, STREAM_RADIUS, parseServerMessage } from '../src/shared/protocol.ts';
import { decodeChunk } from '../src/shared/chunk-wire.ts';
import { MemoryCheckpoints } from '../tests/fixtures/checkpoint-storage.ts';
import { CheckpointStorage } from '../src/server/checkpoint-storage.ts';
import { developmentAdmission } from './development-admission.ts';

const runtime = await loadServerRelease(),
  { build, content } = runtime;
initSync({ module: fs.readFileSync(new URL('../dist-server/engine.wasm', import.meta.url)) });
set_content(JSON.stringify(content));
const entries = Number(process.env.VOXEL_JOIN_EDITS ?? 16384);
assert(Number.isSafeInteger(entries) && entries > 0 && entries <= 16384);
const backend = new MemoryCheckpoints(),
  roomId = randomUUID(),
  actorId = randomUUID();
const lease = (await backend.acquire(roomId, 'edited-fixture'))!;
const store = new WorldStore(new VoxelWorld(), new TerrainGen(4242));
const seed = new GameRoom(
  store,
  content,
  build,
  { send() {}, close() {} },
  lease.worldId,
  4242,
  0,
  0,
);
const base = seed.checkpoint(0),
  center = { x: Math.floor(base.spawn[0] / 16), z: Math.floor(base.spawn[2] / 16) };
for (const c of around(center.x, center.z, STREAM_RADIUS)) {
  const edits = new Map<number, number>(),
    versions = new Map<number, number>();
  for (let n = 0; n < entries; n++) {
    edits.set(256 + n, 0);
    versions.set(256 + n, n + 1);
  }
  store.changed.set(`${c.x},${c.z}`, { revision: entries, edits, versions });
}
const checkpoint = seed.checkpoint(0);
await new CheckpointStorage(lease.worldId, backend, backend, content, build).save(
  lease,
  1,
  checkpoint,
);
await backend.release(lease);
seed.dispose();
const events: Record<string, unknown>[] = [];
const gateway = await runtime.createGateway({
  build,
  content,
  persistence: { objects: backend, metadata: backend },
  admit: async () =>
    developmentAdmission({
      id: actorId,
      role: 'participant',
      capabilities: { build: true, fly: true, observe: false, combat: true, explosives: true },
    }),
  onEvent(name, context) {
    if (/BACKPRESSURE|FAILED|FAULT/.test(name)) events.push({ name, ...context });
  },
});
const address = gateway.address;
assert(address && typeof address === 'object');
let upstream: net.Socket | undefined, downstream: net.Socket | undefined;
let bytesFromServer = 0,
  held = false;
const proxy = net.createServer((client) => {
  downstream = client;
  upstream = net.connect({ host: '127.0.0.1', port: address.port });
  client.on('error', () => upstream?.destroy());
  upstream.on('error', () => client.destroy());
  client.on('close', () => upstream?.destroy());
  upstream.on('close', () => client.destroy());
  upstream.on('data', (b) => (bytesFromServer += b.byteLength));
  client.pipe(upstream);
  upstream.pipe(client);
});
proxy.listen(0, '127.0.0.1');
await once(proxy, 'listening');
const proxyAddress = proxy.address();
assert(proxyAddress && typeof proxyAddress === 'object');
let peer: WebSocket | undefined;
let binaryFrames = 0,
  decodedEdits = 0,
  invalidFrames = 0,
  closeCode: number | undefined;
const report: Record<string, unknown> = {
  buildId: build.buildId,
  entriesPerColumn: entries,
  columns: checkpoint.world.columns.length,
  expectedBaselineBytes: 49 * (24 + entries * 6),
  scope:
    'Prepared valid edited checkpoint, packaged gateway/native worker and ordinary admission over a loopback TCP relay. Relay pauses upstream reads, no bufferedAmount override. In-memory persistence contracts, no hosted writes or school-network qualification.',
};
try {
  const response = await fetch(`http://127.0.0.1:${address.port}/api/voxel/admission`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room: roomId }),
  });
  assert.equal(response.status, 200);
  const ticket = await response.json();
  peer = new WebSocket(`ws://127.0.0.1:${proxyAddress.port}/voxel`);
  peer.on('error', () => {});
  peer.on('close', (code) => (closeCode = code));
  peer.on('message', (data, binary) => {
    if (binary) {
      const frame = decodeChunk(new Uint8Array(data as Buffer), content.blocks.length);
      if (!frame) invalidFrames++;
      else {
        binaryFrames++;
        decodedEdits += frame.edits.length;
      }
    } else if (!parseServerMessage(data.toString())) invalidFrames++;
  });
  await once(peer, 'open');
  assert(upstream && downstream);
  upstream.unpipe(downstream);
  upstream.pause();
  held = true;
  peer.send(JSON.stringify({ type: 'hello', ...ticket }));
  const started = performance.now();
  while (
    performance.now() - started < 5000 &&
    !events.some((e) => e.name === 'VOXEL_BACKPRESSURE_RECOVERY')
  )
    await delay(20);
  report.heldMs = performance.now() - started;
  upstream.pipe(downstream);
  upstream.resume();
  held = false;
  const end = performance.now() + 10000;
  while (performance.now() < end && closeCode === undefined && binaryFrames < 49) await delay(20);
  report.result =
    binaryFrames === 49 ? 'EDITED_BASELINE_DELIVERED' : 'EDITED_BASELINE_NOT_DELIVERED';
} finally {
  if (held && upstream && downstream) {
    upstream.pipe(downstream);
    upstream.resume();
  }
  peer?.terminate();
  upstream?.destroy();
  downstream?.destroy();
  await new Promise<void>((r) => proxy.close(() => r()));
  await gateway.close();
  Object.assign(report, {
    binaryFrames,
    decodedEdits,
    invalidFrames,
    closeCode,
    bytesFromServer,
    events,
    remainingRooms: gateway.rooms.size,
  });
  fs.mkdirSync(new URL('../test-results/', import.meta.url), { recursive: true });
  fs.writeFileSync(
    new URL('../test-results/edited-join.json', import.meta.url),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report));
}
