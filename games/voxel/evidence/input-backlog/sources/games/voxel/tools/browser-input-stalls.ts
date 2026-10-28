import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { cpus, availableParallelism } from 'node:os';
import { loadServerRelease } from '../../../apps/voxel-server/src/release.ts';
import { createBuiltHarness, launchSoftwareBrowser } from './browser-harness.ts';
import { surfaceOwners } from './surface-mount-cycles.ts';
import { tcpGate } from '../tests/fixtures/tcp-gate.ts';
type Authority = { epoch: number; ack: number; tick: number; position: number[]; frozen: number };
const runtime = await loadServerRelease();
const { gateway, build, events } = await createBuiltHarness(
  undefined,
  undefined,
  undefined,
  undefined,
  { factory: runtime.createGateway },
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
  let trace: { atMs: number; state: Authority }[] | null = null;
  page.on('request', (r) => {
    if (r.url().endsWith('/api/voxel/admission')) admissions++;
  });
  page.on('websocket', (socket) => {
    const own = ++generation;
    socket.on('framesent', (frame) => {
      if (typeof frame.payload === 'string') {
        const e = JSON.parse(frame.payload);
        if (e.type === 'input') inputFrames += e.frames.length;
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
  for (let n = 0; n < 8; n++) {
    referenceLag.push((await debug()).inputLag);
    await page.waitForTimeout(100);
  }
  report.referenceLag = referenceLag;
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
  assert(short.inputLag <= 120);
  assert.notEqual(short.status, 'recovering');
  const shortReleased = performance.now();
  const shortFramesAtRelease = inputFrames;
  trace = [];
  relay.release('client');
  await page.waitForFunction(() => {
    const d = (window as any).voxel.debug();
    return d.status === 'playing' && d.inputLag < 10;
  });
  await page.waitForTimeout(600);
  const shortRecovered = await debug(),
    settled = structuredClone(authority!);
  const recoveredLag: number[] = [];
  for (let n = 0; n < 12; n++) {
    recoveredLag.push((await debug()).inputLag);
    await page.waitForTimeout(100);
  }
  assert(
    distance(authority!.position, settled.position) < 0.05,
    'released controls do not leave movement held after catch-up',
  );
  for (const row of trace) {
    assert(
      distance(row.state.position, shortEnd.position) <=
        (10.9 * (row.atMs - shortReleased)) / 1000 + 1.2,
      'burst delivery cannot mint movement time',
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
  };
  const recoveredP90 = [...recoveredLag].sort((a, b) => a - b)[
    Math.ceil(recoveredLag.length * 0.9) - 1
  ];
  assert(
    recoveredP90 <= Math.max(...referenceLag) + 4,
    'short stall left persistent acknowledgement backlog',
  );
  trace = null;
  phase = 'five-second-input-stall';
  const longHeldAt = performance.now(),
    longFramesAtHold = inputFrames;
  relay.hold('client');
  await page.waitForTimeout(200);
  const longStart = {
      server: structuredClone(authority!),
      bytes: relay.bytesFromClient,
      frames: inputFrames,
      admissions,
    },
    began = longHeldAt;
  await command({ ...neutral, x: 1 });
  await page.waitForFunction(() => (window as any).voxel.debug().status === 'recovering', null, {
    timeout: 4500,
  });
  const failed = await debug(),
    framesAtFailure = inputFrames;
  assert(failed.inputLag <= 120);
  assert.equal(failed.focused, false);
  assert.equal(await page.evaluate(() => (window as any).voxel.voiceScene()), null);
  // The last already-sampled batch can flush in the same render turn as fail(),
  // and Playwright's socket observer arrives independently of debug() evaluation.
  // Allow that one bounded batch to settle, then require a sustained quiet tail.
  await page.waitForTimeout(200);
  const settledFailureFrames = inputFrames;
  assert(settledFailureFrames - framesAtFailure <= 4);
  await page.waitForTimeout(Math.max(0, 5000 - (performance.now() - began)));
  const late = await debug(),
    beforeRelease = structuredClone(authority!);
  assert.equal(relay.bytesFromClient, longStart.bytes);
  assert.equal(inputFrames, settledFailureFrames);
  assert.equal(admissions, longStart.admissions);
  assert(beforeRelease.tick > longStart.server.tick);
  assert(distance(beforeRelease.position, longStart.server.position) < 0.05);
  assert(late.lastReceivedAgoMs < 1000);
  assert.equal(late.status, 'recovering');
  assert.equal(late.focused, false);
  assert(late.inputLag <= 120);
  assert.equal(late.inputLag, failed.inputLag);
  const released = performance.now();
  trace = [];
  relay.release('client');
  await page.waitForFunction(() => {
    const d = (window as any).voxel.debug();
    return d.body?.frozen === 1;
  });
  await page.waitForTimeout(400);
  for (const row of trace) {
    assert(
      distance(row.state.position, beforeRelease.position) <=
        (10.9 * (row.atMs - released)) / 1000 + 1.2,
    );
    assert(
      row.state.tick - beforeRelease.tick <= Math.ceil(((row.atMs - released) * 30) / 1000) + 6,
    );
  }
  assert.equal(admissions, longStart.admissions, 'ack failure does not automatically readmit');
  report.long = {
    requestedHeldMs: 5000,
    elapsedHeldMs: released - began,
    serverBefore: longStart.server,
    serverWhileHeld: beforeRelease,
    clientAtFailure: { inputLag: failed.inputLag, status: failed.status, focused: failed.focused },
    clientLate: {
      inputLag: late.inputLag,
      status: late.status,
      focused: late.focused,
      lastReceivedAgoMs: late.lastReceivedAgoMs,
    },
    bufferedFrames: settledFailureFrames - longFramesAtHold,
    observedFramesAfterFailure: settledFailureFrames - framesAtFailure,
    serverTraceAfterRelease: trace,
    admissionsBeforeReconnect: admissions,
  };
  trace = null;
  phase = 'explicit-reconnect';
  const oldEpoch = (await debug()).epoch;
  await command({ type: 'reconnect' });
  await page.waitForFunction((epoch) => {
    const d = (window as any).voxel.debug();
    return d.epoch > epoch && d.phase === 'playing';
  }, oldEpoch);
  await ready();
  await page.locator('#resume').tap();
  await page.waitForFunction(() => (window as any).voxel.debug().body.frozen === 0);
  const again = await debug();
  assert.equal(again.actorId, identity.actorId);
  assert.equal(again.worldId, identity.worldId);
  assert.equal(admissions, longStart.admissions + 1);
  report.reconnect = {
    oldEpoch,
    newEpoch: again.epoch,
    admissions,
    owners: owners(),
    inputLag: again.inputLag,
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
  const disposed = await debug(),
    o = owners();
  assert.deepEqual(disposed.resources, { geometries: 0, textures: 0, workers: 0 });
  assert.equal(o.liveWorkers, 0);
  assert.equal(o.openedSockets, o.closedSockets);
  assert.equal(o.createdWorkers, o.closedWorkers);
  assert.deepEqual(errors, []);
  report.cleanup = { resources: disposed.resources, audio: disposed.audio.state, owners: o };
  report.result = 'BROWSER_REAL_TCP_INPUT_STALL_AUTHORITY_ACK_BOUND_AND_EXPLICIT_RECOVERY_PASS';
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
