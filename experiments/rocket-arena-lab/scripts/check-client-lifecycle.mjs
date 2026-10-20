import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

// Run against Vite: the same module graph exposes the mount API to this check.
// Playwright is an optional external QA tool, not a game/runtime dependency.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const base = process.env.LAB_BROWSER_URL ?? 'http://127.0.0.1:19004';
const publicBuild = process.env.LAB_BROWSER_PUBLIC === '1';
const browser = await chromium.launch({ headless: true, args: [
  '--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
] });
const page = await browser.newPage({ viewport: { width: 320, height: 240 } });
page.setDefaultTimeout(60_000); // Software WebGL startup on the shared VPS can block briefly.
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => {
  const workers = new Set();
  const frames = new Set();
  const intervals = new Map();
  const listeners = new Set();
  const resizeObservers = new Set();
  const NativeResizeObserver = window.ResizeObserver;
  window.ResizeObserver = class extends NativeResizeObserver {
    constructor(...args) {super(...args);resizeObservers.add(this);}
    disconnect() {resizeObservers.delete(this);super.disconnect();}
  };
  const NativeWorker = window.Worker;
  window.Worker = class extends NativeWorker {
    constructor(...args) { super(...args); workers.add(this); }
    terminate() { workers.delete(this); super.terminate(); }
  };
  const request = window.requestAnimationFrame.bind(window);
  const cancel = window.cancelAnimationFrame.bind(window);
  window.requestAnimationFrame = callback => {
    const id = request(now => { frames.delete(id); callback(now); });
    frames.add(id); return id;
  };
  window.cancelAnimationFrame = id => { frames.delete(id); cancel(id); };
  const interval = window.setInterval.bind(window);
  const clear = window.clearInterval.bind(window);
  window.setInterval = (...args) => { const id = interval(...args); intervals.set(id, new Error().stack); return id; };
  window.clearInterval = id => { intervals.delete(id); clear(id); };
  const add = EventTarget.prototype.addEventListener;
  const remove = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function(type, fn, options) {
    if (this === window || this === document) {
      const capture = typeof options === 'boolean' ? options : !!options?.capture;
      const entry = { target: this, type, fn, capture };
      if (![...listeners].some(x => x.target === this && x.type === type && x.fn === fn && x.capture === capture)) {
        listeners.add(entry);
        if (options?.signal) add.call(options.signal, 'abort', () => listeners.delete(entry), { once: true });
      }
    }
    return add.call(this, type, fn, options);
  };
  EventTarget.prototype.removeEventListener = function(type, fn, options) {
    const capture = typeof options === 'boolean' ? options : !!options?.capture;
    for (const entry of listeners) {
      if (entry.target === this && entry.type === type && entry.fn === fn && entry.capture === capture) listeners.delete(entry);
    }
    return remove.call(this, type, fn, options);
  };
  window.__lifecycleResources = () => ({ workers: workers.size, frames: frames.size,
    intervals: [...intervals.values()].filter(stack => !stack?.includes('/@vite/client')).length,
    externalIntervals: [...intervals.values()].filter(stack => stack?.includes('/@vite/client')).length,
    listeners: listeners.size, styles: document.querySelectorAll('style').length,
    resizeObservers:resizeObservers.size, labelLayers:document.querySelectorAll('.player-label-layer').length,
    canvases: document.querySelectorAll('canvas').length });
});

async function createRoom() {
  await page.evaluate(() => {
    document.querySelector('#lobby-custom-toggle').click();
    document.querySelector('#lobby-create').click();
  });
  await page.waitForFunction(() => window.__debugRoom?.id && document.querySelector('#start-match'), { timeout: 60_000 });
}

const result = { checks: [], cycles: [] };
try {
  await page.goto(base, { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__drivingLab && document.querySelector('#lobby-name'));
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  const suspended = await page.evaluate(() => window.__lifecycleResources());
  assert.equal(suspended.frames, 0);
  assert.equal(suspended.workers, 1);
  assert.equal(await page.locator('#lobby').count(), 1);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  assert.equal((await page.evaluate(() => window.__lifecycleResources())).frames, 1);
  result.checks.push('cached-page suspend/resume preserves UI and one render chain');

  await createRoom();
  await page.evaluate(() => document.querySelector('#start-match').click());
  await page.waitForFunction(() => window.__debugRoom?.state.phase === 'playing', { timeout: 20_000 });
  await page.keyboard.down('w');
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.__oldRoom = window.__debugRoom;
    window.__debugRoom.connection.close();
  });
  await page.keyboard.up('w');
  await page.waitForFunction(() => !window.__debugRoom && document.querySelector('#lobby-name'));
  assert.match(await page.locator('#lobby-status').textContent(), /Connection closed|החיבור נסגר/);
  await createRoom();
  if (!publicBuild) {
  await page.evaluate(async () => {
    const ui = await import('/src/ui/game-over.ts');
    ui.showGameOver(window.__oldRoom);
  });
  assert.equal(await page.locator('#game-over').count(), 0);
  result.checks.push('disconnect returns to usable lobby; fresh join rejects stale room UI');

  await page.evaluate(async () => {
    window.__mountRocketClient = (await import('/src/standalone.ts')).mountStandaloneClient;
    window.__clientHandle = window.__mountRocketClient(document.querySelector('#app'));
  });
  for (let i = 0; i < 3; i++) {
    await createRoom();
    await page.evaluate(() => {
      window.__oldLab = window.__drivingLab;
      window.__clientHandle.dispose(); window.__clientHandle.dispose();
    });
    await page.waitForTimeout(150);
    const resources = await page.evaluate(() => window.__lifecycleResources());
    assert.equal(resources.workers, 0);
    assert.equal(resources.frames, 0);
    assert.equal(resources.intervals, 0);
    assert.equal(resources.canvases, 0);
    assert.equal(await page.locator('#lobby, #pause-menu, #driving-lab, #game-over, #dev-panel').count(), 0);
    if (i > 0) assert.deepEqual(resources, result.cycles[0]);
    result.cycles.push(resources);
    await page.evaluate(() => {
      window.__oldLab.update(null, .1, {}, performance.now());
      window.__clientHandle = window.__mountRocketClient(document.querySelector('#app'));
    });
    assert.equal((await page.evaluate(() => window.__lifecycleResources())).workers, 1);
    assert.equal(await page.locator('canvas').count(), 1);
    assert.equal(await page.locator('#lobby').count(), 1);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
    assert.equal((await page.evaluate(() => window.__lifecycleResources())).frames, 0);
    assert.equal(await page.evaluate(() => window.__clientHandle.suspended), true);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    assert.equal((await page.evaluate(() => window.__lifecycleResources())).frames, 1);
  }
  result.checks.push('three same-document mount/join/dispose cycles release resources and install cache handlers for the replacement mount');
  } else {
    await page.evaluate(() => document.querySelector('#start-match').click());
    await page.waitForFunction(() => window.__debugRoom?.state.phase === 'playing', { timeout: 20_000 });
    const state = await page.evaluate(() => window.__drivingLab.getDebugState());
    assert.equal(state.ceilingEffect, 'simple');
    assert.equal(state.timingProfile, 'buffer');
    assert.equal(state.inputClock, false);
    assert.equal(state.error, null);
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.querySelector('#pause-return').click());
    await page.waitForFunction(() => !window.__debugRoom && document.querySelector('#lobby-name'));
    result.checks.push('published default worker starts fresh gameplay and returns to lobby');
  }
  // Cancelling while matchmaking is in flight must also close its late socket.
  await page.evaluate(publicBuild => {
    document.querySelector('#lobby-custom-toggle').click();
    document.querySelector('#lobby-create').click();
    if (publicBuild) window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
    else window.__clientHandle.dispose();
  }, publicBuild);
  await page.waitForTimeout(1200);
  assert.equal(await page.evaluate(() => window.__debugRoom ?? null), null);
  assert.equal(await page.locator('canvas, #lobby, #driving-lab').count(), 0);
  result.checks.push('dispose during real matchmaking cannot resurrect the client');
  const terminal = await page.evaluate(() => window.__lifecycleResources());
  assert.equal(terminal.workers, 0); assert.equal(terminal.frames, 0); assert.equal(terminal.intervals, 0);
  assert.equal(terminal.resizeObservers,0);assert.equal(terminal.labelLayers,0);
  result.terminal = terminal;
  assert.deepEqual(errors, []);
  result.result = 'PASS';
  result.errors = errors;
  if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(JSON.stringify({ errors, resources: await page.evaluate(() => window.__lifecycleResources()),
    body: (await page.locator('body').innerText()).slice(0, 2500) }));
  throw error;
} finally {
  await page.evaluate(() => window.__clientHandle?.dispose()).catch(() => {});
  await browser.close();
}
