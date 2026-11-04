import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createBuiltHarness, launchSoftwareBrowser } from './browser-harness.ts';
const { gateway, origin, build, content } = await createBuiltHarness();
const browser = await launchSoftwareBrowser(),
  errors: string[] = [],
  injectedErrors: string[] = [],
  results = [];
const file = new URL('../test-results/browser-worker-recovery.json', import.meta.url);
rmSync(file, { force: true });
const deadline = setTimeout(() => {
  console.error('Worker recovery scenario exceeded 120 seconds');
  void browser.close();
}, 120000);
try {
  for (const mode of ['transient', 'permanent'] as const) {
    const context = await browser.newContext({
      viewport: { width: 480, height: 300 },
      hasTouch: true,
      isMobile: true,
    });
    await context.addInitScript(() =>
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 2, configurable: true }),
    );
    let requests = 0,
      failures = 0,
      repaired = false;
    await context.route('**/engine-worker-*.js', async (route) => {
      requests++;
      if (!repaired && (mode === 'permanent' || failures < 2)) {
        failures++;
        await route.fulfill({
          status: 200,
          contentType: 'text/javascript',
          body: 'throw new Error("voxel-injected-worker-startup-failure")',
        });
      } else await route.continue();
    });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      page.on('pageerror', (error) =>
        (error.message.includes('voxel-injected') ? injectedErrors : errors).push(error.message),
      );
      page.on('console', (event) => {
        if (event.type() === 'error')
          (event.text().includes('voxel-injected') ? injectedErrors : errors).push(event.text());
      });
      await page.goto(`${origin}/?room=worker-${randomUUID()}&quality=low`, {
        waitUntil: 'domcontentloaded',
      });
      const debug = () => page.evaluate(() => (window as any).voxel.debug());
      const playing = () =>
        page.waitForFunction(
          () => {
            const d = (window as any).voxel?.debug();
            return d?.phase === 'playing' && d.collisionColumns >= 9 && d.meshed >= 9;
          },
          null,
          { timeout: 60000 },
        );
      if (mode === 'permanent') {
        await page.waitForFunction(() => (window as any).voxel?.debug().status === 'recovering');
        const failed = await debug();
        assert.equal(failures, 3, 'startup retry budget is two restarts');
        assert.equal(failed.resources.workers, 0);
        assert.equal(
          failed.collisionColumns,
          0,
          'worker failure must not install empty fallback terrain',
        );
        assert.equal(failed.body.frozen, 1);
        await page.evaluate(() => {
          (window as any).voxel.command({ type: 'resume' });
          (window as any).voxel.command({
            type: 'touch',
            x: 1,
            z: 0,
            jump: false,
            sneak: false,
            sprint: false,
          });
        });
        await page.waitForTimeout(300);
        assert.equal((await debug()).focused, false);
        assert.deepEqual((await debug()).position, failed.position);
        const count = requests;
        await page.waitForTimeout(300);
        assert.equal(requests, count, 'terminal failure must not restart indefinitely');
        repaired = true;
        await page.evaluate(() => (window as any).voxel.command({ type: 'reconnect' }));
        await playing();
        assert.ok((await debug()).epoch > failed.epoch);
      } else {
        await playing();
        assert.equal(failures, 2);
        assert.equal(requests, 3);
      }
      const diagnostics = await debug();
      assert.equal(diagnostics.resources.workers, 1);
      await page.evaluate(() => {
        (window as any).voxel.dispose();
        (window as any).voxel.dispose();
      });
      await page.waitForTimeout(650);
      const cleanup = await debug();
      assert.deepEqual(cleanup.resources, { geometries: 0, textures: 0, workers: 0 });
      assert.equal(cleanup.audio.contexts, 0);
      results.push({
        mode,
        requests,
        failures,
        diagnostics,
        cleanup: { ...cleanup.resources, audio: cleanup.audio },
      });
      console.log(`Actual ${mode} worker failure, bounded retry/reconnect and teardown pass`);
    } finally {
      await context.close();
    }
  }
  assert.deepEqual(errors, []);
  mkdirSync(new URL('../test-results/', import.meta.url), { recursive: true });
  writeFileSync(
    file,
    JSON.stringify(
      {
        result: 'PASS',
        scope:
          'Actual module-worker startup faults in software Chromium with a configured two-core worker budget; no fallback generation or test-only world mutation',
        buildId: build.buildId,
        engineHash: build.engineHash,
        contentHash: content.hash,
        browser: browser.version(),
        results,
        injectedErrors,
        errors,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  clearTimeout(deadline);
  await browser.close();
  await gateway.close();
}
