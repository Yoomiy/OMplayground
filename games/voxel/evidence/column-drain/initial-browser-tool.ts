import assert from 'node:assert/strict';
import fs from 'node:fs';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import { loadServerRelease } from '../../../apps/voxel-server/src/release.ts';
import { createBuiltHarness, launchSoftwareBrowser } from './browser-harness.ts';
import { developmentAdmission } from './development-admission.ts';
import { surfaceOwners } from './surface-mount-cycles.ts';
import { MemoryCheckpoints } from '../tests/fixtures/checkpoint-storage.ts';
import { editedCheckpoint } from '../tests/fixtures/edited-checkpoint.ts';
import { tcpGate } from '../tests/fixtures/tcp-gate.ts';
const runtime = await loadServerRelease(),
  backend = new MemoryCheckpoints(),
  room = randomUUID(),
  id = randomUUID(),
  observer = randomUUID();
const actor = (key: string) => ({
  id: key,
  role: key === observer ? ('observer' as const) : ('participant' as const),
  capabilities: {
    build: key !== observer,
    fly: true,
    observe: key === observer,
    combat: key !== observer,
    explosives: key !== observer,
  },
});
const seed = await editedCheckpoint(backend, room, runtime.content, runtime.build);
const { gateway, origin, events } = await createBuiltHarness(
  undefined,
  async (req, body) =>
    body.room === room
      ? developmentAdmission(actor(req.headers['x-test-actor'] === observer ? observer : id))
      : null,
  undefined,
  undefined,
  {
    factory: runtime.createGateway,
    persistence: {
      objects: backend,
      metadata: backend,
      resolveOwner: async (_room, key) => (key === id || key === observer ? actor(key) : null),
    },
  },
);
const address = gateway.address;
assert(address && typeof address === 'object');
const relay = await tcpGate(address.port),
  proxyOrigin = relay.url.replace('ws:', 'http:').replace(/\/voxel$/, '');
const browser = await launchSoftwareBrowser(),
  errors: string[] = [],
  report: Record<string, any> = {
    result: 'RUNNING',
    buildId: runtime.build.buildId,
    seed,
    startedAt: new Date().toISOString(),
    scope:
      'Unchanged built client/release Wasm and packaged gateway/native workers, prepared 4.8 MB edited checkpoint, actual loopback TCP read suspension. Fixture admission and in-memory persistence contracts; software Chromium, no hosted/school-device/network performance qualification.',
  };
let keeper: WebSocket | undefined,
  coldTimer: ReturnType<typeof setTimeout> | undefined,
  phase = 'cold-join';
const deadline = setTimeout(() => void browser.close(), 180000);
try {
  const context = await browser.newContext({
    viewport: { width: 640, height: 480 },
    hasTouch: true,
    isMobile: true,
  });
  await context.addInitScript(() =>
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 2, configurable: true }),
  );
  const page = await context.newPage(),
    owners = surfaceOwners(page);
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (e) => {
    if (e.type() === 'error') errors.push(e.text());
  });
  let heldCold = false,
    coldStarted = 0,
    coldEnded = 0;
  page.on('websocket', (socket) =>
    socket.on('framesent', (frame) => {
      if (typeof frame.payload !== 'string' || heldCold) return;
      const message = JSON.parse(frame.payload);
      if (message.type === 'hello') {
        heldCold = true;
        coldStarted = performance.now();
        relay.hold();
        coldTimer = setTimeout(() => {
          coldEnded = performance.now();
          relay.release();
        }, 1000);
      }
    }),
  );
  const debug = () => page.evaluate(() => (window as any).voxel.debug());
  const command = (value: unknown) => page.evaluate((c) => (window as any).voxel.command(c), value);
  const ready = () =>
    page.waitForFunction(
      () => {
        const d = (window as any).voxel?.debug();
        return (
          d?.phase === 'playing' &&
          d.columns === 49 &&
          d.collisionColumns === 49 &&
          d.meshed >= 25 &&
          d.activeJobs === 0
        );
      },
      null,
      { timeout: 90000 },
    );
  const began = performance.now();
  await page.goto(`${proxyOrigin}/?room=${room}&quality=low`, { waitUntil: 'domcontentloaded' });
  await ready();
  assert(heldCold && coldEnded - coldStarted >= 990);
  await page.locator('#resume').tap();
  await page.waitForFunction(() => (window as any).voxel.debug().body.frozen === 0);
  await command({ type: 'flight' });
  await page.waitForFunction(() => (window as any).voxel.debug().body.flying === 1);
  const initial = await debug();
  assert.equal(initial.worldId, seed.worldId);
  assert.equal(initial.actorId, id);
  report.cold = {
    elapsedMs: performance.now() - began,
    tcpHeldMs: coldEnded - coldStarted,
    columns: initial.columns,
    collisionColumns: initial.collisionColumns,
    meshed: initial.meshed,
    owners: owners(),
  };
  // Keep an independently admitted hidden connection while the browser reconnects,
  // so this scenario isolates client streaming rather than last-player retirement.
  const admission = await fetch(origin + '/api/voxel/admission', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test-actor': observer },
    body: JSON.stringify({ room }),
  });
  assert.equal(admission.status, 200);
  const ticket = await admission.json();
  keeper = new WebSocket(origin.replace('http:', 'ws:') + '/voxel');
  keeper.on('error', () => {});
  await once(keeper, 'open');
  const welcomed = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('keeper welcome timeout')), 10000);
    keeper!.once('close', () => {
      clearTimeout(timer);
      reject(new Error('keeper closed before welcome'));
    });
    keeper!.on('message', (bytes, binary) => {
      if (!binary && JSON.parse(bytes.toString()).type === 'welcome') {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  keeper.send(JSON.stringify({ type: 'hello', ...ticket }));
  await welcomed;
  phase = 'five-second-stall';
  relay.hold();
  const heldAt = performance.now();
  await command({ type: 'touch', x: 1, z: 0, jump: false, sneak: false, sprint: false });
  await page.waitForFunction(() => (window as any).voxel.debug().status === 'stalled', null, {
    timeout: 5000,
  });
  const stalled = await debug();
  await command({ type: 'touch', x: 0, z: 0, jump: false, sneak: false, sprint: false });
  await page.waitForTimeout(Math.max(0, 5000 - (performance.now() - heldAt)));
  const late = await debug();
  assert(late.lastReceivedAgoMs > 4000);
  assert(
    Math.hypot(...late.position.map((v: number, i: number) => v - stalled.position[i])) < 0.05,
    'stalled client cannot keep predicting movement',
  );
  assert.equal(
    await page.evaluate(() => (window as any).voxel.voiceScene()),
    null,
    'stale world has no voice spatial scene',
  );
  relay.release();
  await page.waitForFunction(() => {
    const d = (window as any).voxel.debug();
    return d.status === 'playing' && d.lastReceivedAgoMs < 1000;
  });
  const recovered = await debug();
  report.stall = {
    heldMs: performance.now() - heldAt,
    stalePosition: stalled.position,
    latePosition: late.position,
    inputLagWhenStalled: stalled.inputLag,
    inputLagLate: late.inputLag,
    recoveredInputLag: recovered.inputLag,
    correction: recovered.correction,
  };
  phase = 'reconnect';
  const before = await debug();
  await command({ type: 'reconnect' });
  await page.waitForFunction(
    (epoch) => {
      const d = (window as any).voxel.debug();
      return d.epoch > epoch && d.phase === 'playing';
    },
    before.epoch,
    { timeout: 60000 },
  );
  await ready();
  await page.locator('#resume').tap();
  await page.waitForFunction(() => (window as any).voxel.debug().body.frozen === 0);
  const again = await debug();
  assert.equal(again.worldId, before.worldId);
  assert.equal(again.actorId, before.actorId);
  assert(again.epoch > before.epoch);
  report.reconnect = {
    oldEpoch: before.epoch,
    newEpoch: again.epoch,
    columns: again.columns,
    collisionColumns: again.collisionColumns,
    meshed: again.meshed,
    owners: owners(),
  };
  phase = 'dispose';
  await page.evaluate(() => (window as any).voxel.dispose());
  await page.waitForFunction(() => {
    const d = (window as any).voxel.debug();
    return d.disposed && d.audio.state === 'closed' && d.resources.workers === 0;
  });
  const until = performance.now() + 10000;
  while (performance.now() < until) {
    const o = owners();
    if (
      !o.liveWorkers &&
      o.openedSockets === o.closedSockets &&
      o.createdWorkers === o.closedWorkers
    )
      break;
    await page.waitForTimeout(50);
  }
  const closed = await debug(),
    o = owners();
  assert.deepEqual(closed.resources, { geometries: 0, textures: 0, workers: 0 });
  assert.equal(o.liveWorkers, 0);
  assert.equal(o.openedSockets, o.closedSockets);
  assert.equal(o.createdWorkers, o.closedWorkers);
  assert(!events.some((e) => /BACKPRESSURE|FAILED|FAULT/.test(e.event)), JSON.stringify(events));
  assert.deepEqual(errors, []);
  report.cleanup = { resources: closed.resources, audio: closed.audio.state, owners: o };
  report.result = 'BROWSER_EDITED_WORLD_TCP_STALL_AND_RECONNECT_PASS';
  await context.close();
} catch (e) {
  report.result = 'FAIL';
  report.failure = {
    phase,
    message: e instanceof Error ? e.message : String(e),
    stack: e instanceof Error ? e.stack : undefined,
  };
  throw e;
} finally {
  clearTimeout(deadline);
  if (coldTimer) clearTimeout(coldTimer);
  relay.release();
  keeper?.terminate();
  await browser.close();
  await relay.close();
  await gateway.close();
  Object.assign(report, {
    finishedAt: new Date().toISOString(),
    errors,
    events,
    remainingRooms: gateway.rooms.size,
  });
  fs.mkdirSync(new URL('../test-results/', import.meta.url), { recursive: true });
  fs.writeFileSync(
    new URL('../test-results/browser-edited-join.json', import.meta.url),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      result: report.result,
      failure: report.failure,
      cold: report.cold,
      cleanup: report.cleanup,
    }),
  );
}
