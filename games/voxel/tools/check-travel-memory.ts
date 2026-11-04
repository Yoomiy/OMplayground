import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const file =
  process.argv[2] ??
  fileURLToPath(new URL('../test-results/browser-travel-memory.json', import.meta.url));
const r = JSON.parse(fs.readFileSync(file, 'utf8'));
assert.equal(r.result, 'BROWSER_TRAVEL_RECONNECT_RESOURCE_MEASUREMENTS_COMPLETE');
assert.deepEqual(r.errors, []);
assert.equal(r.remainingRooms, 0);
const cycles = r.configuration.cycles;
assert(Number.isSafeInteger(cycles) && cycles >= 2);
assert.equal(r.samples.length, 2 * cycles + 2);
const initial = r.samples[0],
  disposed = r.samples.at(-1);
assert.equal(initial.label, 'initial');
assert.equal(disposed.label, 'disposed');
let travelReference: any, reconnectReference: any;
for (let i = 0; i < cycles; i++) {
  const travel = r.samples[1 + i * 2],
    connected = r.samples[2 + i * 2];
  assert.equal(travel.label, `travel-${i}`);
  assert.equal(connected.label, `reconnect-${i}`);
  travelReference ??= travel;
  reconnectReference ??= connected;
  for (const [s, reference] of [
    [travel, travelReference],
    [connected, reconnectReference],
  ]) {
    assert.equal(s.columns, 49);
    assert.equal(s.collisionColumns, 49);
    assert.equal(s.resources.workers, 1);
    assert.equal(s.liveWorkers, 1);
    assert.equal(s.openedSockets - s.closedSockets, 1);
    assert.equal(s.createdWorkers - s.closedWorkers, 1);
    assert(s.render.triangles > 1000, 'terrain must actually be drawn');
    assert(s.memory.gpuBuffers.created > initial.memory.gpuBuffers.created);
    assert(s.memory.gpuBuffers.bytes > 200000);
    assert.equal(
      s.memory.gpuBuffers.created - s.memory.gpuBuffers.deleted,
      s.memory.gpuBuffers.live,
    );
    assert.deepEqual(s.resources, reference.resources, 'settled resource-count plateau');
    assert.equal(s.renderedColumns, reference.renderedColumns, 'settled mesh-column plateau');
    assert.equal(
      s.memory.gpuBuffers.live,
      reference.memory.gpuBuffers.live,
      'settled buffer-count plateau',
    );
    assert.equal(
      s.memory.gpuBuffers.bytes,
      reference.memory.gpuBuffers.bytes,
      'settled GPU-byte plateau',
    );
    assert.deepEqual(
      s.memory.wasm,
      travelReference.memory.wasm,
      'main Wasm high-water settles after first traversal',
    );
    assert.equal(s.memory.wasm.length, 1);
    assert(s.memory.wasm[0] > 0);
  }
  assert.equal(travel.stream.installed, travelReference.stream.installed);
  assert.equal(connected.stream.installed, 49);
  assert(travel.stream.installed > 49, 'traversal must generate new columns');
  assert(connected.epoch > travel.epoch, 'reconnect must retire the old epoch');
}
assert.equal(disposed.memory.gpuBuffers.created, disposed.memory.gpuBuffers.deleted);
assert.equal(disposed.memory.gpuBuffers.bytes, 0);
assert.equal(disposed.memory.gpuBuffers.live, 0);
assert.deepEqual(disposed.resources, { geometries: 0, textures: 0, workers: 0 });
assert.equal(disposed.openedSockets, cycles + 1);
assert.equal(disposed.closedSockets, cycles + 1);
assert.equal(disposed.createdWorkers, cycles + 1);
assert.equal(disposed.closedWorkers, cycles + 1);
assert.equal(disposed.liveWorkers, 0);
assert.equal(disposed.renderedColumns, 0);
assert(
  !r.gatewayEvents.some((e: { event: string }) => /FAILED|FAULT|RECOVER|OVERFLOW/.test(e.event)),
);
const connected = r.samples.filter((s: { label: string }) => s.label.startsWith('reconnect-'));
console.log(
  JSON.stringify({
    result: 'BROWSER_TRAVEL_RECONNECT_OWNED_RESOURCE_PLATEAU_PASS',
    file,
    buildId: r.buildId,
    cycles,
    gpuBytes: {
      travel: travelReference.memory.gpuBuffers.bytes,
      reconnect: reconnectReference.memory.gpuBuffers.bytes,
      disposed: 0,
    },
    mainWasmHighWaterBytes: travelReference.memory.wasm[0],
    postGcMainHeapRangeBytes: [
      Math.min(...connected.map((s: any) => s.heap.usedSize)),
      Math.max(...connected.map((s: any) => s.heap.usedSize)),
    ],
    scope:
      'Exact settled GPU buffer/resource/column counts and main Wasm high-water, plus complete worker/socket teardown. Heap values are observations, not a whole-process or worker-heap leak verdict. Software Chromium; no hardware performance signoff.',
  }),
);
