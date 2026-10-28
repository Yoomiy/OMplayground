// Functional WebGL2/worker check only: software-rendered FPS is not a device benchmark.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/tmp/playground-action-browser/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  const deadline = setTimeout(() => {
    console.error('INCOMPLETE: software-rendered browser probe exceeded 120 seconds');
    process.exitCode = 1;
    void browser.close();
  }, 120000);
  const errors = [], workers = [];
  const context = await browser.newContext({ viewport: { width: 320, height: 180 } });
  await context.addInitScript(() => localStorage.setItem('voxel.settings.v1', JSON.stringify({ renderDistance: 3, renderScale: .5, shadows: 'off', msaa: false, bloom: false, godrays: false, ssr: false, clouds: false, autoQuality: false, volume: 0, music: 0 })));
  try {
    const pages = [];
    for (const name of ['Probe A', 'Probe B']) {
      const page = await context.newPage(); pages.push(page);
      page.on('pageerror', e => errors.push(e.message));
      page.on('worker', w => workers.push(w.url()));
      await page.goto(process.env.PROBE_URL || 'http://127.0.0.1:5193/?game=sandbox', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForFunction(() => window.__game?.debugInfo().ready, null, { timeout: 60000 });
      await page.locator('.home-name-input').fill(name);
      await page.locator('.home-play').click();
      await page.waitForFunction(() => window.__game?.debugInfo().player, null, { timeout: 20000 });
      console.log('Joined', name);
    }
    const [a, b] = pages;
    const edit = await a.evaluate(async () => window.__game.dev(`const p = me.position; const x = Math.floor(p.x) + 2, y = Math.floor(p.y) + 1, z = Math.floor(p.z); game.world.setBlock(x, y, z, 'glowstone'); return { x, y, z };`));
    for (const page of pages) await page.waitForFunction(({ x, y, z }) => {
      const rt = window.__game, c = rt.debugInfo().chunks;
      return rt.chunks.world.get_block(x, y, z) === rt.registry.byName.get('glowstone').id && c.generating === 0 && c.meshing === 0 && c.pending === 0;
    }, edit, { timeout: 30000 });
    const beforeTravel = await a.evaluate(() => window.__game.debugInfo());
    await a.bringToFront();
    await a.evaluate(() => window.__game.dev('me.teleport({ x: me.position.x + 96, y: 100, z: me.position.z });'));
    await a.waitForFunction(targetX => {
      const d = window.__game.debugInfo();
      return d.state && Math.abs(d.state.x - targetX) < 3 && window.__game.chunks.centerX === Math.floor(targetX / 16) && d.chunks.generating === 0 && d.chunks.meshing === 0 && d.chunks.pending === 0 && d.chunks.meshed > 0;
    }, beforeTravel.state.x + 96, { timeout: 60000 });
    await a.evaluate(() => window.__game.dev('me.teleport({ x: me.position.x - 96, y: 100, z: me.position.z });'));
    await a.waitForFunction(targetX => {
      const d = window.__game.debugInfo(), c = d.chunks;
      return Math.abs(d.state.x - targetX) < 3 && window.__game.chunks.centerX === Math.floor(targetX / 16) && c.generating === 0 && c.meshing === 0 && c.pending === 0 && c.meshed > 0;
    }, beforeTravel.state.x, { timeout: 60000 });
    const clients = await Promise.all(pages.map(page => page.evaluate(() => window.__game.debugInfo())));
    assert(workers.length >= 4, 'both clients must create their engine worker pools');
    assert(clients.every(c => c.render.calls > 0 && c.chunks.meshed > 0 && c.chunks.pending === 0));
    assert.equal(errors.length, 0, errors.join('\n'));
    const result = { result: 'PASS', renderer: 'Chromium SwiftShader; no hardware-FPS claim', workers: workers.length, edit, beforeTravel, clients, errors };
    fs.writeFileSync(process.env.PROBE_OUTPUT || '/tmp/voxel-runtime-browser-results.json', JSON.stringify(result, null, 2) + '\n');
    await a.screenshot({ path: process.env.PROBE_SCREENSHOT || '/tmp/voxel-runtime-browser.png' });
    console.log(JSON.stringify(result, null, 2));
  } finally { clearTimeout(deadline); await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
