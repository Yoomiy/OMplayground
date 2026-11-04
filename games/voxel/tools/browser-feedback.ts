import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createBuiltHarness, launchSoftwareBrowser } from './browser-harness.ts';
import { developmentAdmission } from './development-admission.ts';
import { sampleEnvironment, WEATHER_TICKS } from '../src/shared/environment.ts';
import type { RoomPolicy } from '../src/server/room-policy.ts';

const control = { state: 'paused' as RoomPolicy['state'] };
let wetTick = 0;
for (let tick = WEATHER_TICKS; tick < WEATHER_TICKS * 100; tick += 500) {
  if (sampleEnvironment(tick, 4242).rain > 0.99) {
    wetTick = tick;
    break;
  }
}
assert.ok(wetTick);
const { gateway, origin, content } = await createBuiltHarness(
  { seed: 4242, initialTick: wetTick },
  async (req) => {
    const observer = req.headers['x-test-role'] === 'observer';
    return developmentAdmission({
      id: observer ? 'teacher' : 'kid',
      role: observer ? 'observer' : 'participant',
      capabilities: {
        build: !observer,
        fly: true,
        observe: observer,
        combat: !observer,
        explosives: !observer,
      },
    });
  },
  undefined,
  async () => ({ state: control.state, expiresAt: Date.now() + 600 }),
);
const browser = await launchSoftwareBrowser();
const errors: string[] = [],
  results: unknown[] = [];
const room = `feedback-${randomUUID()}`;
const debug = (page: any) => page.evaluate(() => (window as any).voxel.debug());
const command = (page: any, value: unknown) =>
  page.evaluate((cmd: any) => (window as any).voxel.command(cmd), value);
const deadline = setTimeout(() => {
  void browser.close();
}, 120000);
try {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 720, height: 480 },
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.url().includes('.ogg') && response.status() !== 200)
      errors.push(`sound HTTP ${response.status()}`);
  });
  await page.goto(`${origin}/?room=${room}&quality=low`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => {
      const d = (window as any).voxel?.debug();
      return d?.phase === 'paused' && d.meshed >= 9;
    },
    null,
    { timeout: 60000 },
  );
  console.log('Paused participant finished loading');
  assert.equal((await debug(page)).body.frozen, 1);
  assert.equal(await page.locator('#status').textContent(), 'העולם מושהה.');
  results.push({ scenario: 'cold participant paused join', state: await debug(page) });
  await command(page, { type: 'reconnect' });
  await page.waitForFunction(() => {
    const d = (window as any).voxel.debug();
    return d.phase === 'paused' && d.meshed >= 9 && d.lifecycle === 'paused';
  });
  assert.equal(await page.locator('#status').textContent(), 'העולם מושהה.');
  control.state = 'playing';
  await page.waitForFunction(() => (window as any).voxel.debug().lifecycle === 'playing', null, {
    timeout: 15000,
  });
  await page.locator('#resume').click();
  await page.waitForFunction(() => (window as any).voxel.debug().body.frozen === 0);
  await page.waitForFunction(
    () => {
      const a = (window as any).voxel.debug().audio;
      return a.state === 'running' && a.buffers > 20 && a.rain > 0.01;
    },
    null,
    { timeout: 15000 },
  );
  const before = await debug(page);
  await command(page, { type: 'touch', x: 1, z: 0, jump: false, sprint: false, sneak: false });
  await page.waitForFunction(
    (effects) => (window as any).voxel.debug().audio.effects > effects,
    before.audio.effects,
  );
  await command(page, { type: 'touch', x: 0, z: 0, jump: false, sprint: false, sneak: false });
  await command(page, { type: 'mute-effects', muted: true });
  await page.waitForFunction(() => (window as any).voxel.debug().audio.gain < 0.001);
  await command(page, { type: 'mute-effects', muted: false });
  await page.waitForFunction(() => (window as any).voxel.debug().audio.gain > 0.2);
  results.push({
    scenario: 'resume, recorded footsteps, biome and rain audio',
    audio: (await debug(page)).audio,
  });
  // Use ordinary creative placement/ignition to isolate blast presentation from harvesting.
  const tnt = content.blocks.findIndex((block: { name: string }) => block.name === 'tnt');
  await command(page, { type: 'select', state: tnt });
  let targetFound = false;
  for (let n = 0; n < 24; n++) {
    const d = await debug(page);
    const yaw = (n * Math.PI) / 12,
      pitch = -0.55;
    await command(page, {
      type: 'look',
      dx: (yaw - d.view.yaw) / 0.002,
      dy: (d.view.pitch - pitch) / 0.002,
    });
    await page.waitForTimeout(120);
    const aimed = await debug(page);
    if (
      aimed.target &&
      aimed.targetNormal?.[1] === 1 &&
      Math.hypot(
        aimed.target[0] + 0.5 - aimed.position[0],
        aimed.target[2] + 0.5 - aimed.position[2],
      ) > 2
    ) {
      targetFound = true;
      break;
    }
  }
  assert.ok(targetFound, 'find exposed ground for TNT placement');
  const sequence = (await debug(page)).lastResult?.sequence ?? 0;
  await command(page, { type: 'interact', kind: 'place' });
  await page.waitForFunction(
    (sequence) => ((window as any).voxel.debug().lastResult?.sequence ?? 0) > sequence,
    sequence,
  );
  const placed = await debug(page);
  assert.ok(placed.lastResult.outcome?.ok, JSON.stringify(placed.lastResult));
  const cell = placed.lastResult.outcome.cell;
  const delta = cell.map(
    (v: number, i: number) => v + 0.5 - placed.position[i] - (i === 1 ? 1.62 : 0),
  );
  const yaw = Math.atan2(delta[0], -delta[2]),
    pitch = Math.atan2(delta[1], Math.hypot(delta[0], delta[2]));
  await command(page, {
    type: 'look',
    dx: (yaw - placed.view.yaw) / 0.002,
    dy: (placed.view.pitch - pitch) / 0.002,
  });
  await page.waitForFunction((state) => (window as any).voxel.debug().targetState === state, tnt);
  await command(page, { type: 'ignite' });
  await page.waitForFunction(() => (window as any).voxel.debug().explosives.length === 1);
  await page.evaluate(() => {
    (window as any).blastTrace = { flash: 0 };
    const sample = () => {
      const opacity = Number(
        (document.querySelector('#world > div') as HTMLElement)?.style.opacity ?? 0,
      );
      (window as any).blastTrace.flash = Math.max((window as any).blastTrace.flash, opacity);
      if (!(window as any).voxel.debug().lastExplosionEvent) requestAnimationFrame(sample);
      else
        setTimeout(() => {
          (window as any).blastTrace.flash = Math.max(
            (window as any).blastTrace.flash,
            Number((document.querySelector('#world > div') as HTMLElement)?.style.opacity ?? 0),
          );
        }, 20);
    };
    requestAnimationFrame(sample);
  });
  const primed = await debug(page);
  await page.waitForFunction(() => (window as any).voxel.debug().lastExplosionEvent !== null);
  await page.waitForTimeout(100);
  const blasted = await debug(page);
  assert.ok(blasted.lastExplosionEvent.removed > 10, 'TNT creates a substantial crater');
  assert.equal(blasted.lastExplosionEvent.radius, 3);
  assert.equal(blasted.feedback.effects.explosions, 1);
  assert.ok(blasted.audio.effects > primed.audio.effects, 'recorded explosion dispatched');
  assert.ok(
    await page.evaluate(() => (window as any).blastTrace.flash > 0),
    'nearby blast flashes',
  );
  results.push({
    scenario: 'creative TNT crater, sound, pulse and flash',
    explosion: blasted.lastExplosionEvent,
  });
  control.state = 'paused';
  await page.waitForFunction(() => (window as any).voxel.debug().phase === 'paused');
  await page.waitForFunction(() => (window as any).voxel.debug().audio.gain < 0.001);
  const staffContext = await browser.newContext({
    hasTouch: true,
    extraHTTPHeaders: { 'x-test-role': 'observer' },
  });
  const staff = await staffContext.newPage();
  staff.on('pageerror', (error) => errors.push(error.message));
  await staff.goto(`${origin}/?room=${room}&quality=low`, { waitUntil: 'domcontentloaded' });
  await staff.waitForFunction(
    () => {
      const d = (window as any).voxel?.debug();
      return d?.phase === 'playing' && d.meshed >= 9 && d.lifecycle === 'paused';
    },
    null,
    { timeout: 60000 },
  );
  await staff.locator('#resume').click();
  await staff.waitForFunction(() => (window as any).voxel.debug().body.frozen === 0);
  results.push({ scenario: 'observer enters paused world', phase: (await debug(staff)).phase });
  for (const p of [page, staff]) {
    await p.evaluate(() => {
      (window as any).voxel.dispose();
      (window as any).voxel.dispose();
    });
    await p.waitForFunction(() => (window as any).voxel.debug().audio.contexts === 0);
    const d = await debug(p);
    assert.equal(d.audio.voices, 0);
    assert.equal(d.audio.ambientChannels, 0);
    assert.equal(d.audio.buffers, 0);
    assert.deepEqual(d.resources, { geometries: 0, textures: 0, workers: 0 });
  }
  await staffContext.close();
  await context.close();
  assert.deepEqual(errors, []);
  mkdirSync(new URL('../test-results/', import.meta.url), { recursive: true });
  writeFileSync(
    new URL('../test-results/browser-feedback.json', import.meta.url),
    JSON.stringify({ result: 'PASS', results, errors }, null, 2),
  );
  console.log(
    'Paused participant join/reconnect, resume, observer entry, recorded footsteps/rain, mute and cleanup passed',
  );
} catch (error) {
  for (const context of browser.contexts())
    for (const page of context.pages()) {
      console.error(
        'Browser failure state',
        await page
          .evaluate(() => ({
            debug: (window as any).voxel?.debug(),
            status: document.querySelector('#status')?.textContent,
          }))
          .catch(() => null),
      );
    }
  throw error;
} finally {
  clearTimeout(deadline);
  await browser.close();
  await gateway.close();
}
