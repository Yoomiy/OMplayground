import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { cpus, availableParallelism } from 'node:os';
import { loadServerRelease } from '../../../apps/voxel-server/src/release.ts';
import { createBuiltHarness, launchSoftwareBrowser } from './browser-harness.ts';
import { surfaceOwners } from './surface-mount-cycles.ts';
import { tcpGate } from '../tests/fixtures/tcp-gate.ts';
type Authority = { epoch: number; ack: number; tick: number; position: number[]; frozen: number };
const runtime = process.env.VOXEL_TEST_PACKAGE === '1' ? await loadServerRelease() : undefined;
const { gateway, build, events } = await createBuiltHarness(
  undefined,
  undefined,
  undefined,
  undefined,
  { factory: runtime?.createGateway },
);
const address = gateway.address;
assert(address && typeof address === 'object');
const relay = await tcpGate(address.port),
  origin = relay.url.replace('ws:', 'http:').replace(/\/voxel$/, '');
const browser = await launchSoftwareBrowser(),
  errors: string[] = [],
  report: Record<string, any> = {
    result: 'RUNNING',
    buildId: build.buildId,
    startedAt: new Date().toISOString(),
    browser: browser.version(),
    host: {
      node: process.version,
      arch: process.arch,
      cpu: cpus()[0]?.model,
      availableParallelism: availableParallelism(),
    },
    configuration: {
      viewport: { width: 640, height: 480 },
      quality: 'low',
      renderScale: 0.5,
      renderHz: 30,
      workerCores: 2,
    },
    scope:
      'Built client/release Wasm and packaged gateway/native workers over actual client-to-server TCP read suspension while server snapshots remain fresh. Fixture admission, natural creative world, public controls, software Chromium; no hosted services or physical school-network/FPS qualification.',
  };
let phase = 'join';
const deadline = setTimeout(() => void browser.close(), 150000);
try {
  const context = await browser.newContext({
    viewport: report.configuration.viewport,
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
  let authority: Authority | undefined,
    inputFrames = 0,
    admissions = 0,
    generation = 0;
  const durations = new Map<string, number>();
  const consumedSeconds = (before: Authority, after: Authority) => {
    let seconds = 0;
    if (before.epoch !== after.epoch) return 2.1; // a lifecycle baseline has retired the old identity
    for (let sequence = before.ack + 1; sequence <= after.ack; sequence++)
      seconds += durations.get(`${after.epoch}:${sequence}`) ?? 0;
    return seconds;
  };
  let trace: { atMs: number; state: Authority }[] | null = null;
  page.on('request', (r) => {
    if (r.url().endsWith('/api/voxel/admission')) admissions++;
  });
  page.on('websocket', (socket) => {
    const own = ++generation;
    socket.on('framesent', (frame) => {
      if (typeof frame.payload === 'string') {
        const e = JSON.parse(frame.payload);
        if (e.type === 'input') {
          inputFrames += e.frames.length;
          for (const input of e.frames)
            durations.set(`${input.epoch}:${input.sequence}`, input.dt ?? 1 / 60);
        }
      }
    });
    socket.on('framereceived', (frame) => {
      if (own !== generation || typeof frame.payload !== 'string') return;
      const e = JSON.parse(frame.payload);
      if (e.type === 'snapshot' && e.self) {
        authority = {
          epoch: e.self.epoch,
          ack: e.self.ack,
          tick: e.tick,
          position: e.self.state.slice(0, 3),
          frozen: e.self.state[12],
        };
        if (trace && trace.length < 30) trace.push({ atMs: performance.now(), state: authority });
      }
    });
  });
  const debug = () => page.evaluate(() => (window as any).voxel.debug());
  const command = (c: unknown) => page.evaluate((v) => (window as any).voxel.command(v), c);
  const neutral = { type: 'touch', x: 0, z: 0, jump: false, sneak: false, sprint: false };
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
      { timeout: 60000 },
    );
  await page.goto(`${origin}/?room=input-stall-${randomUUID()}&quality=low`, {
    waitUntil: 'domcontentloaded',
  });
  await ready();
  await page.locator('#resume').tap();
  await page.waitForFunction(() => (window as any).voxel.debug().body.frozen === 0);
  await command({ type: 'flight' });
  await page.waitForFunction(() => (window as any).voxel.debug().body.flying === 1);
  await command({ ...neutral, jump: true });
  await page.waitForFunction(() => (window as any).voxel.debug().position[1] >= 92);
  await command(neutral);
  await page.waitForTimeout(750);
  assert(authority);
  const identity = await debug();
  const distance = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - b[i]));
  const referenceLag: number[] = [];
  const referenceSeconds: number[] = [];
  for (let n = 0; n < 8; n++) {
    const state = await debug();
    referenceLag.push(state.inputLag);
    referenceSeconds.push(state.inputSeconds);
    await page.waitForTimeout(100);
  }
  report.referenceLag = referenceLag;
  report.referenceSeconds = referenceSeconds;
  phase = 'one-second-input-stall';
  const shortHeldAt = performance.now(),
    shortFramesAtHold = inputFrames;
  relay.hold('client');
  await page.waitForTimeout(200);
  const shortStart = {
    server: structuredClone(authority!),
    bytes: relay.bytesFromClient,
    frames: inputFrames,
    admissions,
  };
  await command({ ...neutral, x: 1 });
  await page.waitForTimeout(500);
  await command(neutral);
  await page.waitForTimeout(300);
  const short = await debug(),
    shortEnd = structuredClone(authority!);
  assert.equal(
    relay.bytesFromClient,
    shortStart.bytes,
    'the proxy really stopped reading client TCP',
  );
  assert(inputFrames > shortStart.frames);
  assert(shortEnd.tick > shortStart.server.tick);
  assert(
    distance(shortEnd.position, shortStart.server.position) < 0.05,
    'held inputs cannot move the authoritative body',
  );
  assert(short.lastReceivedAgoMs < 1000);
  assert(short.inputSeconds <= 2.1);
  assert.notEqual(short.status, 'recovering');
  const shortReleased = performance.now();
  const shortFramesAtRelease = inputFrames;
  trace = [];
  relay.release('client');
  await page.waitForFunction(() => {
    const d = (window as any).voxel.debug();
    return d.status === 'playing' && d.inputSeconds < 0.15;
  });
  await page.waitForTimeout(600);
  const shortRecovered = await debug(),
    settled = structuredClone(authority!);
  const recoveredLag: number[] = [];
  const recoveredSeconds: number[] = [];
  for (let n = 0; n < 12; n++) {
    const state = await debug();
    recoveredLag.push(state.inputLag);
    recoveredSeconds.push(state.inputSeconds);
    await page.waitForTimeout(100);
  }
  assert(
    distance(authority!.position, settled.position) < 0.05,
    'released controls do not leave movement held after catch-up',
  );
  for (const row of trace) {
    assert(
      distance(row.state.position, shortEnd.position) <=
        10.9 * consumedSeconds(shortEnd, row.state) + 1.2,
      'catch-up distance is bounded by the numbered movement actually consumed',
    );
    assert(
      row.state.tick - shortEnd.tick <= Math.ceil(((row.atMs - shortReleased) * 30) / 1000) + 6,
    );
  }
  report.short = {
    requestedHeldMs: 1000,
    elapsedHeldMs: shortReleased - shortHeldAt,
    serverBefore: shortStart.server,
    serverWhileHeld: shortEnd,
    clientWhileHeld: {
      position: short.position,
      inputLag: short.inputLag,
      status: short.status,
      lastReceivedAgoMs: short.lastReceivedAgoMs,
    },
    clientFramesBuffered: shortFramesAtRelease - shortFramesAtHold,
    serverTraceAfterRelease: trace,
    recoveredInputLag: shortRecovered.inputLag,
    recoveredLagSamples: recoveredLag,
    recoveredSeconds,
  };
  const recoveredP90 = [...recoveredSeconds].sort((a, b) => a - b)[
    Math.ceil(recoveredSeconds.length * 0.9) - 1
  ];
  assert(
    // Duration is authoritative: sample counts vary with RAF/fallback scheduling.
    // Permit 250 ms of host scheduling jitter above the measured healthy baseline.
    recoveredP90 <= Math.max(0.25, Math.max(...referenceSeconds) + 0.25),
    'short stall left persistent acknowledgement backlog',
  );
  trace = null;
  report.stalls = [];
  for (const duration of [5000, 15000]) {
    phase = `${duration}-ms-input-stall`;
    const before = await debug(),
      admittedBefore = admissions;
    const heldAt = performance.now();
    relay.hold('client');
    await command({ ...neutral, x: 1 });
    await page.waitForFunction(() => (window as any).voxel.debug().inputRecovery?.waiting, null, {
      timeout: 4500,
    });
    const waiting = await debug();
    assert.notEqual(waiting.status, 'recovering');
    assert.equal(waiting.focused, true);
    assert.notEqual(await page.evaluate(() => (window as any).voxel.voiceScene()), null);
    const yaw = waiting.view.yaw;
    await command({ type: 'look', dx: 100, dy: 0 });
    assert.notEqual((await debug()).view.yaw, yaw, 'camera remains usable');
    await command(neutral);
    await page.waitForTimeout(Math.max(0, duration - (performance.now() - heldAt)));
    const bounded = await debug();
    assert(bounded.inputSeconds <= 2.1);
    assert.equal(admissions, admittedBefore);
    relay.release('client');
    await page.waitForFunction(
      () => {
        const d = (window as any).voxel.debug();
        return !d.inputRecovery.waiting && d.inputLag < 10 && d.status === 'playing';
      },
      null,
      { timeout: 15000 },
    );
    const after = await debug();
    assert.equal(admissions, admittedBefore, 'input recovery uses the same connection');
    assert.equal(after.actorId, identity.actorId);
    assert.equal(after.worldId, identity.worldId);
    assert.equal(owners().liveWorkers, 1);
    report.stalls.push({
      duration,
      before: before.inputSeconds,
      bounded: bounded.inputSeconds,
      recovered: after.inputSeconds,
      admissions,
      recovery: after.inputRecovery,
    });
  }
  phase = 'retain-world-during-readmission';
  const beforeReadmission = await debug();
  let releaseAdmission!: () => void;
  let admissionHeld = false;
  const admissionGate = new Promise<void>((resolve) => (releaseAdmission = resolve));
  await page.route('**/api/voxel/admission', async (route) => {
    admissionHeld = true;
    await admissionGate;
    await route.continue();
  });
  try {
    await command({ type: 'reconnect' });
    await page.waitForTimeout(700);
    assert(admissionHeld, 'the next admission is actually held');
    const retained = await debug();
    assert.equal(retained.phase, 'preparing');
    assert.equal(retained.status, 'connecting');
    assert.equal(retained.focused, false);
    assert.equal(retained.meshed, beforeReadmission.meshed, 'loaded meshes remain visible');
    assert(retained.resources.geometries > 0);
    assert.equal(retained.audio.active, false);
    assert(retained.lastFrame > beforeReadmission.lastFrame, 'the retained world still renders');
    report.readmission = {
      retainedMeshes: retained.meshed,
      geometries: retained.resources.geometries,
    };
  } finally {
    releaseAdmission();
  }
  await ready();
  assert.equal(admissions, 2, 'only the explicit reconnect creates a second admission');
  assert.equal(owners().liveWorkers, 1);
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
  const disposed = await debug(),
    o = owners();
  assert.deepEqual(disposed.resources, { geometries: 0, textures: 0, workers: 0 });
  assert.equal(o.liveWorkers, 0);
  assert.equal(o.openedSockets, o.closedSockets);
  assert.equal(o.createdWorkers, o.closedWorkers);
  assert.deepEqual(errors, []);
  report.cleanup = { resources: disposed.resources, audio: disposed.audio.state, owners: o };
  report.result = 'BROWSER_REAL_TCP_INPUT_STALL_NONFATAL_RECOVERY_PASS';
  await context.close();
} catch (e) {
  report.result = 'FAIL';
  report.clients = await Promise.all(
    browser
      .contexts()
      .flatMap((context) => context.pages())
      .map((page) => page.evaluate(() => (window as any).voxel?.debug()).catch(() => null)),
  );
  report.failure = {
    phase,
    message: e instanceof Error ? e.message : String(e),
    stack: e instanceof Error ? e.stack : undefined,
  };
  throw e;
} finally {
  clearTimeout(deadline);
  relay.release('client');
  relay.release();
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
    new URL('../test-results/browser-input-stalls.json', import.meta.url),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({ result: report.result, failure: report.failure, cleanup: report.cleanup }),
  );
}
