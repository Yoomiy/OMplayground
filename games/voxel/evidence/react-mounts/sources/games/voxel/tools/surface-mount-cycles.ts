import assert from 'node:assert/strict';
import type { Page } from 'playwright';

/** Observe real browser owners before first navigation. No app authority or
 * lifecycle substitution; the scenario below uses the rendered exit/re-entry UI.
 */
export function surfaceOwners(page: Page) {
  let openedSockets = 0,
    closedSockets = 0,
    createdWorkers = 0,
    closedWorkers = 0;
  page.on('websocket', (socket) => {
    if (!socket.url().endsWith('/voxel')) return;
    openedSockets++;
    socket.on('close', () => closedSockets++);
  });
  page.on('worker', (worker) => {
    createdWorkers++;
    worker.on('close', () => closedWorkers++);
  });
  return () => ({
    openedSockets,
    closedSockets,
    createdWorkers,
    closedWorkers,
    liveWorkers: page.workers().length,
  });
}

export async function surfaceMountCycles(
  page: Page,
  owners: ReturnType<typeof surfaceOwners>,
  cycles: number,
) {
  assert(Number.isSafeInteger(cycles) && cycles >= 2);
  const samples: Record<string, any>[] = [];
  const debug = () => page.evaluate(() => (window as any).surfaceRuntime.debug());
  for (let cycle = 0; cycle < cycles; cycle++) {
    await page.waitForFunction(
      () => {
        const d = (window as any).surfaceRuntime?.debug();
        return (
          !d?.disposed &&
          d?.phase === 'playing' &&
          d.columns === 49 &&
          d.collisionColumns === 49 &&
          d.meshed >= 25 &&
          d.activeJobs === 0
        );
      },
      null,
      { timeout: 60000 },
    );
    const resume = page.getByRole('button', { name: 'חידוש המפגש', exact: true });
    if ((await debug()).lifecycle === 'paused' && (await resume.isVisible())) {
      await resume.tap();
      await page.waitForFunction(
        () => (window as any).surfaceRuntime.debug().lifecycle === 'playing',
      );
    }
    const enter = page.getByRole('button', { name: 'כניסה לעולם', exact: true });
    if (await enter.isVisible()) await enter.tap();
    await page.waitForFunction(() => (window as any).surfaceRuntime.debug().body?.frozen === 0);
    await page.waitForTimeout(700);
    const active = await debug(),
      activeOwners = owners();
    assert.equal(activeOwners.openedSockets - activeOwners.closedSockets, 1);
    assert.equal(
      activeOwners.createdWorkers - activeOwners.closedWorkers,
      active.resources.workers,
    );
    assert.equal(activeOwners.liveWorkers, active.resources.workers);
    assert.equal(await page.locator('.voxel-session canvas').count(), 1);
    assert.equal(await page.locator('.voxel-inventory').count(), 1);
    assert.equal(await page.locator('.voxel-touch').count(), 1);
    const beforeExit = await page.evaluate(() => (window as any).voxelMemoryProbe());
    assert(beforeExit.gpuBuffers.bytes > 0);
    await page.getByRole('button', { name: 'יציאה', exact: true }).tap();
    await page.waitForFunction(() => {
      const d = (window as any).disposedRuntime?.debug();
      return d?.disposed && d.audio.state === 'closed' && d.resources.workers === 0;
    });
    const until = performance.now() + 10000;
    while (performance.now() < until) {
      const o = owners();
      if (
        !o.liveWorkers &&
        o.openedSockets === o.closedSockets &&
        o.createdWorkers === o.closedWorkers
      )
        break;
      await page.waitForTimeout(50);
    }
    const disposed = await page.evaluate(() => (window as any).disposedRuntime.debug()),
      after = owners();
    const memory = await page.evaluate(() => (window as any).voxelMemoryProbe());
    assert.deepEqual(disposed.resources, { geometries: 0, textures: 0, workers: 0 });
    assert.equal(disposed.audio.state, 'closed');
    assert.equal(memory.gpuBuffers.live, 0);
    assert.equal(memory.gpuBuffers.bytes, 0);
    assert.equal(memory.gpuBuffers.created, memory.gpuBuffers.deleted);
    assert.equal(after.liveWorkers, 0);
    assert.equal(after.openedSockets, after.closedSockets);
    assert.equal(after.createdWorkers, after.closedWorkers);
    assert.equal(
      await page
        .locator(
          '.voxel-touch,.voxel-inventory,canvas,audio[data-voxel-voice-output],audio[data-voxel-voice-input]',
        )
        .count(),
      0,
    );
    const sample = {
      cycle,
      actorId: active.actorId,
      worldId: active.worldId,
      epoch: active.epoch,
      mounted: {
        resources: active.resources,
        columns: active.columns,
        collisionColumns: active.collisionColumns,
        memory: beforeExit,
        owners: activeOwners,
      },
      unmounted: {
        resources: disposed.resources,
        audio: disposed.audio.state,
        memory,
        owners: after,
      },
    };
    samples.push(sample);
    console.log(JSON.stringify({ phase: 'react-mount-cycle', ...sample }));
    if (cycle + 1 < cycles) {
      await page.getByRole('button', { name: 'כניסה חוזרת', exact: true }).tap();
    }
  }
  assert(
    samples.every((s) => s.actorId === samples[0].actorId && s.worldId === samples[0].worldId),
  );
  for (let i = 1; i < samples.length; i++) assert(samples[i].epoch > samples[i - 1].epoch);
  return {
    result: 'REPEATED_REACT_SURFACE_OWNERSHIP_AND_UI_TEARDOWN_PASS',
    cycles,
    samples,
    scope:
      'Same-page actual StrictMode VoxelSurface mounts via rendered exit/re-entry buttons, native packaged room workers and local SDK/SQL fixture. Instrumented GL ownership and actual socket/worker teardown; no hosted Auth/Storage, SFU, physical hardware or general heap-leak qualification.',
  };
}
