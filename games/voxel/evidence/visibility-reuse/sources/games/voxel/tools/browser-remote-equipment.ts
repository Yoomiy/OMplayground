import assert from 'node:assert/strict';
import type { Browser, Page } from 'playwright';
import type { ActorAppearance } from '../src/shared/appearance.ts';
import { EQUIPMENT } from '../src/shared/inventory.ts';

/** A second real, independently admitted survival client observes ordinarily crafted gear. */
export async function verifyRemoteEquipment(
  browser: Browser,
  owner: Page,
  errors: string[],
  removeFeet: () => Promise<void>,
  restoreFeet: () => Promise<void>,
  screenshot: string,
) {
  const own = await owner.evaluate(() => (window as any).voxel.debug());
  const appearance: ActorAppearance = {
    held: own.inventory.bag[own.selectedSlot]?.itemType ?? null,
    equipment: Object.fromEntries(
      EQUIPMENT.map((slot, i) => [slot, own.inventory.equipment[i]?.itemType ?? null]),
    ) as ActorAppearance['equipment'],
  };
  assert.ok(appearance.held);
  assert.ok(appearance.equipment.feet);
  await owner.evaluate(() => (window as any).voxel.command({ type: 'pause' }));
  await owner.waitForFunction(() => (window as any).voxel.debug().body.frozen === 1);
  const context = await browser.newContext({
    viewport: { width: 800, height: 650 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (event) => {
    if (event.type() === 'error') errors.push(event.text());
  });
  const publicPackets: unknown[] = [];
  page.on('websocket', (socket) =>
    socket.on('framereceived', (frame) => {
      if (typeof frame.payload !== 'string') return;
      const message = JSON.parse(frame.payload);
      if (message.type === 'actor_joined' && message.actor.id === own.actorId)
        publicPackets.push(message.actor);
      if (message.type === 'snapshot')
        for (const actor of message.actors)
          if (actor.id === own.actorId && actor.appearance) publicPackets.push(actor);
    }),
  );
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
  const shown = async (expected: ActorAppearance) => {
    await page.waitForFunction(
      ({ id, expected }) => {
        const d = (window as any).voxel.debug(),
          samples = d.avatars.equipment.samples.filter((s: any) => s.id === id);
        const wanted = [
          ...(expected.held ? [{ slot: 'held', kind: expected.held, count: 1 }] : []),
          ...Object.entries(expected.equipment)
            .filter(([, kind]) => kind)
            .map(([slot, kind]) => ({ slot, kind, count: slot === 'feet' ? 2 : 1 })),
        ];
        return (
          samples.length === wanted.reduce((n, s) => n + s.count, 0) &&
          wanted.every(
            (w) =>
              samples.filter((s: any) => s.slot === w.slot && s.itemType === w.kind).length ===
              w.count,
          )
        );
      },
      { id: own.actorId, expected },
    );
    return debug();
  };
  const aim = async () => {
    const d = await debug(),
      p = (await owner.evaluate(() => (window as any).voxel.debug())).position;
    const dx = p[0] - d.position[0],
      dz = p[2] - d.position[2],
      dy = p[1] + 1.1 - d.position[1] - 1.62;
    const submitted = d.render.gpu.submitted;
    await command({
      type: 'look',
      dx: (Math.atan2(dx, -dz) - d.view.yaw) / 0.002,
      dy: (d.view.pitch - Math.atan2(dy, Math.hypot(dx, dz))) / 0.002,
    });
    await page.waitForFunction(
      (submitted) => (window as any).voxel.debug().render.gpu.submitted > submitted,
      submitted,
    );
  };
  try {
    console.log('Opening independently admitted viewer for owned remote equipment');
    await page.goto(owner.url(), { waitUntil: 'domcontentloaded' });
    await ready();
    await page.locator('#resume').tap();
    await page.waitForFunction(() => (window as any).voxel.debug().body.frozen === 0);
    assert.notEqual((await debug()).actorId, own.actorId);
    await aim();
    const joined = await shown(appearance);
    assert.equal(
      joined.feedback.vision,
      false,
      'another player wearing Glow cannot brighten this viewer',
    );
    const origin = joined.renderOrigin.x;
    // The natural spawn straddles x=48. Public touch walking/jumping crosses that chunk boundary.
    await command({ type: 'look', dx: -joined.view.yaw / 0.002, dy: joined.view.pitch / 0.002 });
    await command({ type: 'touch', x: -0.5, z: 0, jump: true, sneak: false, sprint: false });
    await page.waitForFunction(
      (origin) => (window as any).voxel.debug().renderOrigin.x !== origin,
      origin,
      { timeout: 15000 },
    );
    await command({ type: 'touch', x: 0, z: 0, jump: false, sneak: false, sprint: false });
    await page.waitForFunction(() => {
      const b = (window as any).voxel.debug().body;
      return b.onGround === 1 && Math.hypot(b.velocity[0], b.velocity[2]) < 0.03;
    });
    await aim();
    const shifted = await shown(appearance);
    assert.notEqual(shifted.renderOrigin.x, origin);
    for (const sample of shifted.avatars.equipment.samples.filter(
      (s: any) => s.id === own.actorId,
    )) {
      const before = joined.avatars.equipment.samples.find(
        (s: any) => s.id === sample.id && s.slot === sample.slot && s.side === sample.side,
      );
      assert.ok(before);
      for (const axis of [0, 1, 2]) {
        const key = axis === 0 ? 'x' : axis === 2 ? 'z' : null;
        assert.ok(
          Math.abs(
            sample.position[axis] +
              (key ? shifted.renderOrigin[key] : 0) -
              before.position[axis] -
              (key ? joined.renderOrigin[key] : 0),
          ) < 0.001,
          'submitted equipment instances retain absolute position across origin shifts',
        );
      }
    }
    await page.screenshot({ path: screenshot });
    await removeFeet();
    const withoutFeet = await shown({
      ...appearance,
      equipment: { ...appearance.equipment, feet: null },
    });
    await restoreFeet();
    await shown(appearance);
    const current = await owner.evaluate(() => (window as any).voxel.debug());
    const alternate = current.inventory.bag.findIndex(
      (s: any, index: number) =>
        index < 9 && index !== current.selectedSlot && s?.itemType !== appearance.held,
    );
    assert.ok(alternate >= 0);
    await owner.evaluate(
      (slot) => (window as any).voxel.command({ type: 'select-slot', slot }),
      alternate,
    );
    await owner.waitForFunction((slot) => {
      const d = (window as any).voxel.debug();
      return d.selectedSlot === slot && !d.inventoryPending;
    }, alternate);
    const selected = await shown({
      ...appearance,
      held: current.inventory.bag[alternate]?.itemType ?? null,
    });
    await owner.evaluate(
      (slot) => (window as any).voxel.command({ type: 'select-slot', slot }),
      current.selectedSlot,
    );
    await shown(appearance);
    const beforeReconnect = await debug();
    await command({ type: 'reconnect' });
    await page.waitForFunction(
      (epoch) => {
        const d = (window as any).voxel.debug();
        return d.epoch > epoch && d.phase === 'playing';
      },
      beforeReconnect.epoch,
      { timeout: 60000 },
    );
    await ready();
    const reconnected = await shown(appearance);
    assert.equal(reconnected.actorId, joined.actorId);
    for (const actor of publicPackets as Record<string, unknown>[]) {
      assert.ok(
        Object.keys(actor).every((key) =>
          ['id', 'state', 'yaw', 'pitch', 'appearance'].includes(key),
        ),
      );
      assert.deepEqual(Object.keys(actor.appearance as object).sort(), ['equipment', 'held']);
      for (const kind of Object.values((actor.appearance as ActorAppearance).equipment))
        assert.ok(kind === null || typeof kind === 'string');
    }
    assert.ok(
      publicPackets.length >= 4,
      'join, gear removal/restoration and selection changes must arrive over the real socket',
    );
    const ownerOnly = new Set(
      [appearance.held, ...Object.values(appearance.equipment)].filter(Boolean),
    );
    assert.ok(
      reconnected.inventory.bag.every((stack: any) => !ownerOnly.has(stack?.itemType)),
      "viewer inventory never receives the other player's gear",
    );
    await page.evaluate(() => {
      (window as any).voxel.dispose();
      (window as any).voxel.dispose();
    });
    await page.waitForTimeout(650);
    const cleanup = await debug();
    assert.deepEqual(cleanup.resources, { geometries: 0, textures: 0, workers: 0 });
    assert.equal(cleanup.audio.contexts, 0);
    assert.equal(cleanup.audio.voices, 0);
    assert.equal(cleanup.avatars.equipment.visible, 0);
    assert.equal(cleanup.avatars.equipment.kinds, 0);
    assert.equal(cleanup.render.gpu.pending, 0);
    console.log(
      'Owned remote gear, independent vision, origin shift, UI unequip, selection, reconnect and cleanup pass',
    );
    return {
      appearance,
      viewerId: joined.actorId,
      ownerId: own.actorId,
      joined: { origin: joined.renderOrigin, gear: joined.avatars.equipment },
      shifted: { origin: shifted.renderOrigin, gear: shifted.avatars.equipment },
      withoutFeet: withoutFeet.avatars.equipment,
      selected: selected.avatars.equipment,
      reconnected: reconnected.avatars.equipment,
      publicPackets,
      cleanup: {
        ...cleanup.resources,
        audio: cleanup.audio,
        gpu: cleanup.render.gpu,
        gear: cleanup.avatars.equipment,
      },
    };
  } finally {
    await context.close();
  }
}
