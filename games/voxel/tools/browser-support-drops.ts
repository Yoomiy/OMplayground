import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createBuiltHarness, launchSoftwareBrowser } from './browser-harness.ts';
const { gateway, origin } = await createBuiltHarness({ mode: 'creative' });
const browser = await launchSoftwareBrowser();
const errors: string[] = [];
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  page.setDefaultTimeout(30000);
  page.on('pageerror', (e) => errors.push(e.message));
  const command = (cmd: unknown) => page.evaluate((cmd) => (window as any).voxel.command(cmd), cmd);
  await page.goto(`${origin}/?room=drops-${randomUUID()}&quality=low`);
  await page.waitForFunction(() => {
    const d = (window as any).voxel?.debug();
    return d?.phase === 'playing' && d.focused;
  });
  await command({ type: 'inventory', operation: { kind: 'open', target: null } });
  await page.waitForFunction(() => {
    const d = (window as any).voxel.debug();
    return d.inventory && !d.inventoryPending;
  });
  await page.waitForTimeout(300);
  const revision = await page.evaluate(() => (window as any).voxel.debug().inventory.revision);
  await command({
    type: 'inventory',
    operation: { kind: 'give', itemType: 'stone', count: 8, revision },
  });
  await page.waitForFunction(() => {
    const d = (window as any).voxel.debug();
    return (
      d.inventory.bag.some((s: any) => s?.itemType === 'stone' && s.count === 8) &&
      !d.inventoryPending
    );
  });
  await command({ type: 'inventory', operation: { kind: 'close' } });
  await command({ type: 'resume' });
  await page.locator('canvas').first().click();
  await page.waitForFunction(() => (window as any).voxel.debug().focused);
  await command({ type: 'select-slot', slot: 0 });
  await page.waitForTimeout(300);
  await command({ type: 'drop' });
  await page.waitForFunction(() => (window as any).voxel.debug().drops.length > 0);
  await page.waitForTimeout(1200);
  const before = await page.evaluate(() => (window as any).voxel.debug());
  assert.ok(before.drops.length > 0, 'standing still must not recollect a throw');
  assert.ok(before.feedback.drops.visible > 0, 'drop instances must reach the renderer');
  await page.mouse.move(500, 650);
  await page.waitForTimeout(300);
  mkdirSync(new URL('../test-results/', import.meta.url), { recursive: true });
  await page.screenshot({
    path: new URL('../test-results/support-drops.png', import.meta.url).pathname,
  });
  await page.evaluate(() => (window as any).voxel.dispose());
  await page.waitForTimeout(500);
  const disposed = await page.evaluate(() => (window as any).voxel.debug());
  assert.equal(disposed.resources.workers, 0);
  assert.deepEqual(errors, []);
  console.log('Browser: throw persists, drops render, no runtime errors, worker cleanup passes');
} finally {
  await browser.close();
  await gateway.close();
}
