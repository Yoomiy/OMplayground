import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createBuiltHarness, launchSoftwareBrowser } from './browser-harness.ts';
const { gateway, origin, build, content } = await createBuiltHarness();
const browser = await launchSoftwareBrowser(),
  errors: string[] = [];
const resultFile = new URL('../test-results/browser-inventory.json', import.meta.url);
rmSync(resultFile, { force: true });
const deadline = setTimeout(() => {
  console.error('Inventory scenario exceeded 180 seconds');
  void browser.close();
}, 180000);
try {
  const context = await browser.newContext({
    viewport: { width: 1000, height: 800 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (event) => {
    if (event.type() === 'error') errors.push(event.text());
  });
  await page.goto(`${origin}/?room=inventory-${randomUUID()}&quality=low`, {
    waitUntil: 'domcontentloaded',
  });
  const debug = () => page.evaluate(() => (window as any).voxel.debug());
  const playing = () =>
    page.waitForFunction(
      () => {
        const d = (window as any).voxel?.debug();
        return d?.phase === 'playing' && d.meshed >= 9 && d.inventory;
      },
      null,
      { timeout: 60000 },
    );
  await playing();
  await page.locator('#resume').tap();
  await page.waitForFunction(() => (window as any).voxel.debug().body?.frozen === 0);
  const initial = await debug();
  await page.locator('#inventory-open').tap();
  await page.waitForFunction(() => {
    const d = (window as any).voxel.debug();
    return (
      d.inventoryOpen &&
      !d.inventoryPending &&
      d.epoch > 1 &&
      d.body.frozen === 1 &&
      d.lastResult?.outcome?.reason === 'opened'
    );
  });
  assert.equal(
    await page.locator('.voxel-inventory').evaluate((dialog: HTMLDialogElement) => dialog.open),
    true,
  );
  const settled = () => page.waitForFunction(() => !(window as any).voxel.debug().inventoryPending);
  const give = async (itemType: string) => {
    const previous = (await debug()).inventory.revision;
    await page.locator('#inventory-catalog').selectOption(itemType);
    await page.locator('#inventory-give').tap();
    await page.waitForFunction(
      (revision) => (window as any).voxel.debug().inventory.revision > revision,
      previous,
    );
    await settled();
  };
  const move = async (
    area: string,
    index: number,
    destination: string,
    target: number,
    one = false,
  ) => {
    const previous = (await debug()).inventory.revision;
    await page.locator(`[data-area="${area}"][data-slot="${index}"]`).click();
    await page
      .locator(`[data-area="${destination}"][data-slot="${target}"]`)
      .click({ button: one ? 'right' : 'left' });
    await page.waitForFunction(
      (revision) => (window as any).voxel.debug().inventory.revision > revision,
      previous,
    );
    await settled();
  };
  console.log('Crafting and equipping through the actual Hebrew modal');
  await give('oak_log');
  await move('bag', 0, 'craft2', 3, true);
  assert.equal((await debug()).inventory.bag[0].count, 63);
  await page.locator('#inventory-craft').tap();
  await page.waitForFunction(() =>
    (window as any).voxel
      .debug()
      .inventory.bag.some((stack: any) => stack?.itemType === 'oak_planks' && stack.count === 4),
  );
  await settled();
  await give('trail_boots');
  const bootsIndex = (await debug()).inventory.bag.findIndex(
    (stack: any) => stack?.itemType === 'trail_boots',
  );
  await move('bag', bootsIndex, 'equipment', 3);
  assert.equal((await debug()).inventory.equipment[3].instance.durability, 120);
  assert.ok(
    (await debug()).environment.tick > initial.environment.tick + 6,
    'individual inventory cannot pause room time',
  );
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !(window as any).voxel.debug().inventoryOpen);
  await settled();
  await page.locator('#resume').tap();
  await page.waitForFunction(() => (window as any).voxel.debug().body?.frozen === 0);
  const table = content.blocks.findIndex(
    (block: { name: string }) => block.name === 'crafting_table',
  );
  await page.evaluate((state) => {
    const runtime = (window as any).voxel;
    runtime.command({ type: 'select', state });
    runtime.command({ type: 'look', dx: 0, dy: 350 });
  }, table);
  await page.waitForFunction(() => (window as any).voxel.debug().targetNormal?.[1] === 1);
  await page.evaluate(() => (window as any).voxel.command({ type: 'interact', kind: 'place' }));
  await page.waitForFunction(
    () => (window as any).voxel.debug().lastResult?.outcome?.reason === 'edited',
  );
  const placement = (await debug()).lastResult;
  assert.equal(placement.outcome.state, table);
  await page.waitForFunction(
    (cell) => JSON.stringify((window as any).voxel.debug().target) === JSON.stringify(cell),
    placement.outcome.cell,
  );
  await page.locator('#inventory-open').tap();
  await page.waitForFunction(() => {
    const d = (window as any).voxel.debug();
    return d.body.frozen === 1 && !d.inventoryPending && d.lastResult?.outcome?.reason === 'opened';
  });
  await page.locator('#inventory-use').tap();
  await page.waitForFunction(() => (window as any).voxel.debug().inventory.station === 'workbench');
  await settled();
  await give('oak_planks');
  const plankIndex = (await debug()).inventory.bag.findIndex(
    (stack: any) => stack?.itemType === 'oak_planks',
  );
  for (const slot of [0, 1, 2, 3, 5, 6, 7, 8]) await move('bag', plankIndex, 'craft3', slot, true);
  mkdirSync(new URL('../test-results/', import.meta.url), { recursive: true });
  await page.screenshot({
    path: new URL('../test-results/inventory-crafting.png', import.meta.url).pathname,
  });
  await page.locator('#inventory-craft').tap();
  await page.waitForFunction(() =>
    (window as any).voxel
      .debug()
      .inventory.bag.some((stack: any) => stack?.itemType === 'chest' && stack.count === 1),
  );
  await settled();
  let crafted = await debug();
  assert.ok(crafted.inventory.craft3.every((stack: any) => stack === null));
  console.log('Placing a real chest and moving owned stacks through its UI');
  await page.keyboard.press('Escape');
  await settled();
  await page.locator('#resume').tap();
  await page.waitForFunction(() => (window as any).voxel.debug().body?.frozen === 0);
  const chestState = content.blocks.findIndex((block: { name: string }) => block.name === 'chest');
  await page.evaluate((state) => {
    (window as any).voxel.command({ type: 'select', state });
    (window as any).voxel.command({ type: 'look', dx: 350, dy: 0 });
  }, chestState);
  await page.waitForFunction(() => (window as any).voxel.debug().targetNormal?.[1] === 1);
  await page.evaluate(() => (window as any).voxel.command({ type: 'interact', kind: 'place' }));
  await page.waitForFunction(
    (state) => (window as any).voxel.debug().lastResult?.outcome?.state === state,
    chestState,
  );
  const chestCell = (await debug()).lastResult.outcome.cell;
  await page.waitForFunction(
    (cell) => JSON.stringify((window as any).voxel.debug().target) === JSON.stringify(cell),
    chestCell,
  );
  await page.locator('#inventory-open').tap();
  await page.waitForFunction(() => {
    const d = (window as any).voxel.debug();
    return d.body.frozen === 1 && !d.inventoryPending && d.lastResult?.outcome?.reason === 'opened';
  });
  await page.locator('#inventory-use').tap();
  await page.waitForFunction(() => (window as any).voxel.debug().inventory.station === 'container');
  await settled();
  assert.equal(await page.locator('[data-area="container"]').count(), 27);
  await move('bag', 0, 'container', 0, true);
  assert.equal((await debug()).inventory.container.slots[0].count, 1);
  await page.screenshot({
    path: new URL('../test-results/inventory-chest.png', import.meta.url).pathname,
  });
  await move('container', 0, 'bag', 0, true);
  crafted = await debug();
  assert.equal(crafted.inventory.bag[0].count, 63);
  assert.ok(crafted.inventory.container.slots.every((stack: any) => stack === null));
  console.log('Reconnecting with an open inventory without resubmitting mutations');
  await page.evaluate(() => (window as any).voxel.command({ type: 'reconnect' }));
  await playing();
  const reconnected = await debug();
  assert.ok(reconnected.epoch > crafted.epoch);
  assert.equal(reconnected.inventoryOpen, false);
  assert.equal(reconnected.inventoryPending, false);
  assert.equal(reconnected.inventory.station, 'personal');
  for (const field of ['revision', 'bag', 'craft2', 'craft3', 'equipment'])
    assert.deepEqual(reconnected.inventory[field], crafted.inventory[field], field);
  await page.evaluate(() => {
    (window as any).voxel.dispose();
    (window as any).voxel.dispose();
  });
  await page.waitForTimeout(650);
  const cleanup = await debug();
  assert.deepEqual(cleanup.resources, { geometries: 0, textures: 0, workers: 0 });
  assert.equal(cleanup.audio.contexts, 0);
  assert.equal(cleanup.audio.voices, 0);
  assert.equal(await page.locator('.voxel-inventory').count(), 0);
  assert.equal(await page.locator('#inventory-open').count(), 0);
  assert.deepEqual(errors, []);
  writeFileSync(
    resultFile,
    JSON.stringify(
      {
        result: 'PASS',
        scope:
          'Built Hebrew inventory UI, trusted touch resume/open, normal pointer slot moves and public authoritative building controls; 2x2/3x3 crafting, equipment, local freeze with continuing room time, reconnect and teardown; software Chromium only',
        buildId: build.buildId,
        engineHash: build.engineHash,
        contentHash: content.hash,
        browser: browser.version(),
        crafted: {
          inventory: crafted.inventory,
          body: crafted.body,
          environment: crafted.environment,
        },
        reconnected: { inventory: reconnected.inventory, epoch: reconnected.epoch },
        cleanup: { ...cleanup.resources, audio: cleanup.audio },
        errors,
      },
      null,
      2,
    ) + '\n',
  );
  console.log('Inventory, crafting, equipment, reconnect and teardown pass');
} finally {
  clearTimeout(deadline);
  await browser.close();
  await gateway.close();
}
