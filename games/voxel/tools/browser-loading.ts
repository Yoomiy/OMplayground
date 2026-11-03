/** A real browser must tolerate slow saved-room IO without restarting a valid join. */
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { createBuiltHarness, launchSoftwareBrowser } from './browser-harness.ts';
import { developmentAdmission } from './development-admission.ts';
import { MemoryCheckpoints } from '../tests/fixtures/checkpoint-storage.ts';
const backend = new MemoryCheckpoints(),
  acquire = backend.acquire.bind(backend);
let admissions = 0;
backend.acquire = async (room, owner) => {
  await delay(11000);
  return acquire(room, owner);
};
const harness = await createBuiltHarness(
  undefined,
  async () => {
    admissions++;
    return developmentAdmission({
      id: 'loading-player',
      role: 'participant',
      capabilities: { build: true, fly: true, observe: false, combat: true, explosives: true },
    });
  },
  undefined,
  undefined,
  { persistence: { objects: backend, metadata: backend } },
);
const browser = await launchSoftwareBrowser();
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  await page.goto(harness.origin + '/?room=slow-loading&quality=low');
  await page.waitForFunction(() => {
    const d = (window as any).voxel?.debug();
    return d?.phase === 'playing' && d.collisionColumns >= 9 && d.meshed >= 9;
  });
  assert.equal(admissions, 1);
  const loaded = harness.events.find((e) => e.event === 'VOXEL_ROOM_READY')!.context;
  assert.ok(Number(loaded.load_ms) >= 11000);
  assert.ok(Number(loaded.ownership_ms) >= 11000);
  const joined = harness.events.find((e) => e.event === 'VOXEL_ADMISSION_ACCEPTED')!.context;
  assert.equal(joined.actorId, 'loading-player');
  assert.equal(joined.role, 'participant');
  await page.evaluate(() => (window as any).voxel.dispose());
  for (
    let n = 0;
    n < 100 && !harness.events.some((e) => e.event === 'VOXEL_CONNECTION_CLOSED');
    n++
  )
    await delay(20);
  const left = harness.events.find((e) => e.event === 'VOXEL_CONNECTION_CLOSED')!.context;
  assert.equal(left.code, 1000);
  assert.equal(left.reason, 'client_left');
  assert.equal(left.actorId, joined.actorId);
  console.log(
    JSON.stringify({
      result: 'PASS',
      loadingBeyondTenSeconds: true,
      noReadmission: true,
      stageTimings: true,
      identifiedJoinAndDeparture: true,
      cleanExit: true,
    }),
  );
} finally {
  await browser.close();
  await harness.gateway.close();
}
