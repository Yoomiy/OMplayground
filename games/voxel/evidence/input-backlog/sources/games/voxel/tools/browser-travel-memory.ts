import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { Page } from 'playwright';
import { createBuiltHarness, launchSoftwareBrowser } from './browser-harness.ts';
import { installMemoryProbe } from './browser-memory-probe.ts';

const cycles = Number(process.env.VOXEL_MEMORY_CYCLES ?? 6);
assert(Number.isSafeInteger(cycles) && cycles >= 2);
const { gateway, origin, build, events } = await createBuiltHarness();
const browser = await launchSoftwareBrowser();
const report: Record<string, any> = {
  result: 'RUNNING',
  startedAt: new Date().toISOString(),
  buildId: build.buildId,
  configuration: {
    cycles,
    viewport: { width: 480, height: 300 },
    renderScale: 0.5,
    renderHz: 30,
    workerCores: 2,
  },
  scope:
    'Unchanged built client/release Wasm with source gateway and native room workers. Authorized public flight over generated terrain, repeated same-page reconnect, weak-reference main-Wasm high-water and instrumented GL buffer ownership; forced-GC main-isolate heap/backing storage via CDP. Software Chromium, no FPS/device/whole-process/worker-heap qualification.',
  samples: [],
  errors: [],
};
let phase = 'join';
const deadline = setTimeout(() => {
  void browser.close();
}, 600000);
const controls = { type: 'touch', x: 0, z: 0, jump: false, sneak: false, sprint: false };
const debug = (page: Page) => page.evaluate(() => (window as any).voxel.debug());
const command = (page: Page, value: unknown) =>
  page.evaluate((c) => (window as any).voxel.command(c), value);
async function settle(page: Page) {
  await command(page, controls);
  let prior = '',
    stableAt = performance.now();
  const until = performance.now() + 60000;
  while (performance.now() < until) {
    const d = await debug(page);
    const signature = JSON.stringify([
      d.stream?.generationJobs,
      d.stream?.meshJobs,
      d.stream?.installed,
      d.render.uploadedBytes,
    ]);
    if (
      signature !== prior ||
      d.activeJobs !== 0 ||
      d.columns !== 49 ||
      d.collisionColumns !== 49 ||
      d.meshed < 25
    ) {
      prior = signature;
      stableAt = performance.now();
    } else if (performance.now() - stableAt > 700) return d;
    await page.waitForTimeout(100);
  }
  throw Error('stream did not settle: ' + JSON.stringify(await debug(page)));
}
async function resume(page: Page) {
  const button = await page.locator('#resume').boundingBox();
  assert(button);
  await page.touchscreen.tap(button.x + button.width / 2, button.y + button.height / 2);
  await page.waitForFunction(() => (window as any).voxel.debug().body?.frozen === 0);
  if (!(await debug(page)).body.flying) {
    await command(page, { type: 'flight' });
    await page.waitForFunction(() => (window as any).voxel.debug().body?.flying === 1);
  }
}
async function go(page: Page, x: number, z: number) {
  const end = performance.now() + 30000;
  while (performance.now() < end) {
    const d = await debug(page),
      dx = x - d.position[0],
      dz = z - d.position[2];
    if (Math.hypot(dx, dz) < 0.6) {
      await command(page, controls);
      await page.waitForTimeout(200);
      return;
    }
    assert.equal(d.status, 'playing');
    const yaw = Math.atan2(dx, -dz);
    await command(page, { type: 'look', dx: (yaw - d.view.yaw) / 0.002, dy: d.view.pitch / 0.002 });
    await command(page, { ...controls, z: -1 });
    await page.waitForTimeout(50);
  }
  throw Error('flight travel timeout: ' + JSON.stringify({ x, z, debug: await debug(page) }));
}
try {
  const context = await browser.newContext({
    viewport: report.configuration.viewport,
    hasTouch: true,
    isMobile: true,
  });
  await context.addInitScript(installMemoryProbe);
  await context.addInitScript(() =>
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 2, configurable: true }),
  );
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (e) => {
    if (e.type() === 'error') report.errors.push(e.text());
  });
  let openedSockets = 0,
    closedSockets = 0,
    createdWorkers = 0,
    closedWorkers = 0;
  page.on('websocket', (s) => {
    openedSockets++;
    s.on('close', () => closedSockets++);
  });
  page.on('worker', (w) => {
    createdWorkers++;
    w.on('close', () => closedWorkers++);
  });
  const cdp = await context.newCDPSession(page);
  const sample = async (label: string) => {
    if (label !== 'disposed') {
      const view = (await debug(page)).view;
      await command(page, { type: 'look', dx: -view.yaw / 0.002, dy: (view.pitch + 1.2) / 0.002 });
      await page.waitForTimeout(1000);
    }
    await cdp.send('HeapProfiler.collectGarbage');
    const d = await debug(page);
    const row = {
      label,
      atMs: performance.now(),
      position: d.position,
      epoch: d.epoch,
      columns: d.columns,
      collisionColumns: d.collisionColumns,
      meshed: d.meshed,
      resources: d.resources,
      render: d.render,
      stream: d.stream,
      renderedColumns: d.render.columns,
      memory: await page.evaluate(() => (window as any).voxelMemoryProbe()),
      heap: await cdp.send('Runtime.getHeapUsage'),
      dom: await cdp.send('Memory.getDOMCounters'),
      liveWorkers: page.workers().length,
      openedSockets,
      closedSockets,
      createdWorkers,
      closedWorkers,
    };
    report.samples.push(row);
    console.log(JSON.stringify(row));
    return row;
  };
  await page.goto(`${origin}/?room=memory-${randomUUID()}&quality=low`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(() => (window as any).voxel?.debug().phase === 'playing', null, {
    timeout: 60000,
  });
  await resume(page);
  await command(page, { ...controls, jump: true });
  await page.waitForFunction(() => (window as any).voxel.debug().position[1] >= 175, null, {
    timeout: 20000,
  });
  await settle(page);
  const start = await debug(page),
    x = Math.floor(start.position[0] / 16) * 16 + 8,
    z = Math.floor(start.position[2] / 16) * 16 + 8;
  const route = [
    [x, z],
    [x + 48, z],
    [x + 48, z + 48],
    [x, z + 48],
    [x, z],
  ];
  assert(route.every(([a, b]) => a > -200 && a < 200 && b > -200 && b < 200));
  report.route = route;
  await go(page, x, z);
  await settle(page);
  await sample('initial');
  for (let cycle = 0; cycle < cycles; cycle++) {
    phase = `travel-${cycle}`;
    for (const [a, b] of route.slice(1)) {
      await go(page, a, b);
      await settle(page);
    }
    const travel = await sample(`travel-${cycle}`);
    assert(
      travel.memory.gpuBuffers.created > report.samples[0].memory.gpuBuffers.created,
      'travel must allocate new rendered terrain buffers',
    );
    assert(travel.memory.gpuBuffers.bytes > 200000, 'sample must retain uploaded terrain');
    assert.equal(travel.columns, 49);
    assert.equal(travel.collisionColumns, 49);
    assert(travel.renderedColumns <= 49);
    assert.equal(travel.resources.workers, 1);
    assert.equal(travel.liveWorkers, 1);
    phase = `reconnect-${cycle}`;
    const prior = await debug(page);
    await command(page, { type: 'reconnect' });
    await page.waitForFunction(
      (epoch) => {
        const d = (window as any).voxel.debug();
        return d.phase === 'playing' && d.epoch > epoch;
      },
      prior.epoch,
      { timeout: 60000 },
    );
    assert.equal((await debug(page)).actorId, prior.actorId);
    await resume(page);
    await settle(page);
    const connected = await sample(`reconnect-${cycle}`);
    assert.equal(connected.openedSockets - connected.closedSockets, 1);
    assert.equal(connected.createdWorkers - connected.closedWorkers, 1);
    assert.equal(connected.liveWorkers, 1);
  }
  phase = 'dispose';
  await page.evaluate(() => (window as any).voxel.dispose());
  await page.waitForFunction(() => {
    const d = (window as any).voxel.debug();
    return d.disposed && d.audio.state === 'closed' && d.resources.workers === 0;
  });
  const waitUntil = performance.now() + 10000;
  while (
    (page.workers().length || openedSockets !== closedSockets) &&
    performance.now() < waitUntil
  )
    await page.waitForTimeout(50);
  const disposed = await sample('disposed');
  assert.deepEqual(disposed.resources, { geometries: 0, textures: 0, workers: 0 });
  assert.equal(disposed.memory.gpuBuffers.live, 0);
  assert.equal(disposed.memory.gpuBuffers.bytes, 0);
  assert.equal(disposed.liveWorkers, 0);
  assert.equal(openedSockets, closedSockets);
  assert.equal(createdWorkers, closedWorkers);
  assert.deepEqual(report.errors, []);
  report.result = 'BROWSER_TRAVEL_RECONNECT_RESOURCE_MEASUREMENTS_COMPLETE';
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
  report.finishedAt = new Date().toISOString();
  report.gatewayEvents = events;
  await browser.close();
  await gateway.close();
  report.remainingRooms = gateway.rooms.size;
  mkdirSync(new URL('../test-results/', import.meta.url), { recursive: true });
  writeFileSync(
    new URL('../test-results/browser-travel-memory.json', import.meta.url),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      result: report.result,
      failure: report.failure,
      samples: report.samples.length,
    }),
  );
}
