import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createBuiltHarness, launchSoftwareBrowser } from './browser-harness.ts';
const { gateway, origin, build, content } = await createBuiltHarness();
const browser = await launchSoftwareBrowser(),
  errors: string[] = [];
const resultFile = new URL('../test-results/browser-presentation.json', import.meta.url);
rmSync(resultFile, { force: true });
const deadline = setTimeout(() => {
  console.error('Presentation scenario exceeded 150 seconds');
  void browser.close();
}, 150000);
try {
  const room = `presentation-${randomUUID()}`,
    pages = [];
  for (let i = 0; i < 2; i++) {
    const context = await browser.newContext({
      viewport: { width: 800, height: 600 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (event) => {
      if (event.type() === 'error') errors.push(event.text());
    });
    await page.goto(`${origin}/?room=${room}&quality=low`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => {
        const d = (window as any).voxel?.debug();
        return d?.phase === 'playing' && d.meshed >= 9;
      },
      null,
      { timeout: 60000 },
    );
    pages.push(page);
  }
  const [a, b] = pages;
  const debug = (page: import('playwright').Page) =>
    page.evaluate(() => (window as any).voxel.debug());
  const command = (page: import('playwright').Page, value: unknown) =>
    page.evaluate((command) => (window as any).voxel.command(command), value);
  const controls = { type: 'touch', x: 0, z: 0, jump: false, sneak: false, sprint: false };
  for (const page of pages) {
    const resume = await page.locator('#resume').boundingBox();
    assert.ok(resume);
    await page.touchscreen.tap(resume.x + resume.width / 2, resume.y + resume.height / 2);
    await page.waitForFunction(() => (window as any).voxel.debug().body?.frozen === 0);
    await page.waitForFunction(() => (window as any).voxel.debug().audio.state === 'running');
    await command(page, { type: 'flight' });
    await page.waitForFunction(() => (window as any).voxel.debug().body?.flying === 1);
    await command(page, { ...controls, jump: true });
  }
  await a.waitForTimeout(1800);
  for (const page of pages) await command(page, controls);
  console.log('Crossing a chunk origin using ordinary authorized flight controls');
  const before = await debug(a);
  await command(a, { ...controls, x: -1 });
  await a.waitForFunction(() => (window as any).voxel.debug().position[0] < 45, null, {
    timeout: 10000,
  });
  await command(a, controls);
  await a.waitForTimeout(350);
  const positions = await Promise.all(pages.map(debug));
  for (let i = 0; i < pages.length; i++) {
    const own = positions[i],
      other = positions[1 - i];
    const dx = other.position[0] - own.position[0],
      dz = other.position[2] - own.position[2];
    const yaw = Math.atan2(dx, -dz),
      pitch = Math.atan2(other.position[1] + 1.3 - own.position[1] - 1.62, Math.hypot(dx, dz));
    await command(pages[i], {
      type: 'look',
      dx: (yaw - own.view.yaw) / 0.002,
      dy: (own.view.pitch - pitch) / 0.002,
    });
  }
  await b.waitForTimeout(400);
  const peerLook = await debug(b);
  await a.waitForFunction(
    ({ id, yaw }) => {
      const actor = (window as any).voxel
        .debug()
        .avatars.samples.find((sample: { id: string }) => sample.id === id);
      return (
        actor && Math.abs(Math.atan2(Math.sin(actor.yaw - yaw), Math.cos(actor.yaw - yaw))) < 0.03
      );
    },
    { id: peerLook.actorId, yaw: peerLook.view.yaw },
  );
  await command(b, { type: 'pause' });
  await a.waitForFunction(
    () => {
      const d = (window as any).voxel.debug();
      return (
        d.avatars.visible === 1 && d.activeJobs === 0 && d.collisionColumns === 49 && d.meshed >= 25
      );
    },
    null,
    { timeout: 60000 },
  );
  const after = await debug(a),
    peer = await debug(b);
  const peerItem = content.items.find(
    (item: { places?: string }) => item.places === content.blocks[peer.selected].name,
  )!.itemType;
  await a.waitForFunction(
    ({ id, itemType }) =>
      (window as any).voxel
        .debug()
        .avatars.equipment.samples.some(
          (sample: any) =>
            sample.id === id && sample.slot === 'held' && sample.itemType === itemType,
        ),
    { id: peer.actorId, itemType: peerItem },
  );
  const renderedGear = (await debug(a)).avatars.equipment.samples.find(
    (sample: any) => sample.id === peer.actorId && sample.slot === 'held',
  );
  assert.ok(renderedGear);
  for (const [axis, expected] of [
    peer.position[0] +
      0.36 * Math.cos(peer.view.yaw) +
      0.12 * Math.sin(peer.view.yaw) -
      after.renderOrigin.x,
    peer.position[1] + 0.84,
    peer.position[2] +
      0.36 * Math.sin(peer.view.yaw) -
      0.12 * Math.cos(peer.view.yaw) -
      after.renderOrigin.z,
  ].entries())
    assert.ok(
      Math.abs(renderedGear.position[axis] - expected) < 0.06,
      `held item origin axis ${axis}`,
    );
  for (let axis = 0; axis < 3; axis++)
    assert.ok(
      Math.abs(after.audio.listener[axis] - after.position[axis] - (axis === 1 ? 1.62 : 0)) < 0.03,
      `audio listener origin axis ${axis}`,
    );
  assert.notEqual(after.renderOrigin.x, before.renderOrigin.x);
  assert.equal(after.renderOrigin.x, Math.floor(after.position[0] / 16) * 16);
  const rendered = after.avatars.samples.find((actor: { id: string }) => actor.id === peer.actorId);
  assert.ok(rendered, 'remote avatar must have submitted instance data');
  assert.ok(
    Math.abs(
      Math.atan2(Math.sin(rendered.yaw - peer.view.yaw), Math.cos(rendered.yaw - peer.view.yaw)),
    ) < 0.03,
    'pause must retain the consumed avatar look direction',
  );
  for (const [index, expected] of [
    peer.position[0] - after.renderOrigin.x,
    peer.position[1] + 1.58,
    peer.position[2] - after.renderOrigin.z,
  ].entries())
    assert.ok(
      Math.abs(rendered.head[index] - expected) < 0.06,
      `avatar origin shift axis ${index}`,
    );
  const geometryCount = after.resources.geometries,
    selected = [];
  console.log('Cycling held shapes without retaining old geometry');
  for (const family of [
    'stone_slab',
    'oak_stairs',
    'ladder',
    'torch',
    'short_grass',
    'glass',
    'water',
    'stone_slab',
  ]) {
    const state = content.blocks.findIndex(
      (block: { name: string; placeable?: boolean }) =>
        block.name === family && block.placeable !== false,
    );
    assert.ok(state > 0, family);
    await command(a, { type: 'select', state });
    await a.waitForFunction((state) => {
      const d = (window as any).voxel.debug();
      return d.feedback.held.visible && d.feedback.held.state === state;
    }, state);
    const itemType = content.items.find(
      (item: { places?: string }) => item.places === family,
    )!.itemType;
    await b.waitForFunction(
      ({ id, itemType }) =>
        (window as any).voxel
          .debug()
          .avatars.equipment.samples.some(
            (sample: any) =>
              sample.id === id && sample.slot === 'held' && sample.itemType === itemType,
          ),
      { id: after.actorId, itemType },
    );
    const d = await debug(a);
    assert.ok(
      d.resources.geometries <= geometryCount + 1,
      `old held geometry retained for ${family}`,
    );
    selected.push({
      family,
      state,
      geometries: d.resources.geometries,
      remote: (await debug(b)).avatars.equipment,
    });
  }
  mkdirSync(new URL('../test-results/', import.meta.url), { recursive: true });
  await command(a, { type: 'mute-effects', muted: true });
  await a.waitForTimeout(350);
  assert.ok(
    (await debug(a)).audio.gain < 0.001,
    'muting effects must silence the actual gain node',
  );
  await command(a, { type: 'mute-effects', muted: false });
  await a.waitForTimeout(350);
  assert.ok((await debug(a)).audio.gain > 0.2);
  await a.screenshot({
    path: new URL('../test-results/avatar-held.png', import.meta.url).pathname,
  });
  await b.screenshot({
    path: new URL('../test-results/remote-equipment-creative.png', import.meta.url).pathname,
  });
  const diagnostics = await Promise.all(pages.map(debug));
  for (const page of pages)
    await page.evaluate(() => {
      (window as any).voxel.dispose();
      (window as any).voxel.dispose();
    });
  await a.waitForTimeout(650);
  const cleanup = await Promise.all(pages.map(debug));
  for (const d of cleanup) {
    assert.deepEqual(d.resources, { geometries: 0, textures: 0, workers: 0 });
    assert.equal(d.audio.contexts, 0);
    assert.equal(d.audio.voices, 0);
    assert.equal(d.avatars.equipment.visible, 0);
    assert.equal(d.render.gpu.pending, 0);
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    resultFile,
    JSON.stringify(
      {
        result: 'PASS',
        scope:
          'Normal public runtime control interface and authoritative flight; avatar instance coordinates across a real origin shift, held shapes, resource plateau and cleanup in software Chromium',
        buildId: build.buildId,
        engineHash: build.engineHash,
        contentHash: content.hash,
        browser: browser.version(),
        originBefore: before.renderOrigin,
        originAfter: after.renderOrigin,
        rendered,
        renderedGear,
        selected,
        diagnostics,
        cleanup: cleanup.map((d) => ({ ...d.resources, audio: d.audio })),
        errors,
      },
      null,
      2,
    ) + '\n',
  );
  console.log('Avatar origin shift, held shape cycling and cleanup pass');
} finally {
  clearTimeout(deadline);
  await browser.close();
  await gateway.close();
}
