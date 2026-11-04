import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import type { Page } from 'playwright';
import type { ContentManifest } from '../src/shared/content.ts';

type Journey = {
  page: Page;
  content: ContentManifest;
  debug: () => Promise<any>;
  command: (command: unknown) => Promise<unknown>;
  look: (yaw: number, pitch: number) => Promise<void>;
  mineCell: (cell: number[]) => Promise<void>;
  aimCell: (cell: number[], clearSand?: boolean) => Promise<void>;
  walkTo: (x: number, z: number, swim?: boolean) => Promise<void>;
  collect: (kind: string, count: number) => Promise<void>;
  move: (from: string, slot: number, to: string, target: number, one?: boolean) => Promise<void>;
  craft: () => Promise<void>;
  index: (kind: string) => Promise<number>;
  putInHotbar: (kind: string, target: number) => Promise<number>;
  settled: () => Promise<unknown>;
  amount: (state: any, kind: string) => number;
  tableCell: number[];
};

/** Actual seeded terrain and public UI/runtime commands; no world or inventory mutation ports. */
export async function verifyNaturalBucket(f: Journey) {
  try {
    return await runNaturalBucket(f);
  } catch (error) {
    const state = await f.debug();
    const trace = await f.page.evaluate(() => (window as any).bucketJumpTrace ?? []);
    writeFileSync(
      new URL('../test-results/browser-bucket-failure.json', import.meta.url),
      JSON.stringify({ state, trace }, null, 2) + '\n',
    );
    console.error(
      'Bucket journey diagnostics',
      JSON.stringify({
        position: state.position,
        body: state.body,
        focused: state.focused,
        status: state.status,
        touch: state.touch,
        inventoryPending: state.inventoryPending,
        trace,
      }),
    );
    await f.page.screenshot({
      path: new URL('../test-results/bucket-failure.png', import.meta.url).pathname,
    });
    throw error;
  }
}

async function runNaturalBucket(f: Journey) {
  const {
    page,
    content,
    debug,
    command,
    look,
    mineCell,
    aimCell,
    walkTo,
    collect,
    move,
    craft,
    index,
    putInHotbar,
    settled,
    amount,
    tableCell,
  } = f;
  const neutral = { type: 'touch', x: 0, z: 0, jump: false, sneak: false, sprint: false };
  const open = async () => {
    await page.locator('#inventory-open').tap();
    await page.waitForFunction(() => {
      const d = (window as any).voxel.debug();
      return d.inventoryOpen && !d.inventoryPending && d.body.frozen === 1;
    });
  };
  const resume = async () => {
    if ((await debug()).inventoryOpen) await page.keyboard.press('Escape');
    await settled();
    await page.locator('#resume').tap();
    await page.waitForFunction(() => (window as any).voxel.debug().body.frozen === 0);
  };
  const select = async (kind: string, slot: number) => {
    assert.equal((await debug()).inventory.bag[slot]?.itemType, kind);
    await command({ type: 'select-slot', slot });
    await page.waitForFunction(
      ({ kind, slot }) => {
        const d = (window as any).voxel.debug();
        return !d.inventoryPending && d.selectedSlot === slot && d.feedback.held.itemType === kind;
      },
      { kind, slot },
    );
  };
  const build = async () => {
    const previous = (await debug()).lastResult?.sequence ?? 0;
    await page.locator('.voxel-touch-actions button:has-text("בנייה")').tap();
    await page.waitForFunction(
      (sequence) => ((window as any).voxel.debug().lastResult?.sequence ?? 0) > sequence,
      previous,
    );
    return (await debug()).lastResult;
  };
  const centerShaft = async () => {
    const started = performance.now();
    while (performance.now() - started < 5000) {
      const state = await debug(),
        dx = 58.5 - state.position[0],
        dz = -0.5 - state.position[2];
      const distance = Math.hypot(dx, dz);
      if (distance < 0.035) break;
      await look(Math.atan2(dx, -dz), -0.5);
      await command({ ...neutral, z: -Math.min(0.5, distance) });
      await page.waitForTimeout(100);
    }
    await command(neutral);
    await page.waitForFunction(() => {
      const d = (window as any).voxel.debug();
      return (
        Math.hypot(d.position[0] - 58.5, d.position[2] + 0.5) < 0.08 &&
        Math.hypot(d.body.velocity[0], d.body.velocity[2]) < 0.01
      );
    });
  };
  console.log('Crafting an owned stone pickaxe before mining natural iron');
  await page.locator('#inventory-use').tap();
  await page.waitForFunction(() => (window as any).voxel.debug().inventory.station === 'workbench');
  await settled();
  for (const slot of [0, 1, 2]) await move('bag', await index('stone'), 'craft3', slot, true);
  for (const slot of [4, 7]) await move('bag', await index('stick'), 'craft3', slot, true);
  await craft();
  await putInHotbar('stone_pickaxe', 7);
  await resume();
  await select('stone_pickaxe', 7);
  await walkTo(58.5, -0.5);
  await centerShaft();
  const shaftTop = (await debug()).position[1];
  const mined = [];
  await look(0, -Math.PI / 2);
  const surface = await debug();
  if (content.blocks[surface.targetState]?.shape === 'cross') {
    await mineCell(surface.target);
    mined.push({ cell: surface.target, family: content.blocks[surface.targetState].name });
  }
  const removed = async (cell: number[]) =>
    (await debug()).recentEdits.some(
      (edit: any) => edit.state === 0 && JSON.stringify(edit.cell) === JSON.stringify(cell),
    );
  for (let y = 66; y >= 60; y--) {
    const cell = [58, y, -1];
    if (await removed(cell)) {
      mined.push({
        cell,
        family: y <= 61 ? 'iron_ore' : y === 62 ? 'stone' : 'dirt',
        continuousMining: true,
      });
      continue;
    }
    await aimCell(cell);
    const family = content.blocks[(await debug()).targetState].name;
    assert.equal(family, y <= 61 ? 'iron_ore' : y === 62 ? 'stone' : 'dirt');
    await mineCell(cell);
    mined.push({ cell, family });
    await page.waitForFunction((y) => {
      const d = (window as any).voxel.debug();
      return d.body.onGround === 1 && d.position[1] <= y + 0.1;
    }, y);
  }
  for (const cell of [
    [58, 61, -2],
    [58, 60, -2],
  ]) {
    if (await removed(cell)) {
      mined.push({ cell, family: cell[1] === 60 ? 'iron_ore' : 'stone', continuousMining: true });
      continue;
    }
    await aimCell(cell);
    const family = content.blocks[(await debug()).targetState].name;
    assert.equal(family, cell[1] === 60 ? 'iron_ore' : 'stone');
    await mineCell(cell);
    mined.push({ cell, family });
  }
  await collect('iron_ore', 3);
  const oreHarvested = amount(await debug(), 'iron_ore');
  assert(oreHarvested >= 3);
  await centerShaft();
  console.log('Returning from the shallow iron shaft with earned building blocks');
  const pillars = [];
  while ((await debug()).position[1] < shaftTop - 0.2) {
    const state = await debug();
    const material = ['dirt', 'stone', '#planks'].find((kind) => amount(state, kind) > 0);
    assert(material, 'shaft exit requires earned building material');
    const ownedSlot = await index(material),
      kind = state.inventory.bag[ownedSlot].itemType;
    await open();
    await putInHotbar(kind, 8);
    await resume();
    await select(kind, 8);
    await look(0, -Math.PI / 2);
    let placed = null;
    for (let attempt = 0; attempt < 4 && !placed; attempt++) {
      await command(neutral);
      await page.waitForFunction(() => (window as any).voxel.debug().body.onGround === 1);
      const floor = (await debug()).position[1];
      await page.evaluate(() => ((window as any).bucketJumpTrace = []));
      await command({ ...neutral, jump: true });
      await page.waitForFunction((y) => {
        const d = (window as any).voxel.debug();
        const trace = (window as any).bucketJumpTrace;
        if (trace.length < 70)
          trace.push({
            position: d.position,
            body: d.body,
            focused: d.focused,
            status: d.status,
            touch: d.touch,
          });
        return d.position[1] > y + 1.08;
      }, floor);
      const result = await build();
      await command(neutral);
      if (result.outcome.ok) placed = result;
      else
        assert(['collision', 'occupied'].includes(result.outcome.reason), JSON.stringify(result));
    }
    assert(placed, 'ordinary jump/place must allow leaving the mined shaft');
    pillars.push(placed);
    await page.waitForFunction(() => (window as any).voxel.debug().body.onGround === 1);
  }
  await walkTo(tableCell[0] + 0.5, tableCell[2] + 1.5);
  await aimCell(tableCell);
  await open();
  console.log('Refining earned iron and crafting one reusable bucket in the Hebrew dialog');
  for (let n = 0; n < 3; n++) await move('bag', await index('iron_ore'), 'craft2', 0, true);
  await move('bag', await index('charcoal'), 'craft2', 1);
  for (let i = 0; i < 3; i++) await craft();
  assert.equal(amount(await debug(), 'iron_ingot'), 3);
  const free = (await debug()).inventory.bag.findIndex((stack: any) => !stack);
  await move('craft2', 1, 'bag', free);
  await page.locator('#inventory-use').tap();
  await page.waitForFunction(() => (window as any).voxel.debug().inventory.station === 'workbench');
  await settled();
  for (const slot of [0, 2, 4]) await move('bag', await index('iron_ingot'), 'craft3', slot, true);
  await craft();
  assert.equal(amount(await debug(), 'bucket'), 1);
  assert.equal(amount(await debug(), 'iron_ingot'), 0);
  await putInHotbar('bucket', 0);
  assert.match(
    (await page.locator('[data-area="bag"][data-slot="0"]').getAttribute('title')) ?? '',
    /ממלאת את הדלי/,
  );
  await page.screenshot({
    path: new URL('../test-results/bucket-crafted.png', import.meta.url).pathname,
  });
  await resume();
  await select('bucket', 0);
  await walkTo(46.5, 8.5);
  let source = null;
  search: for (const yaw of [Math.PI, -Math.PI / 2, Math.PI / 2, 0])
    for (const pitch of [-0.6, -1, -0.3]) {
      await look(yaw, pitch);
      const state = await debug();
      if (content.blocks[state.targetState]?.name === 'water') {
        source = state.target;
        break search;
      }
    }
  assert(source, 'the earned empty bucket must target natural river water');
  const beforeFill = await debug();
  const filled = await build();
  assert(filled.outcome.ok, JSON.stringify(filled));
  assert.deepEqual(filled.outcome.cell, source);
  assert.equal(filled.outcome.state, 0);
  await page.waitForFunction(
    () => (window as any).voxel.debug().feedback.held.itemType === 'water_bucket',
  );
  const afterFill = await debug();
  assert.equal(afterFill.inventory.revision, beforeFill.inventory.revision + 1);
  assert.deepEqual(afterFill.inventory.bag[0], { itemType: 'water_bucket', count: 1 });
  assert.deepEqual(afterFill.inventory.bag.slice(1), beforeFill.inventory.bag.slice(1));
  assert.equal(amount(afterFill, 'bucket'), 0);
  await open();
  assert.match(
    (await page.locator('[data-area="bag"][data-slot="0"]').getAttribute('title')) ?? '',
    /מחזירה דלי ריק/,
  );
  await page.screenshot({
    path: new URL('../test-results/bucket-filled.png', import.meta.url).pathname,
  });
  await resume();
  await page.screenshot({
    path: new URL('../test-results/bucket-held-filled.png', import.meta.url).pathname,
  });
  const placements = [];
  const collections = [filled];
  let reconnected = null;
  for (let cycle = 0; cycle < 2; cycle++) {
    let placed = null;
    dry: for (const yaw of [0, Math.PI / 2, -Math.PI / 2, Math.PI])
      for (const pitch of [-0.7, -1]) {
        await look(yaw, pitch);
        const before = await debug();
        if (before.targetNormal?.[1] !== 1 || content.blocks[before.targetState]?.name === 'water')
          continue;
        const result = await build();
        if (result.outcome.ok) {
          placed = result;
          break dry;
        }
        assert.equal((await debug()).inventory.revision, before.inventory.revision);
      }
    assert(placed, 'filled bucket must place its owned water');
    assert.equal(
      placed.outcome.state,
      content.blocks.findIndex((block) => block.name === 'water'),
    );
    await page.waitForFunction(
      () => (window as any).voxel.debug().feedback.held.itemType === 'bucket',
    );
    const state = await debug();
    assert.deepEqual(state.inventory.bag[0], { itemType: 'bucket', count: 1 });
    assert.equal(amount(state, 'water_bucket'), 0);
    placements.push(placed);
    if (cycle === 0) {
      await aimCell(placed.outcome.cell);
      const recollected = await build();
      assert(recollected.outcome.ok, JSON.stringify(recollected));
      assert.deepEqual(recollected.outcome.cell, placed.outcome.cell);
      assert.equal(recollected.outcome.state, 0);
      collections.push(recollected);
      await page.waitForFunction(
        () => (window as any).voxel.debug().feedback.held.itemType === 'water_bucket',
      );
      const saved = (await debug()).inventory;
      await command({ type: 'reconnect' });
      await page.waitForFunction(() => {
        const d = (window as any).voxel.debug();
        return d.phase === 'playing' && d.inventory?.bag[0]?.itemType === 'water_bucket';
      });
      reconnected = (await debug()).inventory;
      assert.deepEqual(reconnected.bag, saved.bag);
      assert.equal(reconnected.revision, saved.revision);
      await resume();
    }
  }
  const final = await debug();
  assert.equal(final.inventory.revision, beforeFill.inventory.revision + 4);
  assert.equal(final.vitals.dead, false);
  await page.screenshot({
    path: new URL('../test-results/bucket-reused.png', import.meta.url).pathname,
  });
  return {
    mined,
    oreHarvested,
    shaftTop,
    pillars,
    source,
    filled,
    collections,
    placements,
    reconnected,
    initialRevision: beforeFill.inventory.revision,
    finalRevision: final.inventory.revision,
    finalBucket: final.inventory.bag[0],
    vitals: final.vitals,
  };
}
