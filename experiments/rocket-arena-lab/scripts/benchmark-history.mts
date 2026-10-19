import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { historyFixture, historyCommand } from '../client/tests/lab-history-fixture.js';

// Real server and prediction physics. Delay inputs 3 ticks and snapshots 3 ticks.
// Alternate update order; server physics time is excluded from client timings.
// Freeze the watchdog's clock during updates so both algorithms stay active.
// The fixture measures real CPU duration with hrtime; deployed budget stays 8 ms.
const baseline = await historyFixture(false, 2, 3, 3, true);
const optimized = await historyFixture(true, 2, 3, 3, true);
baseline.prime(); optimized.prime(); // World construction must not count as a transport stall.
const fixtures = [{ name: 'fullReplay', fixture: baseline, times: [] as number[] },
  { name: 'confirmedHistory', fixture: optimized, times: [] as number[] }];
try {
  for (let tick = 0; tick < 240; tick++) {
    const input = { ...historyCommand, steer: tick > 80 && tick < 130 ? .3 : 0,
      boostHeld: tick > 130 && tick < 170 };
    for (const item of tick % 2 ? [...fixtures].reverse() : fixtures) {
      const ms = item.fixture.tick(input);
      if (tick >= 60) item.times.push(ms);
    }
  }
  const result = Object.fromEntries(fixtures.map(({ name, fixture, times }) => {
    times.sort((a,b) => a-b);
    const stats = fixture.lab.getDebugState();
    assert.equal(stats.error, null);
    return [name, { updates: times.length, meanMs: times.reduce((a,b) => a+b,0)/times.length,
      medianMs: times[Math.floor(times.length/2)], p95Ms: times[Math.floor(times.length*.95)],
      confirmedSnapshots: stats.confirmedSnapshots, skippedReplaySteps: stats.skippedReplaySteps,
      totalReplaySteps: stats.totalReplaySteps, recoveries: stats.recoveries }];
  }));
  // Both send exactly the same controls to the authoritative simulators.
  assert.deepEqual(baseline.core.buildPredictionFrame(), optimized.core.buildPredictionFrame());
  console.log(JSON.stringify(result));
  if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(result,null,2)+'\n');
  assert.ok(result.confirmedHistory.confirmedSnapshots > 30);
} finally { baseline.dispose(); optimized.dispose(); }
