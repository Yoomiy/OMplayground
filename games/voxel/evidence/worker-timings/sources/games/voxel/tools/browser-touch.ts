import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createBuiltHarness, launchSoftwareBrowser } from './browser-harness.ts';
const { gateway, origin, build, content } = await createBuiltHarness();
const resultFile = new URL('../test-results/browser-touch.json', import.meta.url);
rmSync(resultFile, { force: true });
const browser = await launchSoftwareBrowser();
const deadline = setTimeout(() => {
  console.error('Touch scenario exceeded 120 seconds');
  void browser.close();
}, 120000);
const errors: string[] = [];
try {
  const context = await browser.newContext({
    viewport: { width: 800, height: 600 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => {
    errors.push(error.message);
    console.error(error);
  });
  page.on('console', (event) => {
    if (event.type() === 'error') errors.push(event.text());
  });
  const debug = () => page.evaluate(() => (window as any).voxel.debug());
  await page.goto(`${origin}/?room=touch-${randomUUID()}&quality=low`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(
    () => {
      const d = (window as any).voxel?.debug();
      return d?.phase === 'playing' && d.collisionColumns >= 9 && d.meshed >= 9;
    },
    null,
    { timeout: 60000 },
  );
  assert.equal((await debug()).inputMode, 'touch');
  await page.locator('.voxel-touch').waitFor({ state: 'visible' });
  const center = async (selector: string) => {
    const rect = await page.locator(selector).boundingBox();
    assert.ok(rect, selector);
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, width: rect.width };
  };
  const tap = async (selector: string) => {
    const p = await center(selector);
    await page.touchscreen.tap(p.x, p.y);
  };
  const beforeRapidPause = await debug();
  await page.evaluate(() => {
    (window as any).voxel.command({ type: 'resume' });
    (window as any).voxel.command({ type: 'pause' });
  });
  try {
    await page.waitForFunction(
      (epoch) => {
        const d = (window as any).voxel.debug();
        return d.epoch >= epoch + 2 && d.body?.frozen === 1 && !d.focused;
      },
      beforeRapidPause.epoch,
      { timeout: 5000 },
    );
  } catch (error) {
    console.error('Rapid resume/pause diagnostics', JSON.stringify(await debug()));
    throw error;
  }
  const rapidPause = await debug();
  await page.evaluate(() => {
    (window as any).voxel.command({ type: 'resume' });
    (window as any).voxel.command({ type: 'inventory', operation: { kind: 'open', target: null } });
  });
  await page.waitForFunction(() => {
    const d = (window as any).voxel.debug();
    return (
      d.inventoryOpen &&
      !d.inventoryPending &&
      !d.focused &&
      d.body.frozen === 1 &&
      d.lastResult?.outcome?.reason === 'opened'
    );
  });
  await page.keyboard.press('Escape');
  await page.waitForFunction(
    () =>
      !(window as any).voxel.debug().inventoryOpen &&
      !(window as any).voxel.debug().inventoryPending,
  );
  await tap('#resume');
  await page.waitForFunction(() => (window as any).voxel.debug().body?.frozen === 0);
  await page.waitForFunction(() => (window as any).voxel.debug().audio.state === 'running');
  assert.equal(await page.evaluate(() => document.pointerLockElement), null);
  const baseline = await debug();
  console.log('Testing touch jump');
  await page.evaluate(() => {
    (window as any).peak = (window as any).voxel.debug().position[1];
    const sample = () => {
      (window as any).peak = Math.max(
        (window as any).peak,
        (window as any).voxel.debug().position[1],
      );
      if (!(window as any).stopPeak) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await tap('[data-control="jump"]');
  await page.waitForFunction((y) => (window as any).peak > y + 0.3, baseline.position[1]);
  const peak = await page.evaluate(() => {
    (window as any).stopPeak = true;
    return (window as any).peak;
  });
  await page.waitForTimeout(650);
  const cdp = await context.newCDPSession(page);
  const stick = await center('.voxel-touch-stick');
  const point = (x: number, y: number, id: number) => ({
    x,
    y,
    id,
    radiusX: 4,
    radiusY: 4,
    force: 1,
  });
  const touch = (
    type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel',
    touchPoints: ReturnType<typeof point>[],
  ) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  console.log('Testing simultaneous joystick and look');
  let moved = 0;
  for (const [dx, dz] of [
    [1, 0],
    [0, -1],
    [-1, 0],
    [0, 1],
  ]) {
    const start = await debug();
    await touch('touchStart', [point(stick.x, stick.y, 1)]);
    await touch('touchMove', [
      point(stick.x + dx * stick.width * 0.34, stick.y + dz * stick.width * 0.34, 1),
    ]);
    await page.waitForTimeout(350);
    const after = await debug();
    moved = Math.hypot(
      after.position[0] - start.position[0],
      after.position[2] - start.position[2],
    );
    if (moved > 0.25) break;
    await touch('touchEnd', []);
  }
  assert.ok(moved > 0.25, `touch joystick must move: ${JSON.stringify(await debug())}`);
  // A second finger changes the camera while the first retains movement capture.
  const held = (await debug()).touch;
  const movement = point(
    stick.x + held.x * stick.width * 0.34,
    stick.y + held.z * stick.width * 0.34,
    1,
  );
  const beforeLook = (await debug()).view;
  await page.evaluate(() => {
    (window as any).pointerTrace = [];
    for (const name of [
      'pointerdown',
      'pointermove',
      'pointerup',
      'pointercancel',
      'gotpointercapture',
      'lostpointercapture',
    ])
      window.addEventListener(
        name,
        (event) => {
          const e = event as PointerEvent;
          (window as any).pointerTrace.push({
            type: e.type,
            id: e.pointerId,
            x: e.clientX,
            y: e.clientY,
            target: (e.target as HTMLElement).className,
          });
        },
        true,
      );
  });
  const aimTarget = await page.evaluate(() => document.elementFromPoint(640, 220)?.className);
  await touch('touchStart', [movement, point(640, 220, 2)]);
  await touch('touchMove', [movement, point(680, 200, 2)]);
  try {
    await page.waitForFunction(
      (yaw) => (window as any).voxel.debug().view.yaw > yaw + 0.1,
      beforeLook.yaw,
    );
  } catch (error) {
    console.error('Aim delivery', await page.evaluate(() => (window as any).pointerTrace));
    throw error;
  }
  const afterLook = (await debug()).view;
  assert.ok(
    afterLook.yaw > beforeLook.yaw + 0.1,
    `RTL must preserve world/camera axes: ${JSON.stringify({ beforeLook, afterLook, aimTarget, debug: await debug(), pointerTrace: await page.evaluate(() => (window as any).pointerTrace) })}`,
  );
  assert.ok(afterLook.pitch > beforeLook.pitch + 0.05);
  await touch('touchCancel', []);
  assert.deepEqual((await debug()).touch, { x: 0, z: 0, jump: false, sneak: false, sprint: false });
  // Neutral input retains airborne momentum by design. Continued held movement
  // cannot meet this grounded-rest condition; releasing in a fall may need to land first.
  await page.waitForFunction(
    () => {
      const d = (window as any).voxel.debug();
      return d.body?.onGround === 1 && Math.hypot(d.body.velocity[0], d.body.velocity[2]) < 0.05;
    },
    null,
    { timeout: 10000 },
  );
  const stoppedDebug = await debug();
  const stopped = stoppedDebug.position;
  await page.waitForTimeout(350);
  const settledDebug = await debug();
  const settled = settledDebug.position;
  assert.ok(
    Math.hypot(settled[0] - stopped[0], settled[2] - stopped[2]) < 0.1,
    `cancelled movement must stop: ${JSON.stringify({ stoppedDebug, settledDebug })}`,
  );
  console.log('Testing flight and blur release');
  await tap('.voxel-touch-actions button:has-text("תעופה")');
  await page.waitForFunction(() => (window as any).voxel.debug().body?.flying === 1);
  const jump = await center('[data-control="jump"]');
  await touch('touchStart', [point(jump.x, jump.y, 3)]);
  await page.waitForTimeout(400);
  await touch('touchEnd', []);
  assert.ok((await debug()).position[1] > settled[1] + 1, 'touch flight must ascend');
  await touch('touchStart', [point(stick.x, stick.y, 4)]);
  await touch('touchMove', [point(stick.x + stick.width * 0.34, stick.y, 4)]);
  // Headless shell keeps all tabs focused even without Playwright's focus override.
  // Exercise the normal blur listener; genuine window/OS focus remains a device gate.
  await page.evaluate(() => window.dispatchEvent(new FocusEvent('blur')));
  await page.waitForFunction(
    () =>
      !(window as any).voxel.debug().focused && (window as any).voxel.debug().body?.frozen === 1,
  );
  assert.deepEqual((await debug()).touch, { x: 0, z: 0, jump: false, sneak: false, sprint: false });
  await touch('touchCancel', []);
  await tap('#resume');
  await page.waitForFunction(() => (window as any).voxel.debug().body?.frozen === 0);
  console.log('Testing WebGL loss latch');
  await page.evaluate(() => {
    const gl = document.querySelector('canvas')!.getContext('webgl2')!;
    (window as any).loss = gl.getExtension('WEBGL_lose_context');
    if (!(window as any).loss) throw new Error('context-loss extension missing');
    (window as any).loss.loseContext();
  });
  await page.waitForFunction(() => (window as any).voxel.debug().status === 'recovering');
  await tap('#resume');
  assert.equal((await debug()).focused, false, 'resume cannot bypass lost-context recovery');
  await page.evaluate(() => (window as any).loss.restoreContext());
  await page.waitForFunction(() => (window as any).voxel.debug().status === 'error');
  const diagnostics = await debug();
  await page.evaluate(() => {
    (window as any).voxel.dispose();
    (window as any).voxel.dispose();
  });
  await page.waitForTimeout(650);
  const cleanup = await debug();
  assert.deepEqual(cleanup.resources, { geometries: 0, textures: 0, workers: 0 });
  assert.equal(cleanup.audio.contexts, 0);
  assert.equal(cleanup.audio.voices, 0);
  assert.equal(await page.locator('.voxel-touch').count(), 0);
  assert.deepEqual(errors, []);
  mkdirSync(new URL('../test-results/', import.meta.url), { recursive: true });
  writeFileSync(
    resultFile,
    JSON.stringify(
      {
        result: 'PASS',
        scope:
          'Emulated tablet with actual multi-touch, dispatched blur lifecycle event and actual software WebGL context loss; functional evidence only',
        buildId: build.buildId,
        engineHash: build.engineHash,
        contentHash: content.hash,
        browser: browser.version(),
        rapidPause: { epoch: rapidPause.epoch, body: rapidPause.body, focused: rapidPause.focused },
        moved,
        jumpHeight: peak - baseline.position[1],
        beforeLook,
        afterLook,
        cancellation: {
          stopped: {
            position: stoppedDebug.position,
            body: stoppedDebug.body,
            touch: stoppedDebug.touch,
          },
          settled: {
            position: settledDebug.position,
            body: settledDebug.body,
            touch: settledDebug.touch,
          },
        },
        diagnostics,
        cleanup: cleanup.resources,
        audioCleanup: cleanup.audio,
        errors,
      },
      null,
      2,
    ) + '\n',
  );
  console.log('Touch, blur/cancel and WebGL recovery scenario passes');
} finally {
  clearTimeout(deadline);
  await browser.close();
  await gateway.close();
}
