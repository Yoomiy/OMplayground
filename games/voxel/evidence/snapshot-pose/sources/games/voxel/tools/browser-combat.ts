import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createBuiltHarness, launchSoftwareBrowser } from './browser-harness.ts';
const { gateway, origin, build, content } = await createBuiltHarness({ mode: 'survival' });
const browser = await launchSoftwareBrowser(),
  errors: string[] = [];
const resultFile = new URL('../test-results/browser-combat.json', import.meta.url);
rmSync(resultFile, { force: true });
const deadline = setTimeout(() => {
  console.error('Combat browser exceeded 240 seconds');
  void browser.close();
}, 240000);
try {
  const room = `combat-${randomUUID()}`,
    pages = [];
  for (let i = 0; i < 2; i++) {
    const context = await browser.newContext({
      viewport: { width: 640, height: 540 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (event) => {
      if (event.type() === 'error') errors.push(event.text());
    });
    await page.goto(`${origin}/?room=${room}&quality=low`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => {
        const d = (window as any).voxel?.debug();
        return (
          d?.phase === 'playing' &&
          d.collisionColumns === 49 &&
          d.meshed >= 25 &&
          d.activeJobs === 0
        );
      },
      null,
      { timeout: 60000 },
    );
    pages.push(page);
  }
  const [a, b] = pages;
  const debug = (page: typeof a) => page.evaluate(() => (window as any).voxel.debug());
  const initial = await Promise.all(pages.map(debug));
  assert.notEqual(initial[0].actorId, initial[1].actorId);
  assert.ok(
    initial.every(
      (d) =>
        d.mode === 'survival' &&
        d.combat &&
        d.vitals.health === 20 &&
        !d.inventory.catalog &&
        d.inventory.bag.every((stack: unknown) => stack === null),
    ),
  );
  console.log('Opening victim inventory and positioning attacker using public movement');
  await b.locator('#inventory-open').tap();
  await b.waitForFunction(() => {
    const d = (window as any).voxel.debug();
    return d.inventoryOpen && !d.inventoryPending && d.body.frozen === 1;
  });
  await b.evaluate(() => {
    (window as any).combatTrace = {
      minimumHealth: 20,
      sawDead: false,
      sawPreparing: false,
      maxProtection: 0,
    };
    (window as any).combatUnsubscribe = (window as any).voxel.subscribe((state: any) => {
      const d = (window as any).voxel.debug(),
        trace = (window as any).combatTrace;
      if (state.vitals) {
        trace.minimumHealth = Math.min(trace.minimumHealth, state.vitals.health);
        trace.maxProtection = Math.max(trace.maxProtection, state.vitals.protection);
      }
      trace.sawDead ||= d.phase === 'dead';
      trace.sawPreparing ||= trace.sawDead && d.phase === 'preparing' && d.body?.frozen === 1;
    });
  });
  await a.locator('#resume').tap();
  await a.waitForFunction(() => (window as any).voxel.debug().body.frozen === 0);
  await a.evaluate(async () => {
    const runtime = (window as any).voxel,
      origin = runtime.debug().position[2];
    const neutral = { type: 'touch', x: 0, z: 0, jump: false, sneak: false, sprint: false };
    runtime.command({ ...neutral, z: 1 });
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        clearInterval(timer);
        runtime.command(neutral);
        reject(new Error('public positioning timed out'));
      }, 10000);
      const timer = setInterval(() => {
        if (runtime.debug().position[2] >= origin + 1.2) {
          clearInterval(timer);
          clearTimeout(timeout);
          runtime.command(neutral);
          resolve();
        }
      }, 30);
    });
  });
  await a.waitForTimeout(200);
  const own = await debug(a),
    victim = await debug(b);
  const dx = victim.position[0] - own.position[0],
    dy = victim.position[1] + 0.9 - own.position[1] - 1.62,
    dz = victim.position[2] - own.position[2];
  assert.ok(Math.hypot(dx, dz) > 0.6 && Math.hypot(dx, dz) < 2.8, JSON.stringify({ own, victim }));
  const yaw = Math.atan2(dx, -dz),
    pitch = Math.atan2(dy, Math.hypot(dx, dz));
  await a.evaluate(
    ({ yaw, pitch }) => {
      const runtime = (window as any).voxel,
        d = runtime.debug();
      runtime.command({
        type: 'look',
        dx: (yaw - d.view.yaw) / 0.002,
        dy: (d.view.pitch - pitch) / 0.002,
      });
    },
    { yaw, pitch },
  );
  console.log(
    'Sending a real touch attack, then ordinary public attack intents at authoritative readiness',
  );
  await a.locator('.voxel-touch-actions button:has-text("תקיפה")').tap();
  await b.waitForFunction(() => (window as any).combatTrace.minimumHealth < 20);
  await a.waitForFunction(
    (id) => (window as any).voxel.debug().lastHitEvent?.target === id,
    victim.actorId,
  );
  const first = await debug(a);
  assert.equal(first.lastHitEvent?.target, victim.actorId);
  assert.equal(first.lastHitEvent.damage, 2);
  await a.evaluate(() => {
    const runtime = (window as any).voxel;
    (window as any).combatTimer = setInterval(() => {
      const d = runtime.debug();
      if (d.lastHitEvent?.dead && d.lastHitEvent.attacker === d.actorId) {
        clearInterval((window as any).combatTimer);
        return;
      }
      if (
        d.phase === 'playing' &&
        d.focused &&
        d.vitals.attackCooldown === 0 &&
        d.actionPending === 0 &&
        !d.queuedAction
      )
        runtime.command({ type: 'attack' });
    }, 100);
  });
  try {
    await b.waitForFunction(() => (window as any).voxel.debug().phase === 'dead', null, {
      timeout: 60000,
    });
  } catch (error) {
    console.error('Combat death diagnostics', JSON.stringify(await Promise.all(pages.map(debug))));
    throw error;
  }
  await a.evaluate(() => clearInterval((window as any).combatTimer));
  const dead = await debug(b);
  assert.equal(dead.vitals.health, 0);
  assert.equal(dead.body.frozen, 1);
  assert.equal(dead.inventoryOpen, false);
  assert.equal(
    await b.locator('.voxel-inventory').evaluate((dialog: HTMLDialogElement) => dialog.open),
    false,
  );
  assert.ok(dead.feedback.effects.hits >= 1);
  assert.equal(await b.locator('#respawn').isVisible(), true);
  mkdirSync(new URL('../test-results/', import.meta.url), { recursive: true });
  await b.screenshot({
    path: new URL('../test-results/combat-death.png', import.meta.url).pathname,
  });
  console.log(
    'Respawning the same built client through the normal UI and collision-readiness exchange',
  );
  await b.locator('#respawn').tap();
  await b.waitForFunction(
    (epoch) => {
      const d = (window as any).voxel.debug();
      return (
        d.epoch > epoch &&
        d.phase === 'playing' &&
        d.vitals.health === 20 &&
        d.collisionColumns === 49 &&
        d.activeJobs === 0
      );
    },
    dead.epoch,
    { timeout: 60000 },
  );
  const respawned = await debug(b),
    trace = await b.evaluate(() => (window as any).combatTrace);
  assert.ok(trace.sawDead && trace.sawPreparing);
  assert.ok(trace.maxProtection > 0);
  assert.equal(respawned.body.frozen, 1, 'respawn remains unfocused until an explicit gesture');
  await b.locator('#resume').tap();
  await b.waitForFunction(() => (window as any).voxel.debug().body.frozen === 0);
  await b.screenshot({
    path: new URL('../test-results/combat-respawn.png', import.meta.url).pathname,
  });
  const finished = await Promise.all(pages.map(debug));
  assert.ok(finished[0].feedback.effects.hits >= 1);
  assert.ok(finished[0].audio.effects >= 1);
  assert.deepEqual(
    finished[0].audio.lastSource,
    finished[0].lastHitEvent.position.map(Math.fround),
    'impact audio uses the accepted absolute hit point',
  );
  for (const page of pages)
    await page.evaluate(() => {
      clearInterval((window as any).combatTimer);
      (window as any).combatUnsubscribe?.();
      (window as any).voxel.dispose();
      (window as any).voxel.dispose();
    });
  await a.waitForTimeout(650);
  const cleanup = await Promise.all(pages.map(debug));
  for (const d of cleanup) {
    assert.deepEqual(d.resources, { geometries: 0, textures: 0, workers: 0 });
    assert.equal(d.audio.contexts, 0);
    assert.equal(d.audio.voices, 0);
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    resultFile,
    JSON.stringify(
      {
        result: 'PASS',
        scope:
          'Two real built natural survival clients with empty inventories; normal movement/look, actual touch attack and public attack intents; frozen inventory remains vulnerable, authoritative hit feedback/death, same-connection UI respawn/collision readiness/protection and teardown; no grants, client-selected victims, clock overrides or test-only mutations; software rendering only',
        buildId: build.buildId,
        engineHash: build.engineHash,
        contentHash: content.hash,
        browser: browser.version(),
        firstHit: first.lastHitEvent,
        dead: { epoch: dead.epoch, vitals: dead.vitals, frozen: dead.body.frozen },
        respawn: { epoch: respawned.epoch, vitals: respawned.vitals, trace },
        feedback: finished.map((d) => ({
          effects: d.feedback.effects,
          audioEffects: d.audio.effects,
        })),
        cleanup: cleanup.map((d) => ({ ...d.resources, audio: d.audio })),
        errors,
      },
      null,
      2,
    ) + '\n',
  );
  console.log('Authoritative combat, death, same-connection respawn and teardown pass');
} finally {
  clearTimeout(deadline);
  await browser.close();
  await gateway.close();
}
