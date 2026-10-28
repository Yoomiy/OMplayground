import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { cpus, availableParallelism } from 'node:os';
import { loadServerRelease } from '../../../apps/voxel-server/src/release.ts';
import { createBuiltHarness, launchSoftwareBrowser } from './browser-harness.ts';
import { surfaceOwners } from './surface-mount-cycles.ts';
import { tcpShaper } from '../tests/fixtures/tcp-shaper.ts';
const runtime = await loadServerRelease();
const profiles = [
  { rttMs: 50, jitterMs: 0, mbps: 10 },
  { rttMs: 100, jitterMs: 25, mbps: 10 },
  { rttMs: 150, jitterMs: 0, mbps: 10 },
];
const report: Record<string, any> = {
  result: 'RUNNING',
  buildId: runtime.build.buildId,
  startedAt: new Date().toISOString(),
  host: {
    node: process.version,
    arch: process.arch,
    cpu: cpus()[0]?.model,
    availableParallelism: availableParallelism(),
  },
  configuration: {
    viewport: { width: 640, height: 480 },
    quality: 'low',
    workerCores: 2,
    freshBrowserProcessPerProfile: true,
  },
  scope:
    'Software Chromium with built client/release Wasm and packaged gateway/workers. Local FIFO TCP byte forwarding with aggregate per-direction bandwidth, propagation delay and deterministic read-chunk jitter, including all HTTP/admission/assets/WebSocket traffic. Fixture identity and natural creative terrain; no hosted writes or physical packet-loss/device/network/capacity qualification.',
  profiles: [],
};
try {
  for (const profile of profiles) {
    const row: Record<string, any> = {
      profile,
      result: 'RUNNING',
      startedAt: new Date().toISOString(),
    };
    report.profiles.push(row);
    const { gateway, build, events } = await createBuiltHarness(
      undefined,
      undefined,
      undefined,
      undefined,
      { factory: runtime.createGateway },
    );
    const address = gateway.address;
    assert(address && typeof address === 'object');
    const relay = await tcpShaper(address.port, profile),
      browser = await launchSoftwareBrowser();
    const deadline = setTimeout(() => void browser.close(), 120000);
    const errors: string[] = [];
    let phase = 'cold-join';
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
      page.setDefaultTimeout(30000);
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (e) => {
        if (e.type() === 'error') errors.push(e.text());
      });
      let authority: { epoch: number; ack: number; tick: number; position: number[] } | undefined,
        generation = 0,
        inputFrames = 0,
        admissions = 0;
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
          if (e.type === 'snapshot' && e.self)
            authority = {
              epoch: e.self.epoch,
              ack: e.self.ack,
              tick: e.tick,
              position: e.self.state.slice(0, 3),
            };
        });
      });
      const debug = () => page.evaluate(() => (window as any).voxel.debug());
      const command = (value: unknown) =>
        page.evaluate((v) => (window as any).voxel.command(v), value);
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
      await page.goto(`${relay.origin}/?room=network-${randomUUID()}&quality=low`, {
        waitUntil: 'domcontentloaded',
      });
      await ready();
      const cold = await debug(),
        coldMs = performance.now() - began;
      row.cold = {
        elapsedMs: coldMs,
        targetMs: 8000,
        budgetMet: coldMs <= 8000,
        columns: cold.columns,
        collisionColumns: cold.collisionColumns,
        meshed: cold.meshed,
      };
      row.browser = browser.version();
      row.buildId = build.buildId;
      await page.locator('#resume').tap();
      await page.waitForFunction(() => (window as any).voxel.debug().body.frozen === 0);
      const neutral = { type: 'touch', x: 0, z: 0, jump: false, sneak: false, sprint: false };
      await command({ type: 'flight' });
      await page.waitForFunction(() => (window as any).voxel.debug().body.flying === 1);
      await command({ ...neutral, jump: true });
      await page.waitForFunction(() => (window as any).voxel.debug().position[1] >= 92);
      await command(neutral);
      await page.waitForTimeout(1000);
      const identity = await debug();
      assert(authority);
      phase = 'movement';
      const before = { server: structuredClone(authority), inputFrames };
      const samples = [];
      await command({ ...neutral, x: 1 });
      for (let n = 0; n < 24; n++) {
        if (n === 12) await command(neutral);
        const d = await debug();
        assert.equal(d.status, 'playing');
        assert(d.inputLag < 120);
        assert(d.lastReceivedAgoMs < 1000);
        samples.push({
          atMs: performance.now(),
          inputLag: d.inputLag,
          correction: d.correction,
          lastReceivedAgoMs: d.lastReceivedAgoMs,
          position: d.position,
          server: structuredClone(authority),
        });
        await page.waitForTimeout(100);
      }
      await page.waitForTimeout(1000);
      const settled = await debug(),
        after = structuredClone(authority!);
      assert(after.tick > before.server.tick);
      assert(inputFrames > before.inputFrames);
      assert(
        after.position[0] > before.server.position[0] + 2,
        'ordinary controls must move authority over the impaired link',
      );
      const agreement = Math.hypot(
        ...settled.position.map((v: number, i: number) => v - after.position[i]),
      );
      assert(
        agreement < 0.01,
        'stationary prediction/server agreement must return within one centimetre',
      );
      row.movement = {
        before: before.server,
        after,
        framesSent: inputFrames - before.inputFrames,
        samples,
        settledAgreementMetres: agreement,
      };
      phase = 'warm-reconnect';
      const oldEpoch = settled.epoch,
        warmBegan = performance.now();
      await command({ type: 'reconnect' });
      await page.waitForFunction((epoch) => {
        const d = (window as any).voxel.debug();
        return d.epoch > epoch && d.phase === 'playing';
      }, oldEpoch);
      await ready();
      const warm = await debug(),
        warmMs = performance.now() - warmBegan;
      assert.equal(warm.worldId, identity.worldId);
      assert.equal(warm.actorId, identity.actorId);
      assert.equal(admissions, 2);
      row.warm = {
        elapsedMs: warmMs,
        targetMs: 3000,
        budgetMet: warmMs <= 3000,
        oldEpoch,
        newEpoch: warm.epoch,
        columns: warm.columns,
        collisionColumns: warm.collisionColumns,
        meshed: warm.meshed,
        admissions,
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
        own = owners();
      assert.deepEqual(disposed.resources, { geometries: 0, textures: 0, workers: 0 });
      assert.equal(own.liveWorkers, 0);
      assert.equal(own.openedSockets, own.closedSockets);
      assert.equal(own.createdWorkers, own.closedWorkers);
      assert.deepEqual(errors, []);
      row.cleanup = { resources: disposed.resources, audio: disposed.audio.state, owners: own };
      row.result = 'SHAPED_TCP_BROWSER_JOIN_MOVEMENT_AND_RECONNECT_FUNCTIONAL_PASS';
      await context.close();
    } catch (error) {
      row.result = 'FAIL';
      row.failure = { phase, message: error instanceof Error ? error.message : String(error) };
      throw error;
    } finally {
      clearTimeout(deadline);
      await browser.close();
      await relay.close();
      await gateway.close();
      Object.assign(row, {
        finishedAt: new Date().toISOString(),
        errors,
        transport: relay.stats,
        events,
        remainingRooms: gateway.rooms.size,
      });
      console.log(
        JSON.stringify({
          profile,
          result: row.result,
          cold: row.cold,
          warm: row.warm,
          failure: row.failure,
        }),
      );
    }
  }
  report.result = 'SHAPED_TCP_NETWORK_MATRIX_FUNCTIONAL_PASS';
} catch (error) {
  report.result = 'FAIL';
  throw error;
} finally {
  report.finishedAt = new Date().toISOString();
  fs.mkdirSync(new URL('../test-results/', import.meta.url), { recursive: true });
  fs.writeFileSync(
    new URL('../test-results/browser-network.json', import.meta.url),
    JSON.stringify(report, null, 2) + '\n',
  );
}
