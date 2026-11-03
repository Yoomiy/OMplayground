/** Real rendered runtime and game sockets; only transport/admission failures are injected. */
import assert from 'node:assert/strict';
import { createBuiltHarness, launchSoftwareBrowser } from './browser-harness.ts';
import { developmentAdmission } from './development-admission.ts';
let admissions = 0,
  failThrough = 2;
const harness = await createBuiltHarness(undefined, async (_req, _body, res) => {
  admissions++;
  if (admissions <= failThrough) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'SCHOOL_POLICY_UNAVAILABLE' }));
    return null;
  }
  return developmentAdmission({
    id: 'recovery-player',
    role: 'participant',
    capabilities: { build: true, fly: true, observe: false, combat: true, explosives: true },
  });
});
const browser = await launchSoftwareBrowser();
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  await page.goto(harness.origin + '/?room=connection-recovery&quality=low', {
    waitUntil: 'domcontentloaded',
  });
  const ready = () =>
    page.waitForFunction(() => {
      const d = (window as any).voxel?.debug();
      return (
        d?.phase === 'playing' &&
        d.collisionColumns >= 9 &&
        d.meshed >= 9 &&
        !['error', 'recovering', 'stalled', 'connecting'].includes(d.status)
      );
    });
  await ready();
  assert.equal(admissions, 3);
  const before = await page.evaluate(() => (window as any).voxel.debug().epoch);
  for (const socket of harness.gateway.sockets.clients) {
    socket.send = (() => {}) as typeof socket.send;
  }
  await page.waitForFunction(() => (window as any).voxel?.debug().status === 'stalled');
  await page.waitForFunction((epoch) => (window as any).voxel?.debug().epoch > epoch, before);
  await ready();
  assert.equal(admissions, 4);
  failThrough = admissions + 2;
  for (const socket of harness.gateway.sockets.clients) socket.terminate();
  await new Promise<void>((resolve, reject) => {
    const until = Date.now() + 20000;
    const check = setInterval(() => {
      if (admissions >= failThrough) {
        clearInterval(check);
        resolve();
      } else if (Date.now() > until) {
        clearInterval(check);
        reject(new Error('Automatic admission retries stopped'));
      }
    }, 50);
  });
  failThrough = 0;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await ready();
  assert.equal(admissions, 7);
  for (const socket of harness.gateway.sockets.clients) {
    socket.send(JSON.stringify({ type: 'error', code: 'RECESS_CLOSED', retryable: false }));
    socket.close();
  }
  await page.waitForFunction(() => (window as any).voxel?.debug().status === 'error');
  const atCutoff = admissions;
  await page.waitForTimeout(2000);
  assert.equal(admissions, atCutoff);
  failThrough = Number.MAX_SAFE_INTEGER;
  await page.evaluate(() => (window as any).voxel.command({ type: 'reconnect' }));
  await page.waitForFunction(() => (window as any).voxel?.debug().status === 'recovering');
  const beforeDispose = admissions;
  await page.evaluate(() => (window as any).voxel.dispose());
  await page.waitForTimeout(1700);
  assert.equal(admissions, beforeDispose);
  const cleanup = await page.evaluate(() => (window as any).voxel.debug());
  assert.deepEqual(cleanup.resources, { geometries: 0, textures: 0, workers: 0 });
  console.log(
    JSON.stringify({
      result: 'PASS',
      initialAdmissionRetries: true,
      silentSocketReplaced: true,
      outageAdmissionRetries: true,
      onlineRecovery: true,
      recessDenialStopsRetries: true,
      disposedRetryCancelled: true,
    }),
  );
} finally {
  await browser.close();
  await harness.gateway.close();
}
