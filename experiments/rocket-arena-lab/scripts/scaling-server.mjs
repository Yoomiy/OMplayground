// Isolated benchmark host. Imports the published backend; wrappers observe the
// original callbacks and return their unmodified results. No production endpoint.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import http from 'node:http';
import { monitorEventLoopDelay } from 'node:perf_hooks';

const release = process.env.SCALING_RELEASE_ROOT;
if (!release) throw new Error('SCALING_RELEASE_ROOT must identify a built release');
const require = createRequire(`${release}/package.json`);
const { Server } = require('colyseus');
const { WebSocketTransport } = require('@colyseus/ws-transport');
const { CustomRoom } = await import(pathToFileURL(`${release}/server/dist/rooms/custom-room.js`).href);
const { AuthoritativeRoomCore } = await import(pathToFileURL(`${release}/server/dist/rooms/authoritative-room-core.js`).href);
const loop = monitorEventLoopDelay({ resolution: 10 }); loop.enable();
let enabled = false, metrics = {}, started = 0, cpuStart;
const reset = () => {
  metrics = { coreMs: [], callbackMs: [], callbackDeltaMs: [], executedSteps: 0,
    droppedTimeMs: 0, contactSamples: 0, carBallContactSamples: 0, carCarContactSamples: 0 };
  started = performance.now(); cpuStart = process.cpuUsage(); loop.reset(); enabled = true;
};
const distribution = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return { count: sorted.length, mean: sorted.reduce((a, b) => a + b, 0) / (sorted.length || 1),
    p50: sorted[Math.floor(sorted.length * .5)] ?? 0,
    p95: sorted[Math.floor(sorted.length * .95)] ?? 0, max: sorted.at(-1) ?? 0 };
};
function sampleContacts(bundle) {
  if (!bundle?.carsBySessionId) return;
  const carColliders = new Map();
  for (const [id, car] of bundle.carsBySessionId) {
    for (let i = 0; i < car.body.numColliders(); i++) carColliders.set(car.body.collider(i).handle, id);
  }
  const ball = new Set();
  for (let i = 0; i < bundle.ball.numColliders(); i++) ball.add(bundle.ball.collider(i).handle);
  const pairs = new Set(), ballPairs = new Set();
  for (const [handle, id] of carColliders) {
    const collider = bundle.world.getCollider(handle);
    bundle.world.contactPairsWith(collider, other => {
      const otherId = carColliders.get(other.handle);
      if (!ball.has(other.handle) && (!otherId || otherId === id)) return;
      let touching = false;
      bundle.world.contactPair(collider, other, manifold => { if (manifold.numContacts() > 0) touching = true; });
      if (!touching) return;
      if (ball.has(other.handle)) ballPairs.add(id);
      else pairs.add([id, otherId].sort().join(':'));
    });
  }
  metrics.contactSamples++;
  metrics.carCarContactSamples += pairs.size;
  metrics.carBallContactSamples += ballPairs.size;
}
const advance = AuthoritativeRoomCore.prototype.advanceSimulation;
AuthoritativeRoomCore.prototype.advanceSimulation = function(...args) {
  const before = performance.now(), result = advance.apply(this, args);
  if (enabled) {
    metrics.coreMs.push(performance.now() - before);
    metrics.executedSteps += result.executedFixedSteps;
    metrics.droppedTimeMs += result.droppedTimeMs;
    if (metrics.coreMs.length % 4 === 0) sampleContacts(this.worldBundle);
  }
  return result;
};
const callback = CustomRoom.prototype.advanceSimulation;
CustomRoom.prototype.advanceSimulation = function(delta) {
  const before = performance.now(), result = callback.call(this, delta);
  if (enabled) { metrics.callbackMs.push(performance.now() - before); metrics.callbackDeltaMs.push(delta); }
  return result;
};
const server = new Server({ transport: new WebSocketTransport({ server: http.createServer() }) });
server.define('custom', CustomRoom);
await server.listen(Number(process.env.SCALING_PORT ?? 19004), '127.0.0.1');
process.send?.({ kind: 'ready', pid: process.pid });
process.on('message', message => {
  if (message.kind === 'measure') { reset(); process.send?.({ kind: 'measuring', id: message.id }); }
  if (message.kind === 'metrics') {
    enabled = false;
    const seconds = (performance.now() - started) / 1000, cpu = process.cpuUsage(cpuStart);
    process.send?.({ kind: 'metrics', id: message.id, value: {
      seconds, coreMs: distribution(metrics.coreMs), callbackMs: distribution(metrics.callbackMs),
      callbackDeltaMs: distribution(metrics.callbackDeltaMs),
      callbacksOver16ms: metrics.callbackMs.filter(ms => ms > 1000 / 60).length,
      executedSteps: metrics.executedSteps, effectiveSimulationHz: metrics.executedSteps / seconds,
      droppedTimeMs: metrics.droppedTimeMs, eventLoopP95Ms: loop.percentile(95) / 1e6,
      cpuPercentOfOneCore: (cpu.user + cpu.system) / 1e6 / seconds * 100,
      rssMiB: process.memoryUsage().rss / 1024 ** 2,
      contactSamples: metrics.contactSamples, carBallContactSamples: metrics.carBallContactSamples,
      carCarContactSamples: metrics.carCarContactSamples,
    } });
  }
});
process.on('disconnect', () => { void server.gracefullyShutdown().finally(() => process.exit()); });
