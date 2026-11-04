import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { DAY_TICKS, WEATHER_TICKS, sampleEnvironment } from '../src/shared/environment.ts';
import { createBuiltHarness, launchSoftwareBrowser } from './browser-harness.ts';

const seed = 4242,
  browser = await launchSoftwareBrowser(),
  errors: string[] = [],
  results = [];
const file = new URL('../test-results/browser-environment.json', import.meta.url);
rmSync(file, { force: true });
const deadline = setTimeout(() => {
  console.error('Environment scenario exceeded 120 seconds');
  void browser.close();
}, 120000);
let clearNight: number | undefined, wetNight: number | undefined;
for (let tick = 0; tick < DAY_TICKS * 6; tick += 500) {
  const e = sampleEnvironment(tick, seed);
  if (e.daylight > 0.1) continue;
  if (e.rain < 0.01) clearNight ??= tick;
  if (e.rain > 0.99 && tick % WEATHER_TICKS > 500) wetNight ??= tick;
}
assert.notEqual(clearNight, undefined);
assert.notEqual(wetNight, undefined);
try {
  for (const [name, initialTick] of [
    ['clear-night', clearNight!],
    ['rain-night', wetNight!],
  ] as const) {
    const { gateway, origin, build, content } = await createBuiltHarness({ seed, initialTick });
    const context = await browser.newContext({ viewport: { width: 640, height: 480 } });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (event) => {
        if (event.type() === 'error') errors.push(event.text());
      });
      await page.goto(`${origin}/?room=${name}-${randomUUID()}&quality=low`, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForFunction(
        () => {
          const d = (window as any).voxel?.debug();
          return d?.phase === 'playing' && d.meshed >= 9 && d.render.drawCalls > 0;
        },
        null,
        { timeout: 60000 },
      );
      const d = await page.evaluate(() => (window as any).voxel.debug());
      assert.ok(d.environment.tick >= initialTick);
      assert.ok(d.environment.daylight < 0.1);
      assert.equal(d.atmosphere.sun, false);
      assert.equal(d.atmosphere.moon, true);
      assert.equal(d.atmosphere.clouds, 16);
      if (name === 'clear-night') {
        assert.ok(d.environment.rain < 0.01);
        assert.equal(d.atmosphere.stars, true);
        assert.equal(d.atmosphere.rainLines, 0);
      } else {
        assert.ok(d.environment.rain > 0.99);
        assert.equal(
          d.environment.openSky,
          true,
          `natural spawn must expose rain: ${JSON.stringify(d)}`,
        );
        assert.equal(d.atmosphere.rainLines, 96);
        assert.equal(d.atmosphere.stars, false);
      }
      mkdirSync(new URL('../test-results/', import.meta.url), { recursive: true });
      await page.screenshot({
        path: new URL(`../test-results/${name}.png`, import.meta.url).pathname,
      });
      await page.evaluate(() => {
        (window as any).voxel.dispose();
        (window as any).voxel.dispose();
      });
      await page.waitForTimeout(600);
      const cleanup = await page.evaluate(() => (window as any).voxel.debug());
      assert.deepEqual(cleanup.resources, { geometries: 0, textures: 0, workers: 0 });
      results.push({
        name,
        initialTick,
        buildId: build.buildId,
        engineHash: build.engineHash,
        contentHash: content.hash,
        environment: d.environment,
        atmosphere: d.atmosphere,
        render: d.render,
        cleanup: cleanup.resources,
      });
      console.log(`Rendered ${name} and disposed all owned resources`);
    } finally {
      await context.close();
      await gateway.close();
    }
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    file,
    JSON.stringify(
      {
        result: 'PASS',
        scope:
          'Normal server-owned world initialization, software-rendered night/weather and teardown; no hardware performance claim',
        browser: browser.version(),
        results,
        errors,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  clearTimeout(deadline);
  await browser.close();
}
