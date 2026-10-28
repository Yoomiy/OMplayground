import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createBuiltHarness, launchSoftwareBrowser } from './browser-harness.ts';
import type { ItemDefinition } from '../src/shared/content.ts';
import { ingredientMatches } from '../src/shared/recipes.ts';
import { DAY_TICKS } from '../src/shared/environment.ts';
import { verifyRemoteEquipment } from './browser-remote-equipment.ts';
const tntScenario = process.env.VOXEL_SURVIVAL_TNT === '1';
const equipmentScenario = process.env.VOXEL_SURVIVAL_EQUIPMENT === '1';
const resourceScenario = tntScenario || equipmentScenario;
const { gateway, origin, build, content } = await createBuiltHarness({
  mode: 'survival',
  initialTick: equipmentScenario ? DAY_TICKS / 2 : 0,
});
const itemDefinitions = new Map<string, ItemDefinition>(
  content.items.map((item: ItemDefinition) => [item.itemType, item]),
);
const matches = (kind: string, actual: string | null | undefined) =>
  ingredientMatches(kind, actual ?? null, itemDefinitions);
const browser = await launchSoftwareBrowser(),
  errors: string[] = [];
const resultFile = new URL(
  equipmentScenario
    ? '../test-results/browser-equipment.json'
    : tntScenario
      ? '../test-results/browser-tnt.json'
      : '../test-results/browser-survival.json',
  import.meta.url,
);
rmSync(resultFile, { force: true });
const deadline = setTimeout(
  () => {
    console.error(`Survival scenario exceeded ${equipmentScenario ? 285 : 240} seconds`);
    void browser.close();
  },
  equipmentScenario ? 285000 : 240000,
);
try {
  const context = await browser.newContext({
    viewport: { width: 800, height: 650 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  const movementBaselines: { epoch: number; movement: { speed: number; jump: number } }[] = [];
  page.on('websocket', (socket) =>
    socket.on('framereceived', (frame) => {
      if (typeof frame.payload !== 'string') return;
      const message = JSON.parse(frame.payload);
      if (message.type === 'baseline') {
        movementBaselines.push({ epoch: message.epoch, movement: message.movement });
        if (movementBaselines.length > 100) movementBaselines.shift();
      }
    }),
  );
  page.setDefaultTimeout(20000);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (event) => {
    if (event.type() === 'error') errors.push(event.text());
  });
  await page.goto(`${origin}/?room=survival-${randomUUID()}&quality=low`, {
    waitUntil: 'domcontentloaded',
  });
  const debug = () => page.evaluate(() => (window as any).voxel.debug());
  const command = (value: unknown) =>
    page.evaluate((command) => (window as any).voxel.command(command), value);
  const ready = () =>
    page.waitForFunction(
      () => {
        const d = (window as any).voxel?.debug();
        return (
          d?.phase === 'playing' &&
          d.collisionColumns === 49 &&
          d.activeJobs === 0 &&
          d.meshed >= 25
        );
      },
      null,
      { timeout: 60000 },
    );
  await ready();
  const initial = await debug();
  assert.equal(initial.mode, 'survival');
  assert.equal(initial.vitals.health, 20);
  assert.equal(initial.vitals.food, 20);
  assert.equal(
    await page.locator('.voxel-touch-actions button:has-text("תעופה")').isVisible(),
    false,
  );
  assert.ok(initial.inventory.bag.every((stack: unknown) => stack === null));
  assert.equal(initial.inventory.catalog, false);
  await page.locator('#inventory-open').tap();
  await page.waitForFunction(
    () =>
      (window as any).voxel.debug().inventoryOpen &&
      !(window as any).voxel.debug().inventoryPending,
  );
  assert.equal(await page.locator('#inventory-catalog').count(), 0);
  await page.keyboard.press('Escape');
  await page.waitForFunction(
    () =>
      !(window as any).voxel.debug().inventoryOpen &&
      !(window as any).voxel.debug().inventoryPending,
  );
  await page.locator('#resume').tap();
  await page.waitForFunction(() => (window as any).voxel.debug().body?.frozen === 0);
  await page.waitForFunction(() => (window as any).voxel.debug().body?.onGround === 1);
  const cdp = await context.newCDPSession(page);
  const point = (x: number, y: number) => ({ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 });
  const look = async (yaw: number, pitch: number) => {
    const after = await page.evaluate(
      ({ yaw, pitch }) => {
        const own = (window as any).voxel.debug();
        (window as any).voxel.command({
          type: 'look',
          dx: (yaw - own.view.yaw) / 0.002,
          dy: (own.view.pitch - pitch) / 0.002,
        });
        return performance.now();
      },
      { yaw, pitch },
    );
    await page.waitForFunction((after) => {
      const d = (window as any).voxel.debug();
      return d.lastUpdate > after && d.lastFrame > after;
    }, after);
  };
  const amount = (d: any, kind: string) =>
    d.inventory.bag.reduce(
      (sum: number, stack: any) => sum + (matches(kind, stack?.itemType) ? stack.count : 0),
      0,
    );
  const neutral = { type: 'touch', x: 0, z: 0, jump: false, sneak: false, sprint: false };
  const harvested = [];
  const cleared = [];
  let originalTree: number[] | null = null;
  const mineCell = async (cell: number[]) => {
    const rect = await page.locator('.voxel-touch-actions button:has-text("כרייה")').boundingBox();
    assert.ok(rect);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [point(rect.x + rect.width / 2, rect.y + rect.height / 2)],
    });
    try {
      const started = performance.now();
      let completed = false;
      while (performance.now() - started < 20000) {
        const d = await debug();
        if (
          d.recentEdits.some(
            (edit: any) => edit.state === 0 && JSON.stringify(edit.cell) === JSON.stringify(cell),
          )
        ) {
          completed = true;
          break;
        }
        if (JSON.stringify(d.target) !== JSON.stringify(cell)) {
          const dx = cell[0] + 0.5 - d.position[0],
            dz = cell[2] + 0.5 - d.position[2],
            dy = cell[1] + 0.5 - d.position[1] - 1.62;
          await look(Math.atan2(dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)));
        }
        await page.waitForTimeout(100);
      }
      assert.ok(completed, `held mining must remove ${cell.join(',')}`);
    } catch (error) {
      console.error('Held mining diagnostics', JSON.stringify(await debug()));
      throw error;
    } finally {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
  };
  mkdirSync(new URL('../test-results/', import.meta.url), { recursive: true });
  for (let n = 0; n < (equipmentScenario ? 9 : tntScenario ? 6 : 5); n++) {
    if (amount(await debug(), '#logs') >= n + 1) continue;
    console.log(`Harvesting natural log ${n + 1} with actual held touch input`);
    let chosen: any = null;
    if (originalTree) {
      const trunk = equipmentScenario && n >= 6 ? [47, 68, -3] : originalTree;
      const level = equipmentScenario && n >= 6 ? n - 6 : n;
      for (let obstruction = 0; obstruction < 6; obstruction++) {
        const own = await debug(),
          target = [trunk[0] + 0.5, trunk[1] + level + 0.5, trunk[2] + 0.5];
        const dx = target[0] - own.position[0],
          dz = target[2] - own.position[2],
          dy = target[1] - own.position[1] - 1.62;
        await look(Math.atan2(dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)));
        const aimed = await debug(),
          family = content.blocks[aimed.targetState]?.name;
        if (
          matches('#logs', family) &&
          aimed.target[0] === trunk[0] &&
          aimed.target[2] === trunk[2]
        ) {
          chosen = aimed;
          break;
        }
        assert.ok(
          ['#leaves', 'short_grass', 'grass_block', 'dirt'].some((kind) => matches(kind, family)),
          `natural trunk must be reachable through removable foliage/soil: ${JSON.stringify(aimed)}`,
        );
        await mineCell(aimed.target);
        cleared.push({ cell: aimed.target, family });
      }
    }
    outer: for (const pitch of originalTree ? [] : [-0.65, -0.4, -0.2, 0])
      for (const yaw of [-Math.PI / 2, 0, Math.PI / 2, Math.PI]) {
        await look(yaw, pitch);
        const d = await debug();
        if (
          d.target &&
          matches('#logs', content.blocks[d.targetState]?.name) &&
          (n !== 0 || d.target[1] <= Math.floor(d.position[1]))
        ) {
          chosen = d;
          break outer;
        }
      }
    assert.ok(chosen, `natural spawn needs an accessible log: ${JSON.stringify(await debug())}`);
    originalTree ??= [...chosen.target];
    await mineCell(chosen.target);
    const dropStarted = performance.now();
    let visible: any = null;
    let pickupProgress = { at: performance.now(), position: [...chosen.position] };
    let pickupObstructions = 0;
    while (amount(await debug(), '#logs') < n + 1 && performance.now() - dropStarted < 12000) {
      const d = await debug(),
        drop = d.drops.find((drop: any) => matches('#logs', drop.stack.itemType));
      if (drop) {
        if (!visible && d.feedback.drops.visible > 0) {
          visible = { drop, origin: d.renderOrigin, feedback: d.feedback.drops };
          if (n === 0)
            await page.screenshot({
              path: new URL('../test-results/survival-drop.png', import.meta.url).pathname,
            });
        }
        const dx = drop.position[0] - d.position[0],
          dz = drop.position[2] - d.position[2];
        await look(Math.atan2(dx, -dz), -0.1);
        if (
          Math.hypot(
            d.position[0] - pickupProgress.position[0],
            d.position[2] - pickupProgress.position[2],
          ) > 0.1
        ) {
          pickupProgress = { at: performance.now(), position: [...d.position] };
        } else if (performance.now() - pickupProgress.at > 750 && pickupObstructions < 6) {
          const aimed = await debug(),
            family = content.blocks[aimed.targetState]?.name;
          if (
            aimed.target &&
            ['#logs', '#leaves', 'short_grass'].some((kind) => matches(kind, family))
          ) {
            await command(neutral);
            console.log(`Mining natural pickup obstruction at ${aimed.target.join(',')}`);
            await mineCell(aimed.target);
            cleared.push({ cell: aimed.target, family, purpose: 'pickup' });
            pickupObstructions++;
          }
          pickupProgress = { at: performance.now(), position: [...(await debug()).position] };
        }
        await command({
          ...neutral,
          z: Math.hypot(dx, dz) > 0.08 ? -Math.min(1, Math.hypot(dx, dz) / 1.5) : 0,
          jump: drop.position[1] > d.position[1] + 0.5 && d.body.onGround === 1,
        });
      }
      await page.waitForTimeout(100);
    }
    await command(neutral);
    await page.waitForFunction(() => {
      const body = (window as any).voxel.debug().body;
      return body.onGround === 1 && Math.hypot(body.velocity[0], body.velocity[2]) < 0.03;
    });
    const collected = await debug();
    assert.ok(amount(collected, '#logs') >= n + 1, JSON.stringify(collected));
    harvested.push({
      target: chosen.target,
      visible,
      inventoryRevision: collected.inventory.revision,
    });
  }
  let foliage: any = null;
  if (!tntScenario) {
    console.log('Harvesting nearby natural foliage for an owned apple');
    do {
      const beforeFood = await debug(),
        beforeLeaves = amount(beforeFood, '#leaves'),
        beforeApples = amount(beforeFood, 'apple');
      foliage = null;
      let closestFoliage = Infinity;
      foliageSearch: for (const pitch of [-0.15, 0, 0.2, 0.4])
        for (let n = 0; n < 16; n++) {
          await look((n * Math.PI) / 8, pitch);
          const d = await debug();
          if (
            d.target &&
            matches('#leaves', content.blocks[d.targetState]?.name) &&
            d.target[1] <= Math.floor(d.position[1]) + 2
          ) {
            const distance = Math.hypot(
              d.target[0] + 0.5 - d.position[0],
              d.target[1] + 0.5 - d.position[1] - 0.9,
              d.target[2] + 0.5 - d.position[2],
            );
            if (distance < closestFoliage) {
              foliage = d;
              closestFoliage = distance;
            }
            if (!equipmentScenario || distance < 1.7) break foliageSearch;
          }
        }
      assert.ok(foliage, `nearby low foliage must be reachable: ${JSON.stringify(await debug())}`);
      await mineCell(foliage.target);
      const foodStarted = performance.now();
      while (
        (amount(await debug(), 'apple') < beforeApples + 1 ||
          amount(await debug(), '#leaves') < beforeLeaves + 1) &&
        performance.now() - foodStarted < 15000
      ) {
        const d = await debug(),
          drop = d.drops
            .filter(
              (drop: any) =>
                (drop.stack.itemType === 'apple' && amount(d, 'apple') < beforeApples + 1) ||
                (matches('#leaves', drop.stack.itemType) &&
                  amount(d, '#leaves') < beforeLeaves + 1),
            )
            .sort(
              (a: any, b: any) =>
                Math.hypot(
                  a.position[0] - d.position[0],
                  a.position[1] - d.position[1] - 0.9,
                  a.position[2] - d.position[2],
                ) -
                Math.hypot(
                  b.position[0] - d.position[0],
                  b.position[1] - d.position[1] - 0.9,
                  b.position[2] - d.position[2],
                ),
            )[0];
        if (drop) {
          const dx = drop.position[0] - d.position[0],
            dz = drop.position[2] - d.position[2];
          await look(Math.atan2(dx, -dz), -0.1);
          await command({
            ...neutral,
            z: Math.hypot(dx, dz) > 0.08 ? -Math.min(1, Math.hypot(dx, dz) / 1.5) : 0,
            jump: drop.position[1] > d.position[1] + 0.5 && d.body.onGround === 1,
          });
        }
        await page.waitForTimeout(100);
      }
      await command(neutral);
      await page.waitForFunction(() => {
        const b = (window as any).voxel.debug().body;
        return b.onGround === 1 && Math.hypot(b.velocity[0], b.velocity[2]) < 0.03;
      });
      assert.ok(
        amount(await debug(), '#leaves') >= beforeLeaves + 1,
        JSON.stringify(await debug()),
      );
    } while (equipmentScenario && amount(await debug(), '#leaves') < 6);
  }
  const apples = amount(await debug(), 'apple');
  if (!tntScenario) assert.ok(apples >= 1, JSON.stringify(await debug()));
  console.log(
    resourceScenario
      ? 'Crafting owned logs into a workbench, sticks and pickaxe'
      : 'Crafting owned logs into a workbench, sticks, pickaxe, trail boots and heavy shield',
  );
  await page.locator('#inventory-open').tap();
  await page.waitForFunction(() => {
    const d = (window as any).voxel.debug();
    return d.inventoryOpen && !d.inventoryPending && d.body.frozen === 1;
  });
  const settled = () => page.waitForFunction(() => !(window as any).voxel.debug().inventoryPending);
  const move = async (from: string, slot: number, to: string, target: number, one = false) => {
    const revision = (await debug()).inventory.revision;
    await page.locator(`[data-area="${from}"][data-slot="${slot}"]`).click();
    await page
      .locator(`[data-area="${to}"][data-slot="${target}"]`)
      .click({ button: one ? 'right' : 'left' });
    await page.waitForFunction(
      (revision) => (window as any).voxel.debug().inventory.revision > revision,
      revision,
    );
    await settled();
  };
  const craft = async () => {
    const revision = (await debug()).inventory.revision;
    await page.locator('#inventory-craft').tap();
    await page.waitForFunction(
      (revision) => (window as any).voxel.debug().inventory.revision > revision,
      revision,
    );
    await settled();
  };
  const index = async (kind: string) =>
    (await debug()).inventory.bag.findIndex((stack: any) => matches(kind, stack?.itemType));
  let remoteEquipment: Awaited<ReturnType<typeof verifyRemoteEquipment>> | null = null;
  const checkRemoteEquipment = async () => {
    const free = (await debug()).inventory.bag.findIndex((stack: any) => stack === null);
    assert.ok(free >= 0);
    remoteEquipment = await verifyRemoteEquipment(
      browser,
      page,
      errors,
      async () => {
        await page.locator('#inventory-open').tap();
        await settled();
        await page.waitForFunction(() => (window as any).voxel.debug().inventoryOpen);
        await move('equipment', 3, 'bag', free);
      },
      async () => {
        await move('bag', free, 'equipment', 3);
        await page.keyboard.press('Escape');
        await settled();
        await page.locator('#resume').tap();
        await page.waitForFunction(() => (window as any).voxel.debug().body.frozen === 0);
      },
      new URL(
        equipmentScenario
          ? '../test-results/remote-equipment-night.png'
          : '../test-results/remote-equipment-survival.png',
        import.meta.url,
      ).pathname,
    );
  };
  const putInHotbar = async (kind: string, target: number) => {
    const slot = await index(kind);
    assert.ok(slot >= 0, `owned hotbar item ${kind}`);
    if (slot !== target) await move('bag', slot, 'bag', target);
    return target;
  };
  await move('bag', await index('#logs'), 'craft2', 0);
  await craft();
  await craft();
  await craft();
  await craft();
  await craft();
  assert.equal(amount(await debug(), '#planks'), 20);
  if ((await debug()).inventory.craft2[0])
    await move(
      'craft2',
      0,
      'bag',
      await page.evaluate(() =>
        (window as any).voxel.debug().inventory.bag.findIndex((stack: any) => !stack),
      ),
    );
  for (const slot of [0, 1, 2, 3]) await move('bag', await index('#planks'), 'craft2', slot, true);
  await craft();
  const tableSlot = await index('crafting_table');
  assert.ok(tableSlot >= 0 && tableSlot < 9);
  for (const slot of [0, 2]) await move('bag', await index('#planks'), 'craft2', slot, true);
  await craft();
  assert.equal(amount(await debug(), 'stick'), 4);
  await page.keyboard.press('Escape');
  await settled();
  await page.locator('#resume').tap();
  await page.waitForFunction(() => (window as any).voxel.debug().body?.frozen === 0);
  await command({ type: 'select-slot', slot: tableSlot });
  await page.waitForFunction(
    (slot) =>
      (window as any).voxel.debug().selectedSlot === slot &&
      !(window as any).voxel.debug().inventoryPending,
    tableSlot,
  );
  let placement: any = null;
  outer: for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2])
    for (const pitch of [-0.7, -1]) {
      await look(yaw, pitch);
      const d = await debug();
      if (!d.target || d.targetNormal?.[1] !== 1) continue;
      await command({ type: 'interact', kind: 'place' });
      const sequence = d.lastResult?.sequence ?? 0;
      await page.waitForFunction(
        (sequence) => ((window as any).voxel.debug().lastResult?.sequence ?? 0) > sequence,
        sequence,
      );
      const after = await debug();
      if (after.lastResult.outcome?.ok && after.lastResult.outcome.reason === 'edited') {
        placement = after.lastResult;
        break outer;
      }
    }
  assert.ok(placement, `owned workbench placement: ${JSON.stringify(await debug())}`);
  assert.equal(amount(await debug(), 'crafting_table'), 0);
  await page.waitForFunction(
    (cell) => JSON.stringify((window as any).voxel.debug().target) === JSON.stringify(cell),
    placement.outcome.cell,
  );
  await page.locator('#inventory-open').tap();
  await page.waitForFunction(() => {
    const d = (window as any).voxel.debug();
    return !d.inventoryPending && d.body.frozen === 1 && d.lastResult?.outcome?.reason === 'opened';
  });
  await page.locator('#inventory-use').tap();
  await page.waitForFunction(() => (window as any).voxel.debug().inventory.station === 'workbench');
  await settled();
  for (const slot of [0, 1, 2]) await move('bag', await index('#planks'), 'craft3', slot, true);
  for (const slot of [4, 7]) await move('bag', await index('stick'), 'craft3', slot, true);
  await craft();
  const pickaxeSlot = await index('wooden_pickaxe');
  assert.equal((await debug()).inventory.bag[pickaxeSlot].instance.durability, 60);
  if (!resourceScenario) {
    for (const slot of [0, 2, 3, 5])
      await move('bag', await index('#planks'), 'craft3', slot, true);
    await craft();
    const beforeEquip = await debug();
    await move('bag', await index('trail_boots'), 'equipment', 3);
    await page.waitForFunction(
      (epoch) => (window as any).voxel.debug().epoch > epoch,
      beforeEquip.epoch,
    );
    assert.equal((await debug()).inventory.equipment[3].itemType, 'trail_boots');
    for (const slot of [0, 2, 3, 4, 5, 7])
      await move('bag', await index('#planks'), 'craft3', slot, true);
    await move('bag', await index('stick'), 'craft3', 1, true);
    await craft();
    const beforeShield = await debug();
    await move('bag', await index('heavy_shield'), 'equipment', 4);
    await page.waitForFunction(
      (epoch) => (window as any).voxel.debug().epoch > epoch,
      beforeShield.epoch,
    );
    assert.equal((await debug()).inventory.equipment[4].itemType, 'heavy_shield');
  }
  if (!tntScenario) {
    const appleSlot = await index('apple');
    await page.locator(`[data-area="bag"][data-slot="${appleSlot}"]`).click();
    assert.equal(
      await page.locator('#inventory-eat').isDisabled(),
      (await debug()).vitals.food === 20,
    );
  }
  let hungry: any = null;
  if (!resourceScenario) {
    console.log('Waiting for simulation-time hunger while the personal inventory remains open');
    await page.waitForFunction(() => (window as any).voxel.debug().vitals.food < 20, null, {
      timeout: 125000,
    });
    hungry = await debug();
    assert.equal(hungry.body.frozen, 1);
    await page.waitForFunction(
      () => !(document.querySelector('#inventory-eat') as HTMLButtonElement).disabled,
    );
    await page.locator('#inventory-eat').click();
    await page.waitForFunction(() => (window as any).voxel.debug().vitals.food === 20);
    await settled();
    assert.equal(amount(await debug(), 'apple'), apples - 1);
  }
  await page.screenshot({
    path: new URL('../test-results/survival-crafting.png', import.meta.url).pathname,
  });
  await page.keyboard.press('Escape');
  await settled();
  await page.locator('#resume').tap();
  await page.waitForFunction(() => (window as any).voxel.debug().body?.frozen === 0);
  await command({ type: 'select-slot', slot: pickaxeSlot });
  await page.waitForFunction(
    () => (window as any).voxel.debug().feedback.held.itemType === 'wooden_pickaxe',
  );
  await page.screenshot({
    path: new URL('../test-results/survival-tool.png', import.meta.url).pathname,
  });
  let explosive: any = null;
  let equipment: any = null;
  if (!resourceScenario) await checkRemoteEquipment();
  if (resourceScenario) {
    console.log('Gathering natural shore sand and shallow river stone with owned tools');
    const aimCell = async (cell: number[], clearSand = false) => {
      const started = performance.now();
      let obstructions = 0;
      do {
        const d = await debug(),
          dx = cell[0] + 0.5 - d.position[0],
          dy = cell[1] + 0.5 - d.position[1] - 1.62,
          dz = cell[2] + 0.5 - d.position[2];
        await look(Math.atan2(dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)));
        const aimed = await debug();
        if (JSON.stringify(aimed.target) === JSON.stringify(cell)) return;
        if (clearSand && obstructions < 3 && content.blocks[aimed.targetState]?.name === 'sand') {
          console.log(`Clearing natural sand occlusion at ${aimed.target.join(',')}`);
          await mineCell(aimed.target);
          resources.push({ cell: aimed.target, kind: 'sand', purpose: 'occlusion' });
          obstructions++;
        }
        await page.waitForTimeout(100);
      } while (performance.now() - started < (clearSand ? 15000 : 6000));
      const d = await debug();
      console.error(
        'Resource aim diagnostics',
        JSON.stringify({
          cell,
          position: d.position,
          body: d.body,
          target: d.target,
          targetFamily: content.blocks[d.targetState]?.name,
          view: d.view,
          status: d.status,
        }),
      );
      throw new Error(`natural resource is occluded: ${cell.join(',')}`);
    };
    const walkTo = async (x: number, z: number, swim = false) => {
      const started = performance.now();
      let lastJump = false;
      let previousDistance = Infinity;
      let clearedTravel = 0;
      while (performance.now() - started < 30000) {
        const d = await debug(),
          dx = x - d.position[0],
          dz = z - d.position[2];
        const distance = Math.hypot(dx, dz);
        if (distance < 0.7) {
          await command(neutral);
          await page.waitForTimeout(700);
          const settled = await debug();
          if (Math.hypot(x - settled.position[0], z - settled.position[2]) < 1) return;
          previousDistance = Infinity;
          continue;
        }
        await look(Math.atan2(dx, -dz), -0.3);
        const ahead = await debug(),
          obstruction = content.blocks[ahead.targetState]?.name;
        if (
          previousDistance - distance < 0.04 &&
          ['#leaves', 'short_grass'].some((kind) => matches(kind, obstruction)) &&
          clearedTravel < 6
        ) {
          await command(neutral);
          await mineCell(ahead.target);
          cleared.push({ cell: ahead.target, family: obstruction, purpose: 'travel' });
          clearedTravel++;
          previousDistance = Infinity;
          continue;
        }
        lastJump =
          swim && d.body.inWater === 1
            ? true
            : d.body.onGround === 1 && previousDistance - distance < 0.04
              ? !lastJump
              : false;
        previousDistance = distance;
        await command({ ...neutral, z: -Math.min(1, distance / 3), jump: lastJump });
        await page.waitForTimeout(180);
      }
      await command(neutral);
      await page.waitForTimeout(600);
      const d = await debug();
      assert.ok(
        Math.hypot(x - d.position[0], z - d.position[2]) < 1.2,
        `resource travel: ${JSON.stringify(d)}`,
      );
    };
    const collect = async (kind: string, count: number) => {
      console.log(`Collecting ${count} owned ${kind} from natural drops`);
      const started = performance.now();
      while (amount(await debug(), kind) < count && performance.now() - started < 15000) {
        const d = await debug(),
          drop = d.drops.find((drop: any) => drop.stack.itemType === kind);
        if (drop) {
          const dx = drop.position[0] - d.position[0],
            dz = drop.position[2] - d.position[2];
          await look(Math.atan2(dx, -dz), -0.7);
          await command({
            ...neutral,
            z: Math.hypot(dx, dz) > 0.08 ? -Math.min(1, Math.hypot(dx, dz) / 1.5) : 0,
          });
        }
        await page.waitForTimeout(150);
      }
      await command(neutral);
      assert.ok(
        amount(await debug(), kind) >= count,
        `natural ${kind} pickup: ${JSON.stringify(await debug())}`,
      );
    };
    await walkTo(46.5, 8.5);
    const resources = [];
    for (const cell of [
      [46, 63, 7],
      [45, 63, 7],
      [44, 63, 7],
      [43, 63, 7],
    ]) {
      await aimCell(cell);
      assert.equal(content.blocks[(await debug()).targetState].name, 'sand');
      await mineCell(cell);
      resources.push({ cell, kind: 'sand' });
    }
    await collect('sand', 4);
    await walkTo(44.5, 11.5, true);
    for (const cell of [
      [43, 60, 12],
      [44, 60, 13],
      [45, 60, 13],
    ]) {
      await aimCell(cell, true);
      assert.equal(content.blocks[(await debug()).targetState].name, 'stone');
      await mineCell(cell);
      resources.push({ cell, kind: 'stone' });
    }
    await collect('stone', 3);
    // Surface using the same held jump controls available to touch players.
    await command({ ...neutral, jump: true });
    await page.waitForTimeout(1500);
    await command(neutral);
    await walkTo(placement.outcome.cell[0] + 0.5, placement.outcome.cell[2] + 1.5, true);
    await aimCell(placement.outcome.cell);
    await page.locator('#inventory-open').tap();
    await page.waitForFunction(
      () =>
        (window as any).voxel.debug().inventoryOpen &&
        !(window as any).voxel.debug().inventoryPending,
    );
    for (let n = 0; n < (equipmentScenario ? 4 : 1); n++) {
      await move('bag', await index('#logs'), 'craft2', 0, true);
      await move('bag', await index('#planks'), 'craft2', 1, true);
      await craft();
    }
    assert.equal(amount(await debug(), 'charcoal'), equipmentScenario ? 8 : 2);
    if (equipmentScenario) {
      console.log('Crafting all five owned equipment capabilities through the ordinary workbench');
      for (const slot of [0, 2]) await move('bag', await index('#planks'), 'craft2', slot, true);
      await craft();
      await page.locator('#inventory-use').tap();
      await page.waitForFunction(
        () => (window as any).voxel.debug().inventory.station === 'workbench',
      );
      await settled();
      const craftItem = async (kind: string, ingredients: Record<string, number[]>) => {
        for (const [ingredient, slots] of Object.entries(ingredients))
          for (const slot of slots)
            await move('bag', await index(ingredient), 'craft3', slot, true);
        await craft();
        assert.equal(amount(await debug(), kind), 1);
        const help: Record<string, string> = {
          swift_pickaxe: 'נבחר בסרגל',
          feather_talisman: 'חסינות לנזק נפילה',
          helios_medallion: 'ריפוי באור שמש',
          helium_boots: 'עוצמת קפיצה',
          glow_talisman: 'ראייה משופרת',
        };
        assert.ok(
          (
            await page
              .locator(`[data-area="bag"][data-slot="${await index(kind)}"]`)
              .getAttribute('title')
          )?.includes(help[kind]),
          `equipment effect description: ${kind}`,
        );
      };
      await craftItem('swift_pickaxe', { stone: [0, 1, 2], stick: [4, 7], charcoal: [6, 8] });
      await craftItem('feather_talisman', { '#leaves': [1, 3, 5, 7], apple: [4] });
      await move('bag', await index('feather_talisman'), 'equipment', 2);
      await craftItem('helios_medallion', { sand: [1, 3, 5, 7], charcoal: [4] });
      await move('bag', await index('helios_medallion'), 'equipment', 0);
      await craftItem('helium_boots', { '#planks': [0, 2, 3, 5], '#leaves': [6, 8] });
      await move('bag', await index('helium_boots'), 'equipment', 3);
      await craftItem('glow_talisman', { charcoal: [1, 3, 5, 7], stick: [4] });
      const crafted = await debug();
      const profile = async (key: 'speed' | 'jump', value: number) => {
        const started = performance.now();
        while (
          movementBaselines.at(-1)?.movement[key] !== value &&
          performance.now() - started < 5000
        )
          await page.waitForTimeout(50);
        assert.equal(movementBaselines.at(-1)?.movement[key], value);
        return movementBaselines.at(-1);
      };
      await profile('jump', 1.6);
      await page.keyboard.press('Escape');
      await settled();
      const brightness = () =>
        page.evaluate(
          () =>
            new Promise<number>((resolve, reject) => {
              let attempts = 0;
              const sample = () => {
                const canvas = document.querySelector('canvas')!,
                  gl = canvas.getContext('webgl2')!;
                const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
                gl.readPixels(
                  0,
                  0,
                  gl.drawingBufferWidth,
                  gl.drawingBufferHeight,
                  gl.RGBA,
                  gl.UNSIGNED_BYTE,
                  pixels,
                );
                let sum = 0;
                for (let i = 0; i < pixels.length; i += 4)
                  sum += pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 + pixels[i + 2] * 0.0722;
                if (sum > 0) resolve(sum / (pixels.length / 4));
                else if (++attempts < 30) requestAnimationFrame(sample);
                else reject(new Error('no rendered framebuffer for visibility check'));
              };
              requestAnimationFrame(sample);
            }),
        );
      await page.waitForFunction(() => (window as any).voxel.debug().feedback.vision === false);
      const dark = await debug(),
        beforeBrightness = await brightness();
      assert.ok(dark.environment.daylight < 0.1);
      await page.screenshot({
        path: new URL('../test-results/equipment-night-before.png', import.meta.url).pathname,
      });
      await page.locator('#inventory-open').tap();
      await page.waitForFunction(
        () =>
          (window as any).voxel.debug().inventoryOpen &&
          !(window as any).voxel.debug().inventoryPending,
      );
      await move('bag', await index('glow_talisman'), 'equipment', 0);
      await putInHotbar('swift_pickaxe', 8);
      await page.keyboard.press('Escape');
      await settled();
      await page.waitForFunction(() => (window as any).voxel.debug().feedback.vision === true);
      const lit = await debug(),
        afterBrightness = await brightness();
      assert.ok(
        afterBrightness > beforeBrightness * 1.25,
        JSON.stringify({ beforeBrightness, afterBrightness }),
      );
      assert.deepEqual(lit.position, dark.position);
      assert.ok(lit.environment.daylight < 0.1);
      await page.screenshot({
        path: new URL('../test-results/equipment-night-after.png', import.meta.url).pathname,
      });
      await page.locator('#resume').tap();
      await page.waitForFunction(() => (window as any).voxel.debug().body.frozen === 0);
      await command({ type: 'select-slot', slot: await index('swift_pickaxe') });
      await settled();
      const swiftProfile = await profile('speed', 1.5);
      await checkRemoteEquipment();
      await walkTo(46.5, 8.5, true);
      await page.waitForFunction(() => {
        const d = (window as any).voxel.debug();
        return d.body.onGround === 1 && d.body.inWater === 0;
      });
      const beforeJump = await debug();
      await page.evaluate(() => {
        const trace = { peak: (window as any).voxel.debug().position[1], done: false, samples: 0 };
        (window as any).equipmentJump = trace;
        const sample = () => {
          trace.samples++;
          trace.peak = Math.max(trace.peak, (window as any).voxel.debug().position[1]);
          if (!trace.done) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      await page.locator('.voxel-touch-actions button:has-text("קפיצה")').tap();
      await page.waitForTimeout(1800);
      const jump = await page.evaluate(() => {
        const t = (window as any).equipmentJump;
        t.done = true;
        return t;
      });
      assert.ok(
        jump.peak > beforeJump.position[1] + 2,
        JSON.stringify({ beforeJump, jump, after: await debug() }),
      );
      const afterJump = await debug();
      assert.equal(
        afterJump.inventory.equipment[3].instance.durability,
        beforeJump.inventory.equipment[3].instance.durability - 1,
      );
      equipment = {
        resources,
        crafted: crafted.inventory,
        swiftProfile,
        jump: { ...jump, from: beforeJump.position, boots: afterJump.inventory.equipment[3] },
        visibility: {
          beforeBrightness,
          afterBrightness,
          before: dark.environment,
          after: lit.environment,
          position: lit.position,
        },
        movementBaselines,
      };
    } else {
      for (let n = 0; n < 2; n++) {
        await move('bag', await index('charcoal'), 'craft2', 0, true);
        await move('bag', await index('stone'), 'craft2', 1, true);
        await craft();
      }
      assert.equal(amount(await debug(), 'gunpowder'), 6);
      await move('bag', await index('stone'), 'craft2', 0, true);
      await move('bag', await index('stick'), 'craft2', 1, true);
      await craft();
      assert.equal(
        (await debug()).inventory.bag[await index('firestarter')].instance.durability,
        64,
      );
      await page.locator('#inventory-use').tap();
      await page.waitForFunction(
        () => (window as any).voxel.debug().inventory.station === 'workbench',
      );
      await settled();
      for (const slot of [0, 2, 4, 6, 8])
        await move('bag', await index('gunpowder'), 'craft3', slot, true);
      for (const slot of [1, 3, 5, 7]) await move('bag', await index('sand'), 'craft3', slot, true);
      await craft();
      assert.equal(amount(await debug(), 'tnt'), 1);
      await putInHotbar('firestarter', 7);
      await putInHotbar('tnt', 8);
      await page.keyboard.press('Escape');
      await settled();
      await page.locator('#resume').tap();
      await page.waitForFunction(() => (window as any).voxel.debug().body.frozen === 0);
      await command({ type: 'select-slot', slot: await index('tnt') });
      await settled();
      let placed: any = null;
      outerTnt: for (const yaw of [Math.PI / 2, Math.PI, -Math.PI / 2, 0])
        for (const pitch of [-0.7, -1]) {
          await look(yaw, pitch);
          const d = await debug();
          if (d.targetNormal?.[1] !== 1) continue;
          await command({ type: 'interact', kind: 'place' });
          await page.waitForFunction(
            (sequence) => ((window as any).voxel.debug().lastResult?.sequence ?? 0) > sequence,
            d.lastResult?.sequence ?? 0,
          );
          const after = await debug();
          if (after.lastResult.outcome?.ok) {
            placed = after.lastResult.outcome.cell;
            break outerTnt;
          }
        }
      assert.ok(placed, `owned TNT placement: ${JSON.stringify(await debug())}`);
      assert.equal(amount(await debug(), 'tnt'), 0);
      await aimCell(placed);
      await command({ type: 'select-slot', slot: await index('firestarter') });
      await settled();
      await page.locator('.voxel-touch-actions button:has-text("הצתה")').tap();
      await page.waitForFunction(() => {
        const d = (window as any).voxel.debug();
        return d.explosives.length > 0 && d.feedback.explosives.visible === 1;
      });
      const primed = await debug();
      assert.equal(primed.inventory.bag[await index('firestarter')].instance.durability, 63);
      assert.equal(primed.feedback.explosives.visible, 1);
      await page.screenshot({
        path: new URL('../test-results/tnt-fuse.png', import.meta.url).pathname,
      });
      await page.waitForFunction(() => (window as any).voxel.debug().lastExplosionEvent !== null);
      const after = await debug();
      assert.equal(after.lastExplosionEvent.cancelled, false);
      assert.ok(after.lastExplosionEvent.removed > 0);
      assert.equal(after.explosives.length, 0);
      assert.equal(after.feedback.effects.explosions, 1);
      assert.equal(
        after.feedback.effects.bursts - primed.feedback.effects.bursts,
        1 + after.feedback.effects.hits - primed.feedback.effects.hits,
        'one explosion effect and accepted hits, without one effect per destroyed block',
      );
      assert.ok(
        after.audio.effects > primed.audio.effects,
        'accepted explosion dispatches game audio',
      );
      await page.waitForFunction(() => {
        const d = (window as any).voxel.debug();
        return d.activeJobs === 0 && d.feedback.explosives.visible === 0;
      });
      await page.screenshot({
        path: new URL('../test-results/tnt-crater.png', import.meta.url).pathname,
      });
      explosive = {
        resources,
        placed,
        primed: { bodies: primed.explosives, feedback: primed.feedback, audio: primed.audio },
        event: after.lastExplosionEvent,
        feedback: after.feedback,
        audio: after.audio,
        vitals: after.vitals,
      };
    }
  }
  const completed = await debug();
  assert.equal(completed.inventory.catalog, false);
  assert.equal(completed.mode, 'survival');
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
  assert.deepEqual(errors, []);
  writeFileSync(
    resultFile,
    JSON.stringify(
      {
        result: 'PASS',
        scope: equipmentScenario
          ? 'Natural empty-inventory survival in a server-configured night: nine logs, leaves/apples, shore sand and river stone; owned crafting/equipping of Swift pickaxe, feather talisman, Helios medallion, helium boots and glow talisman; authoritative movement baselines, actual touch boosted jump and wear, real framebuffer night-visibility increase, unchanged room daylight/body position, and complete teardown; no creative grants, position/world injection or client clock overrides; software Chromium functional evidence only'
          : tntScenario
            ? 'Natural empty-inventory survival: six logs, shore sand and shallow river stone; owned pickaxe, charcoal, powder, firestarter and TNT crafting; consumed placement and actual touch ignition, fixed fuse, crater and teardown; no creative grants or test-only world mutations; software Chromium functional check only'
            : 'Natural empty-inventory survival with actual held touch mining, owned drops/pickups, 2x2/3x3 crafting, consumed workbench placement, held pickaxe, crafted/equipped trail boots and heavy shield, and a harvested apple eaten after real simulation-time hunger with inventory open; no creative grants or test-only world mutations; software Chromium functional check only',
        buildId: build.buildId,
        engineHash: build.engineHash,
        contentHash: content.hash,
        browser: browser.version(),
        harvested,
        cleared,
        placement,
        food: hungry
          ? { foliage: foliage.target, hungry: hungry.vitals, after: completed.vitals }
          : null,
        explosive,
        equipment,
        remoteEquipment,
        completed: {
          inventory: completed.inventory,
          feedback: completed.feedback,
          vitals: completed.vitals,
        },
        cleanup: { ...cleanup.resources, audio: cleanup.audio },
        errors,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    equipmentScenario
      ? 'Natural equipment gathering/crafting, authoritative profiles, boosted touch jump, local night visibility and teardown pass'
      : tntScenario
        ? 'Natural resource gathering, owned TNT/firestarter crafting, touch ignition, fixed fuse, crater, effects/audio and teardown pass'
        : 'Natural mining, pickups, owned crafting/placement, equipment and room-time food pass',
  );
} finally {
  clearTimeout(deadline);
  await browser.close();
  await gateway.close();
}
