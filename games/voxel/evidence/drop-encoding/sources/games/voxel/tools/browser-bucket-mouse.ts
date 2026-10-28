import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Page, Request as BrowserRequest } from 'playwright';
type MouseRecord = {
  type: string;
  trusted: boolean;
  button: number;
  movementX: number;
  movementY: number;
};

/** Carry the legitimately earned inventory to an actual desktop input context. */
export async function verifyBucketMouse(source: Page, waterCell: number[]) {
  const xdotool = process.env.VOXEL_XDOTOOL;
  assert(
    xdotool && process.env.DISPLAY,
    'Real desktop input needs the private X display and OS input tool',
  );
  const execute = promisify(execFile);
  const input = (args: string[]) => execute(xdotool, args, { timeout: 3000 });
  const browser = source.context().browser();
  assert(browser);
  const previous = await source.evaluate(() => (window as any).voxel.debug());
  console.log('Desktop bucket: creating context');
  const context = await browser.newContext({
    viewport: { width: 900, height: 650 },
    storageState: await source.context().storageState(),
  });
  const page = await context.newPage(),
    errors: string[] = [];
  let stage = 'created';
  const progress = (next: string) => {
    stage = next;
    console.log('Desktop bucket:', stage);
  };
  const requests: { path: string; event: string; at: number }[] = [];
  const recordRequest = (event: string) => (request: BrowserRequest) => {
    requests.push({ path: new URL(request.url()).pathname, event, at: performance.now() });
    if (requests.length > 60) requests.shift();
  };
  page.on('request', recordRequest('request'));
  page.on('requestfinished', recordRequest('requestfinished'));
  page.on('requestfailed', recordRequest('requestfailed'));
  const debug = () => page.evaluate(() => (window as any).voxel.debug());
  page.setDefaultTimeout(20000);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (event) => {
    if (event.type() === 'error') errors.push(event.text());
  });
  try {
    progress('navigating');
    await page.bringToFront();
    await page.goto(source.url(), { waitUntil: 'domcontentloaded' });
    progress('waiting for native readiness');
    await page.waitForFunction(
      () => {
        const d = (window as any).voxel?.debug();
        return d?.phase === 'playing' && d.meshed >= 9 && d.inventory;
      },
      null,
      { timeout: 60000 },
    );
    progress('native ready');
    const joined = await debug();
    assert.equal(joined.inputMode, 'desktop');
    assert.equal(joined.actorId, previous.actorId);
    assert.equal(joined.worldId, previous.worldId);
    assert.deepEqual(joined.inventory.bag, previous.inventory.bag);
    assert.equal(joined.inventory.revision, previous.inventory.revision);
    await page.evaluate(() => {
      (window as any).bucketMouseEvents = [];
      (window as any).bucketKeyboardEvents = [];
      window.addEventListener(
        'keydown',
        (event) =>
          (window as any).bucketKeyboardEvents.push({ code: event.code, trusted: event.isTrusted }),
        true,
      );
      for (const type of ['mousemove', 'mousedown', 'mouseup'])
        window.addEventListener(
          type,
          (event) => {
            const e = event as MouseEvent;
            const values = (window as any).bucketMouseEvents;
            values.push({
              type,
              trusted: e.isTrusted,
              button: e.button,
              movementX: e.movementX,
              movementY: e.movementY,
            });
            if (values.length > 100) values.shift();
          },
          true,
        );
    });
    const entry = await page.locator('#resume').evaluate((element) => {
      const r = element.getBoundingClientRect(),
        border = (window.outerWidth - window.innerWidth) / 2;
      return {
        x: Math.round(window.screenX + border + r.x + r.width / 2),
        y: Math.round(
          window.screenY + window.outerHeight - window.innerHeight - border + r.y + r.height / 2,
        ),
        scale: window.devicePixelRatio,
      };
    });
    assert.equal(entry.scale, 1);
    await input(['mousemove', String(entry.x), String(entry.y), 'click', '1']);
    progress('waiting for pointer lock');
    await page.waitForFunction(
      () =>
        document.pointerLockElement !== null &&
        (window as any).voxel.debug().focused &&
        (window as any).voxel.debug().body.frozen === 0,
    );
    await input(['key', '1']);
    progress('pointer locked');
    await page.waitForFunction(() => !(window as any).voxel.debug().inventoryPending);
    const aim = async (cell: number[], height = 0.5) => {
      for (let attempt = 0; attempt < 12; attempt++) {
        const d = await debug();
        if (JSON.stringify(d.target) === JSON.stringify(cell)) return;
        const dx = cell[0] + 0.5 - d.position[0],
          dz = cell[2] + 0.5 - d.position[2],
          dy = cell[1] + height - d.position[1] - 1.62;
        const yaw = Math.atan2(dx, -dz),
          pitch = Math.atan2(dy, Math.hypot(dx, dz));
        const moveX = Math.round(
          Math.max(
            -300,
            Math.min(
              300,
              Math.atan2(Math.sin(yaw - d.view.yaw), Math.cos(yaw - d.view.yaw)) / 0.002,
            ),
          ),
        );
        const moveY = Math.round(Math.max(-200, Math.min(200, (d.view.pitch - pitch) / 0.002)));
        assert(moveX || moveY, 'aim must converge to the real target');
        const at = await page.evaluate(() => performance.now());
        await input(['mousemove_relative', '--', String(moveX), String(moveY)]);
        await page.waitForFunction((at) => {
          const d = (window as any).voxel.debug();
          return d.lastFrame > at && d.lastUpdate > at;
        }, at);
      }
      assert.deepEqual(
        (await debug()).target,
        cell,
        'trusted mouse movement must aim at the intended world cell',
      );
    };
    const click = async () => {
      const before = await debug();
      await input(['mousedown', '3']);
      await input(['mouseup', '3']);
      await page.waitForFunction(
        (sequence) => ((window as any).voxel.debug().lastResult?.sequence ?? 0) > sequence,
        before.lastResult?.sequence ?? 0,
      );
      const result = (await debug()).lastResult;
      assert.equal(result.outcome.ok, true, JSON.stringify(result));
      return result;
    };
    await aim(waterCell);
    progress('aimed at owned water');
    const before = await debug();
    const collected = await click();
    assert.deepEqual(collected.outcome.cell, waterCell);
    assert.equal(collected.outcome.state, 0);
    await page.waitForFunction(
      () => (window as any).voxel.debug().feedback.held.itemType === 'water_bucket',
    );
    const filled = await debug();
    assert.deepEqual(filled.inventory.bag[0], { itemType: 'water_bucket', count: 1 });
    assert.deepEqual(filled.inventory.bag.slice(1), before.inventory.bag.slice(1));
    assert.equal(filled.inventory.revision, before.inventory.revision + 1);
    await page.screenshot({
      path: new URL('../test-results/bucket-desktop-filled.png', import.meta.url).pathname,
    });
    await aim([waterCell[0], waterCell[1] - 1, waterCell[2]], 0.99);
    const placed = await click();
    assert.deepEqual(placed.outcome.cell, waterCell);
    assert(placed.outcome.state > 0);
    await page.waitForFunction(
      () => (window as any).voxel.debug().feedback.held.itemType === 'bucket',
    );
    const completed = await debug();
    assert.deepEqual(completed.inventory.bag, before.inventory.bag);
    assert.equal(completed.inventory.revision, before.inventory.revision + 2);
    const events = await page.evaluate(() => (window as any).bucketMouseEvents as MouseRecord[]);
    assert.equal(
      events.filter((e) => e.type === 'mousedown' && e.button === 2 && e.trusted).length,
      2,
    );
    assert(
      events
        .filter((e) => e.type === 'mousemove')
        .some((e) => e.trusted && (e.movementX || e.movementY)),
    );
    assert(events.every((e) => e.trusted));
    const keyboard = await page.evaluate(
      () => (window as any).bucketKeyboardEvents as { code: string; trusted: boolean }[],
    );
    assert(keyboard.some((e) => e.code === 'Digit1' && e.trusted));
    await page.screenshot({
      path: new URL('../test-results/bucket-desktop-reused.png', import.meta.url).pathname,
    });
    await page.evaluate(() => (window as any).voxel.dispose());
    await page.waitForFunction(() => {
      const d = (window as any).voxel.debug();
      return d.disposed && d.audio.state === 'closed' && d.resources.workers === 0;
    });
    const cleanup = await debug();
    assert.deepEqual(cleanup.resources, { geometries: 0, textures: 0, workers: 0 });
    assert.deepEqual(errors, []);
    return {
      sameIdentity: true,
      inputMethod:
        'Headed Chromium on private Xvfb with OS XTest activation, relative motion, keyboard and right-click',
      entry,
      keyboard,
      pointerLock: true,
      events,
      collected,
      placed,
      initialRevision: before.inventory.revision,
      finalRevision: completed.inventory.revision,
      finalBucket: completed.inventory.bag[0],
      cleanup: { resources: cleanup.resources, audio: cleanup.audio.state },
      errors,
    };
  } catch (error) {
    const state = await Promise.race([
      debug().catch(() => null),
      new Promise<null>((r) => setTimeout(() => r(null), 1000)),
    ]);
    const events = await Promise.race([
      page.evaluate(() => (window as any).bucketMouseEvents ?? []).catch(() => []),
      new Promise<[]>((r) => setTimeout(() => r([]), 1000)),
    ]);
    writeFileSync(
      new URL('../test-results/browser-bucket-desktop-failure.json', import.meta.url),
      JSON.stringify({ stage, error: String(error), state, events, errors, requests }, null, 2) +
        '\n',
    );
    console.error(
      'Desktop bucket diagnostics',
      JSON.stringify({
        stage,
        error: String(error),
        position: state?.position,
        body: state?.body,
        view: state?.view,
        target: state?.target,
        focused: state?.focused,
        status: state?.status,
        events,
        errors,
        requests,
      }),
    );
    throw error;
  } finally {
    await context.close().catch(() => {});
  }
}
