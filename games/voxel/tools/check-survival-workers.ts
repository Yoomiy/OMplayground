import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Validate the full report, including work after recovery, rather than trusting
 * its PASS label. Does not replace the live checkpoint-conservation assertions.
 */
const file =
  process.argv[2] ??
  fileURLToPath(new URL('../test-results/survival-workers.json', import.meta.url));
const r = JSON.parse(fs.readFileSync(file, 'utf8'));
assert.equal(r.result, 'PACKAGED_SUSTAINED_SURVIVAL_AND_COMMITTED_CRASH_RECOVERY_PASS');
const { seconds, roomCount, playerCount } = r.configuration;
const actors = roomCount * playerCount;
assert(r.sample.elapsedMs >= seconds * 1000);
assert.equal(r.sample.elapsedMs, r.sample.endedAtMs - r.sample.startedAtMs);
assert(r.counts.rounds > 0);
assert.equal(r.counts.mined, r.counts.rounds * actors);
assert.equal(r.counts.placed, r.counts.mined);
// One craft per actor per round, plus one per room after recovery. Exhausted
// fixture kits must fail qualification rather than silently reducing the scene.
assert.equal(r.counts.crafted, r.counts.rounds * actors + roomCount);
assert.equal(r.counts.containerRaces, (r.counts.rounds * actors) / 2);
assert.equal(r.counts.containerConflicts, r.counts.containerRaces);
assert.equal(r.counts.cachedReplays, r.counts.crafted + r.counts.containerRaces);
assert.equal(r.counts.staleEpochReplays, actors);
assert(r.counts.consumed > 0 && r.counts.hits > 0);
assert.equal(r.counts.skippedInputBatches, 0);
assert.equal(r.events.length, roomCount);
for (const e of r.events) {
  assert.equal(e.name, 'VOXEL_ROOM_FAILED');
  assert.equal(e.context.connections, playerCount);
  assert.equal(e.context.buildId, r.buildId);
}
assert.equal(r.rooms.length, roomCount);
assert.equal(new Set(r.rooms.map((g: { worldId: string }) => g.worldId)).size, roomCount);
for (const g of r.rooms) {
  assert(g.ownerEpoch >= 3);
  assert(g.maxDurableLagSeconds <= 30);
  if (seconds >= 30) assert(g.readbackChecks >= Math.floor(seconds / 15) - 1);
}
assert.equal(r.peers.length, actors * 2);
const identities = new Map<string, number>();
for (const p of r.peers) {
  assert.match(p.id, /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/);
  identities.set(p.id, (identities.get(p.id) ?? 0) + 1);
  assert(p.retainedEvents <= 256 && p.retainedHighWater <= 256);
  assert.equal(p.pendingWaiters, 0);
  assert.equal(p.resyncs, 0);
  assert.equal(p.lostAckSamples, 0);
}
assert.equal(identities.size, actors);
assert([...identities.values()].every((n) => n === 2));
assert.deepEqual(r.cleanup, {
  rooms: 0,
  closedClients: actors * 2,
  totalClients: actors * 2,
  pendingWaiters: 0,
});
const steady = r.roomMetrics.filter(
  (m: Record<string, number>) =>
    m.windowStartedAtMs >= r.sample.startedAtMs && m.windowEndedAtMs <= r.sample.endedAtMs,
);
assert.deepEqual(r.steadyRoomMetrics, steady);
if (seconds >= 25)
  assert.equal(new Set(steady.map((m: { worldId: string }) => m.worldId)).size, roomCount);
for (const m of r.roomMetrics) {
  assert.equal(m.buildId, r.buildId);
  assert.equal(m.worldStep_samples, m.ticks);
  assert.equal(m.windowMs, m.windowEndedAtMs - m.windowStartedAtMs);
  assert(m.windowMs > 0);
  assert.equal(m.overrunMs, 0);
}
for (const m of steady) assert((m.ticks * 1000) / m.windowMs >= 29, 'sustained world cadence');
console.log(
  JSON.stringify({
    result: 'SURVIVAL_WORKER_REPORT_AUDIT_PASS',
    file,
    buildId: r.buildId,
    actors,
    rounds: r.counts.rounds,
    containedWindows: steady.length,
    maxDurableLagSeconds: Math.max(
      ...r.rooms.map((g: { maxDurableLagSeconds: number }) => g.maxDurableLagSeconds),
    ),
  }),
);
