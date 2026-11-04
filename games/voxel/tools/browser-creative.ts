import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createBuiltHarness, launchSoftwareBrowser } from './browser-harness.ts';
const { gateway, origin, build, content, events } = await createBuiltHarness();
const started = performance.now();
const progress = (...values: unknown[]) =>
  console.log(Math.round(performance.now() - started), ...values);
rmSync(new URL('../test-results/browser-creative.json', import.meta.url), { force: true });
const browser = await launchSoftwareBrowser();
const deadline = setTimeout(() => {
  console.error('Creative browser scenario exceeded 180 seconds');
  void browser.close();
}, 180000);
const errors: string[] = [],
  room = `browser-${randomUUID()}`;
let tracingJump = false;
const jumpWire: unknown[] = [];
const debug = async (page: import('playwright').Page) =>
  page.evaluate(() => {
    return (window as any).voxel.debug();
  });
const wait = async (page: import('playwright').Page) =>
  page.waitForFunction(
    () => {
      const d = (window as any).voxel?.debug();
      return (
        d?.phase === 'playing' && d.collisionColumns >= 9 && d.meshed >= 9 && d.render.drawCalls > 0
      );
    },
    null,
    { timeout: 60000 },
  );
try {
  const contexts = await Promise.all([
    browser.newContext({ viewport: { width: 480, height: 300 } }),
    browser.newContext({ viewport: { width: 480, height: 300 } }),
  ]);
  const pages = [];
  for (const context of contexts) {
    const page = await context.newPage();
    if (pages.length === 0)
      page.on('websocket', (socket) => {
        socket.on('framesent', (frame) => {
          if (!tracingJump || typeof frame.payload !== 'string') return;
          const message = JSON.parse(frame.payload);
          if (message.type === 'input')
            jumpWire.push({
              kind: 'input',
              at: performance.now() - started,
              frames: message.frames,
            });
        });
        socket.on('framereceived', (frame) => {
          if (!tracingJump || typeof frame.payload !== 'string') return;
          const message = JSON.parse(frame.payload);
          if (message.type === 'snapshot' && message.self)
            jumpWire.push({
              kind: 'snapshot',
              at: performance.now() - started,
              tick: message.tick,
              ...message.self,
            });
          if (message.type === 'baseline')
            jumpWire.push({ kind: 'baseline', at: performance.now() - started, ...message });
        });
      });
    page.on('pageerror', (e) => {
      errors.push(e.message);
      console.error('Browser error', e.stack ?? e.message);
    });
    page.on('console', (m) => {
      if (m.text().startsWith('Reconnect diagnostic')) progress(m.text());
      if (m.type() === 'error') {
        errors.push(m.text().slice(0, 300));
        console.error('Browser console', m.text().slice(0, 300));
      }
    });
    page.setDefaultTimeout(15000);
    progress('Opening creative client');
    await page.goto(`${origin}/?room=${room}&quality=low`, { waitUntil: 'domcontentloaded' });
    try {
      await wait(page);
    } catch (error) {
      console.log('Client readiness failure', JSON.stringify(await debug(page)));
      throw error;
    }
    pages.push(page);
    progress('Creative client ready');
  }
  const [a, b] = pages;
  await a.bringToFront();
  await a.locator('canvas').click({ position: { x: 240, y: 170 } });
  await a.waitForFunction(() => document.pointerLockElement !== null);
  await a.waitForFunction(() => (window as any).voxel.debug().audio.state === 'running');
  const start = await debug(a);
  progress('Testing jump', JSON.stringify(start.position));
  await a.waitForTimeout(200);
  const beforeJump = await debug(a);
  tracingJump = true;
  await a.evaluate(() => {
    const trace = {
      peak: (window as any).voxel.debug().position[1],
      done: false,
      pressed: false,
      samples: 0,
      last: performance.now(),
      maxFrameGapMs: 0,
      maxUpdateAgeMs: 0,
      maxReceiptAgeMs: 0,
      catalogNodeChanges: 0,
      prepareMs: (window as any).voxel.debug().render.prepareMs,
    };
    (window as any).jumpTrace = trace;
    const bar = document.querySelector('#hotbar')!;
    const catalogObserver = new MutationObserver((records) => {
      for (const record of records)
        if (record.target === bar)
          trace.catalogNodeChanges += record.addedNodes.length + record.removedNodes.length;
    });
    catalogObserver.observe(bar, { childList: true });
    (window as any).jumpCatalogObserver = catalogObserver;
    const key = (event: KeyboardEvent) => {
      if (event.code === 'Space') trace.pressed = true;
    };
    window.addEventListener('keydown', key, { once: true });
    const sample = (now: number) => {
      const d = (window as any).voxel.debug();
      trace.samples++;
      trace.peak = Math.max(trace.peak, d.position[1]);
      trace.maxFrameGapMs = Math.max(trace.maxFrameGapMs, now - trace.last);
      trace.last = now;
      trace.maxUpdateAgeMs = Math.max(trace.maxUpdateAgeMs, performance.now() - d.lastUpdate);
      trace.maxReceiptAgeMs = Math.max(trace.maxReceiptAgeMs, d.lastReceivedAgoMs);
      if (!trace.done) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  progress('Dispatching jump key');
  await a.keyboard.press('Space');
  progress('Jump key delivered');
  await a.waitForTimeout(650);
  const jumpTrace = await a.evaluate(() => {
    const trace = (window as any).jumpTrace;
    trace.done = true;
    (window as any).jumpCatalogObserver.disconnect();
    return trace;
  });
  const peak = jumpTrace.peak;
  tracingJump = false;
  console.log('Jump wire diagnostics', JSON.stringify({ jumpWire, events }));
  assert.equal(jumpTrace.pressed, true, 'the browser must receive the jump key');
  assert.equal(
    jumpTrace.catalogNodeChanges,
    0,
    'ordinary HUD notifications must preserve catalog button nodes',
  );
  assert.ok(
    peak > beforeJump.position[1] + 0.3,
    `client must jump: ${JSON.stringify({ beforeJump, jumpTrace, after: await debug(a), errors })}`,
  );
  await a.waitForTimeout(300);
  progress('Testing movement');
  let moved = 0;
  const movementAttempts: unknown[] = [];
  for (const code of ['KeyD', 'KeyS', 'KeyA', 'KeyW']) {
    const before = await debug(a);
    await a.evaluate(
      (code) => window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true })),
      code,
    );
    try {
      await a.waitForFunction(
        (position) => {
          const d = (window as any).voxel.debug();
          return Math.hypot(d.position[0] - position[0], d.position[2] - position[2]) > 0.3;
        },
        before.position,
        { timeout: 7000 },
      );
    } catch (error) {
      if (!(error instanceof Error) || error.name !== 'TimeoutError') throw error;
    } finally {
      await a.evaluate(
        (code) => window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true })),
        code,
      );
    }
    const after = await debug(a);
    movementAttempts.push({ code, before, after });
    moved = Math.hypot(
      after.position[0] - before.position[0],
      after.position[2] - before.position[2],
    );
    if (moved > 0.3) break;
  }
  assert.ok(
    moved > 0.3,
    `client must walk: ${JSON.stringify({ movementAttempts, events, errors })}`,
  );
  await a.waitForTimeout(300);
  // Inject relative mouse motion through the same pointer-locked listener and choose a target whose adjacent cell is clear of both bodies.
  const occupied = await Promise.all(pages.map(debug));
  let aimed: any = null;
  await a.evaluate(() => {
    const view = (window as any).voxel.debug().view;
    window.dispatchEvent(
      new MouseEvent('mousemove', {
        movementX: 0,
        movementY: (view.pitch + 0.7) / 0.002,
        bubbles: true,
      }),
    );
  });
  await a.waitForTimeout(200);
  for (let attempt = 0; attempt < 4; attempt++) {
    const d = await debug(a);
    if (d.target && d.targetNormal) {
      const before = content.blocks[d.targetState],
        cell = before.replaceable
          ? d.target
          : d.target.map((v: number, i: number) => v + d.targetNormal[i]);
      const overlaps = occupied.some(
        (p) =>
          p.position[0] + 0.3 > cell[0] &&
          p.position[0] - 0.3 < cell[0] + 1 &&
          p.position[1] + 1.8 > cell[1] &&
          p.position[1] < cell[1] + 1 &&
          p.position[2] + 0.3 > cell[2] &&
          p.position[2] - 0.3 < cell[2] + 1,
      );
      if (!overlaps) {
        aimed = d;
        break;
      }
    }
    await a.evaluate(() =>
      window.dispatchEvent(
        new MouseEvent('mousemove', { movementX: 785, movementY: 0, bubbles: true }),
      ),
    );
    await a.waitForTimeout(150);
  }
  assert.ok(aimed, 'targeting must find a buildable cell');
  progress('Testing shared edits');
  const glow = content.blocks.findIndex((v: { name: string }) => v.name === 'glowstone');
  await a.evaluate((state) => (window as any).voxel.command({ type: 'select', state }), glow);
  assert.equal(gateway.rooms.size, 1);
  const resultBefore = (await debug(a)).lastResult?.sequence ?? 0;
  await a.evaluate(() => (window as any).voxel.command({ type: 'interact', kind: 'place' }));
  try {
    await a.waitForFunction(
      (sequence) => ((window as any).voxel.debug().lastResult?.sequence ?? 0) > sequence,
      resultBefore,
      { timeout: 10000 },
    );
  } catch (error) {
    console.error(
      'Placement timeout diagnostics',
      JSON.stringify({ clients: await Promise.all(pages.map(debug)), events }),
    );
    throw error;
  }
  const placed = await debug(a);
  assert.equal(placed.lastResult.outcome?.ok, true, JSON.stringify(placed.lastResult));
  assert.equal(placed.lastResult.outcome.state, glow);
  const placedCell = placed.lastResult.outcome.cell;
  await b.waitForFunction(
    ({ cell, state }) =>
      (window as any).voxel
        .debug()
        .recentEdits.some(
          (e: any) => e.state === state && e.cell.every((v: number, i: number) => v === cell[i]),
        ),
    { cell: placedCell, state: glow },
    { timeout: 10000 },
  );
  await a.waitForTimeout(150);
  const removeBefore = (await debug(a)).lastResult.sequence;
  await a.evaluate(() => (window as any).voxel.command({ type: 'interact', kind: 'remove' }));
  await a.waitForFunction(
    (sequence) => ((window as any).voxel.debug().lastResult?.sequence ?? 0) > sequence,
    removeBefore,
    { timeout: 10000 },
  );
  const removed = await debug(a);
  assert.equal(removed.lastResult.outcome?.ok, true, JSON.stringify(removed.lastResult));
  assert.equal(removed.lastResult.outcome.state, 0);
  assert.ok(
    removed.feedback.effects.bursts >= 2,
    'authoritative patches must produce edit feedback',
  );
  assert.ok(
    removed.audio.effects >= 2,
    'unlocked positional audio must play authoritative edit events',
  );
  assert.deepEqual(
    removed.audio.lastSource,
    placedCell.map((value: number) => value + 0.5),
  );
  await b.waitForFunction(
    (cell) =>
      (window as any).voxel
        .debug()
        .recentEdits.some(
          (e: any) => e.state === 0 && e.cell.every((v: number, i: number) => v === cell[i]),
        ),
    placedCell,
    { timeout: 10000 },
  );
  progress('Testing reconnect');
  await a.evaluate(() => document.exitPointerLock());
  progress('Pointer lock released');
  const oldEpoch = (await debug(a)).epoch;
  await a.evaluate(() => {
    (window as any).reconnectDiagnostics = setInterval(() => {
      const d = (window as any).voxel.debug();
      console.log('Reconnect diagnostic', JSON.stringify(d));
    }, 5000);
    (window as any).voxel.command({ type: 'reconnect' });
  });
  progress('Reconnect requested');
  try {
    await wait(a);
  } catch (error) {
    console.error(
      'Reconnect readiness failure',
      JSON.stringify({ client: await debug(a).catch(String), events, errors }),
    );
    throw error;
  }
  await a.evaluate(() => clearInterval((window as any).reconnectDiagnostics));
  progress('Reconnect ready');
  assert.ok((await debug(a)).epoch > oldEpoch, 'reconnect must install a fresh epoch');
  await b.bringToFront();
  await b.waitForTimeout(200);
  const peers = await debug(b);
  assert.equal(peers.players, 2);
  const diagnostics = await Promise.all(pages.map(debug));
  assert.deepEqual(errors, []);
  mkdirSync(new URL('../test-results/', import.meta.url), { recursive: true });
  await a.screenshot({ path: new URL('../test-results/creative.png', import.meta.url).pathname });
  const cleanup = [];
  const gpuCleanup = [];
  for (const page of pages) {
    await page.evaluate(() => {
      (window as any).voxel.dispose();
      (window as any).voxel.dispose();
    });
    const disposed = await debug(page);
    assert.equal(disposed.disposed, true);
    assert.deepEqual(disposed.resources, { geometries: 0, textures: 0, workers: 0 });
    assert.equal(disposed.render.gpu.pending, 0);
    assert.equal(disposed.render.gpu.failures, 0);
    cleanup.push(disposed.resources);
    gpuCleanup.push(disposed.render.gpu);
  }
  await b.waitForTimeout(600);
  const audioCleanup = await Promise.all(pages.map(debug));
  for (const d of audioCleanup) {
    assert.equal(d.audio.contexts, 0);
    assert.equal(d.audio.voices, 0);
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    new URL('../test-results/browser-creative.json', import.meta.url),
    JSON.stringify(
      {
        result: 'PASS',
        scope:
          'Loopback development policy, two software-rendered Chromium clients; functional evidence only',
        buildId: build.buildId,
        engineHash: build.engineHash,
        contentHash: content.hash,
        browser: browser.version(),
        moved,
        jumpHeight: peak - beforeJump.position[1],
        jumpTrace,
        jumpWire,
        clients: diagnostics,
        cleanup,
        gpuCleanup,
        audioCleanup: audioCleanup.map((d) => d.audio),
        inputMethod:
          'Trusted pointer capture and jump; DOM keyboard/relative-mouse events through normal runtime listeners for held walking and aim',
        errors,
      },
      null,
      2,
    ) + '\n',
  );
  console.log('Two-client creative browser smoke passes');
} finally {
  clearTimeout(deadline);
  await browser.close();
  await gateway.close();
}
