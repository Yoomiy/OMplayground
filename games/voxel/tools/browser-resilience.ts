import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { build as viteBuild } from 'vite';
import { createBuiltHarness, launchSoftwareBrowser } from './browser-harness.ts';
import { MemoryCheckpoints } from '../tests/fixtures/checkpoint-storage.ts';
import { tcpGate } from '../tests/fixtures/tcp-gate.ts';
import { loadServerRelease } from '../../../apps/voxel-server/src/release.ts';
const duration = Number(process.env.VOXEL_RESILIENCE_SOAK_MS ?? 90000);
assert(Number.isFinite(duration) && duration >= 60000);
const report: any = {
  result: 'RUNNING',
  durationMs: duration,
  startedAt: new Date().toISOString(),
  samples: [],
  issues: [],
  providerCalls: { voice: 0, session: 0, chat: 0, projection: 0, renew: 0 },
};
const output = new URL('../test-results/browser-resilience.json', import.meta.url);
const save = () => {
  mkdirSync(new URL('../test-results/', import.meta.url), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
};
const temp = mkdtempSync(join(tmpdir(), 'voxel-resilience-'));
writeFileSync(
  join(temp, 'entry.ts'),
  `
import { VoiceSession } from '/home/ubuntu/OMplayground/apps/web/src/game/voxel/voice-session.ts';
import { createVoxelApi } from '/home/ubuntu/OMplayground/apps/web/src/game/voxel/session-api.ts';
window.startFeatureProbe = (room) => {
 const abort = new AbortController();
 const api = createVoxelApi({room,serverUrl:location.origin,getToken:async()=> 'fixture'});
 const stats = {voice:'off',sessionFailures:0,chatFailures:0,polls:0};
 const voice = new VoiceSession({api,host:document.body,scene:()=>window.voxel.voiceScene(),onState:state=>stats.voice=state.phase});
 void voice.start({automatic:true});
 let busy=false;
 const poll=async()=>{if(busy)return;busy=true;stats.polls++;await Promise.allSettled([
 api.session(abort.signal).catch(()=>stats.sessionFailures++),
 api.chatHistory(null,abort.signal).catch(()=>stats.chatFailures++)
 ]);busy=false;};
 const timer=setInterval(poll,5000);void poll();
 window.featureProbe={stats,async close(){abort.abort();clearInterval(timer);await voice.close();}};
};
`,
);
const initialNodeEnvironment = process.env.NODE_ENV;
await viteBuild({
  configFile: false,
  root: temp,
  logLevel: 'error',
  build: {
    outDir: join(temp, 'dist'),
    lib: {
      entry: join(temp, 'entry.ts'),
      formats: ['iife'],
      name: 'FeatureProbe',
      fileName: () => 'probe.js',
    },
    minify: true,
  },
});
if (initialNodeEnvironment === undefined) delete process.env.NODE_ENV;
else process.env.NODE_ENV = initialNodeEnvironment;
let fault = false,
  renewFault = false,
  policyFault = false;
const backend = new MemoryCheckpoints();
const originalRenew = backend.renew.bind(backend);
backend.renew = async (lease) => {
  report.providerCalls.renew++;
  if (renewFault) throw new Error('injected metadata timeout');
  return originalRenew(lease);
};
backend.failPut = async () => {
  if (fault) throw new DOMException('injected object timeout', 'TimeoutError');
};
const packaged = process.env.VOXEL_TEST_PACKAGE === '1' ? await loadServerRelease() : undefined;
const { gateway, origin, build, events, content } = await createBuiltHarness(
  { seed: 4242 },
  undefined,
  undefined,
  async () => {
    if (policyFault) throw new Error('injected policy outage');
    return { state: 'playing', expiresAt: Date.now() + 60000 };
  },
  {
    factory: packaged?.createGateway,
    persistence: { objects: backend, metadata: backend },
    sessions: {
      async initialize() {},
      async accept() {},
      async project() {
        report.providerCalls.projection++;
        if (fault) throw new Error('injected presence timeout');
        return true;
      },
    },
    clientAssets: { '/feature-probe.js': readFileSync(join(temp, 'dist/probe.js')) },
    api: {
      '/api/voxel/voice-token': async (_req, _body, res) => {
        report.providerCalls.voice++;
        if (fault) await delay(20000);
        if (!res.destroyed) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'UNAVAILABLE' }));
        }
        return undefined;
      },
      '/api/voxel/session': async (_req, _body, res) => {
        report.providerCalls.session++;
        if (fault) await delay(16000);
        if (!res.destroyed) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'SESSION_UNAVAILABLE' }));
        }
        return undefined;
      },
      '/api/voxel/chat-history': async (_req, _body, res) => {
        report.providerCalls.chat++;
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'CHAT_UNCONFIRMED' }));
        return undefined;
      },
    },
  },
);
const address = gateway.address;
assert(address && typeof address === 'object');
const gate = await tcpGate(address.port);
const gatedOrigin = gate.url.replace('ws:', 'http:').replace(/\/voxel$/, '');
const browsers = await Promise.all([launchSoftwareBrowser(), launchSoftwareBrowser()]);
const pages: any[] = [];
const room = randomUUID();
const debug = (page: any) => page.evaluate(() => (window as any).voxel.debug());
const command = (page: any, cmd: any) =>
  page.evaluate((value: any) => (window as any).voxel.command(value), cmd);
const neutral = { type: 'touch', x: 0, z: 0, jump: false, sneak: false, sprint: false };
async function confirmedInteraction(page: any, kind: 'place' | 'remove') {
  for (let attempt = 0; attempt < 3; attempt++) {
    const sequence = (await debug(page)).lastResult?.sequence ?? 0;
    await command(page, { type: 'interact', kind });
    await page.waitForFunction(
      (sequence: number) => ((window as any).voxel.debug().lastResult?.sequence ?? 0) > sequence,
      sequence,
      { timeout: 5000 },
    );
    const state = await debug(page);
    if (state.lastResult.outcome?.ok) return state;
    // Actions expire after 500 ms when their preceding movement has not been played.
    // Software rendering may exceed that budget. A rejected action is safe to retry
    // with a new identity; never conceal other rejection reasons or retry indefinitely.
    assert.equal(
      state.lastResult.outcome?.reason,
      'input_timeout',
      JSON.stringify(state.lastResult),
    );
    assert.equal(state.phase, 'playing');
    assert.notEqual(state.status, 'recovering');
    report.inputActionTimeouts = (report.inputActionTimeouts ?? 0) + 1;
    await page.waitForFunction(
      () => {
        const d = (window as any).voxel.debug();
        return !d.inputRecovery.waiting && d.inputSeconds < 0.15;
      },
      null,
      { timeout: 5000 },
    );
  }
  assert.fail('confirmed interaction did not recover within three explicit attempts');
}
async function editBlock(page: any, index: number) {
  await page.waitForFunction(() => {
    const b = (window as any).voxel.debug().body;
    return b.onGround === 1 && Math.hypot(b.velocity[0], b.velocity[2]) < 0.03;
  });
  const stone = content.blocks.findIndex((block: { name: string }) => block.name === 'cobblestone');
  await command(page, { type: 'select', state: stone });
  let found = false;
  for (let turn = 0; turn < 12; turn++) {
    const d = await debug(page),
      yaw = index * Math.PI + (turn * Math.PI) / 6,
      pitch = -0.55;
    await command(page, {
      type: 'look',
      dx: (yaw - d.view.yaw) / 0.002,
      dy: (d.view.pitch - pitch) / 0.002,
    });
    await page.waitForTimeout(80);
    const aimed = await debug(page);
    if (
      aimed.target &&
      aimed.targetNormal?.[1] === 1 &&
      Math.hypot(
        aimed.target[0] + 0.5 - aimed.position[0],
        aimed.target[2] + 0.5 - aimed.position[2],
      ) > 2
    ) {
      found = true;
      break;
    }
  }
  assert(found, 'find ground for confirmed building/mining during optional outages');
  const placed = await confirmedInteraction(page, 'place');
  const cell = placed.lastResult.outcome.cell;
  report.lastPlacement = {
    cell,
    position: placed.position,
    view: placed.view,
    target: placed.target,
    state: placed.targetState,
    player: index,
  };
  save();
  // The placement ray already crosses this block. Keep that proven line of sight:
  // aiming at its center can hit a nearer hillside on uneven natural terrain.
  const afterLook = await page.evaluate(() => performance.now());
  await page.waitForFunction(
    ({ stone, cell, afterLook }: any) => {
      const d = (window as any).voxel.debug();
      return (
        d.lastUpdate >= afterLook &&
        d.targetState === stone &&
        d.target?.every((v: number, i: number) => v === cell[i])
      );
    },
    { stone, cell, afterLook },
    { timeout: 5000 },
  );
  const removed = await confirmedInteraction(page, 'remove');
  assert.deepEqual(removed.lastResult.outcome.cell, cell);
  report.confirmedEdits = (report.confirmedEdits ?? 0) + 2;
}
let admissions = 0;
const deadline = setTimeout(() => {
  for (const browser of browsers) void browser.close();
}, duration + 180000);
save();
try {
  for (let index = 0; index < 2; index++) {
    const context = await browsers[index].newContext({
      hasTouch: true,
      viewport: { width: 640, height: 480 },
    });
    await context.addInitScript(() =>
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 2 }),
    );
    const page = await context.newPage();
    pages.push(page);
    page.on('pageerror', (error: Error) => report.issues.push(error.message));
    page.on('request', (request: any) => {
      if (request.url().endsWith('/api/voxel/admission')) admissions++;
    });
    await page.goto(`${index === 0 ? gatedOrigin : origin}/?room=${room}&quality=low`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForFunction(
      () => {
        const d = (window as any).voxel?.debug();
        return d?.phase === 'playing' && d.meshed >= 9;
      },
      null,
      { timeout: 60000 },
    );
    await page.locator('#resume').tap();
    await page.waitForFunction(() => (window as any).voxel.debug().body.frozen === 0);
    await page.addScriptTag({ url: '/feature-probe.js' });
    await page.evaluate((room) => (window as any).startFeatureProbe(room), room);
  }
  const identity = await Promise.all(pages.map(debug));
  assert.equal(admissions, 2);
  report.buildId = build.buildId;
  const began = performance.now();
  let iteration = 0,
    saveFailureSeen = false,
    saveRecoverySeen = false;
  while (performance.now() - began < duration) {
    const cycle = iteration % 6;
    fault = cycle < 2;
    renewFault = cycle === 0;
    if (renewFault)
      setTimeout(() => {
        renewFault = false;
      }, 5000);
    policyFault = cycle < 2;
    // Both players keep interacting while optional service calls fail.
    for (let index = 0; index < 2; index++) {
      const page = pages[index];
      const before = await debug(page);
      // Alternate along one world axis. An edit can turn the camera; carrying its
      // yaw into the next walk would turn this bounded route into an hour of drift.
      await command(page, { type: 'look', dx: -before.view.yaw / 0.002, dy: 0 });
      await command(page, { ...neutral, x: iteration % 2 ? 1 : -1 });
      await page.waitForTimeout(250);
      await command(page, neutral);
      if (cycle === 0) await editBlock(page, index);
      const after = await debug(page);
      assert(
        after.position.some((v: number, i: number) => Math.abs(v - before.position[i]) > 0.02),
        'movement continues during optional outages',
      );
      assert.equal(after.worldId, identity[index].worldId);
      assert.equal(after.actorId, identity[index].actorId);
      assert.equal(after.phase, 'playing');
      assert.notEqual(after.status, 'recovering');
      assert(after.inputSeconds <= 2.1);
      assert(after.audio.voices <= 16);
      if (after.saveUnavailable) saveFailureSeen = true;
      if (saveFailureSeen && !after.saveUnavailable) saveRecoverySeen = true;
    }
    if (iteration % 6 === 2) {
      const beforePeer = await debug(pages[1]);
      gate.hold('client');
      await command(pages[0], neutral);
      await pages[0].waitForFunction(
        () => (window as any).voxel.debug().inputRecovery.waiting,
        null,
        { timeout: 5000 },
      );
      await pages[0].waitForTimeout(3100);
      await command(pages[0], neutral);
      const bounded = await debug(pages[0]);
      assert(bounded.inputSeconds <= 2.1);
      assert.notEqual(bounded.status, 'recovering');
      const peer = await debug(pages[1]);
      assert(peer.worldTick > beforePeer.worldTick, 'healthy peer continues');
      gate.release('client');
      await pages[0].waitForFunction(
        () => {
          const d = (window as any).voxel.debug();
          return !d.inputRecovery.waiting && d.inputLag < 12;
        },
        null,
        { timeout: 15000 },
      );
    }
    assert.equal(
      admissions,
      2,
      'optional outages and transient input stalls never readmit either player',
    );
    const states = await Promise.all(pages.map(debug));
    const featureStates = await Promise.all(
      pages.map((page) => page.evaluate(() => (window as any).featureProbe.stats)),
    );
    for (const features of featureStates) {
      assert.notEqual(features.voice, 'connected');
      assert(features.polls > 0);
    }
    report.samples.push({
      elapsedMs: Math.round(performance.now() - began),
      fault,
      renewFault,
      policyFault,
      admissions,
      states: states.map((d: any) => ({
        phase: d.phase,
        status: d.status,
        worldTick: d.worldTick,
        saveUnavailable: d.saveUnavailable,
        inputSeconds: d.inputSeconds,
        recovery: d.inputRecovery,
        resources: d.resources,
        audio: d.audio,
      })),
      featureStates,
    });
    report.saveFailureSeen = saveFailureSeen;
    report.saveRecoverySeen = saveRecoverySeen;
    save();
    if (iteration % 6 === 0)
      console.log(
        `Resilience soak ${Math.round((performance.now() - began) / 1000)} / ${duration / 1000} seconds; admissions=${admissions}`,
      );
    iteration++;
    await pages[0].waitForTimeout(9000);
  }
  fault = renewFault = policyFault = false;
  assert(saveFailureSeen, 'autosave failure reaches the user without stopping gameplay');
  assert(saveRecoverySeen, 'save warning clears after a confirmed commit');
  for (const page of pages) {
    const features = await page.evaluate(() => (window as any).featureProbe.stats);
    assert(features.sessionFailures > 0 && features.chatFailures > 0);
    await page.evaluate(async () => {
      await (window as any).featureProbe.close();
      (window as any).voxel.dispose();
    });
    await page.waitForFunction(() => (window as any).voxel.debug().audio.contexts === 0);
    assert.deepEqual((await debug(page)).resources, { geometries: 0, textures: 0, workers: 0 });
  }
  assert.deepEqual(report.issues, []);
  report.result = 'PASS';
  report.elapsedMs = performance.now() - began;
} catch (error) {
  report.result = 'FAIL';
  report.clients = await Promise.all(pages.map((page) => debug(page).catch(() => null)));
  report.error =
    error instanceof Error ? { message: error.message, stack: error.stack } : String(error);
  throw error;
} finally {
  clearTimeout(deadline);
  fault = renewFault = policyFault = false;
  gate.release('client');
  gate.release();
  for (const browser of browsers) await browser.close();
  await gate.close();
  await gateway.close();
  report.finishedAt = new Date().toISOString();
  report.events = events;
  save();
  console.log(
    JSON.stringify({ result: report.result, elapsedMs: report.elapsedMs, error: report.error }),
  );
}
