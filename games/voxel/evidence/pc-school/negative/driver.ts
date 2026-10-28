import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Page } from 'playwright';
/** Trusted OS input in the dedicated test X display; never writes game state. */
export async function desktopInput(page: Page) {
  const executable = process.env.VOXEL_XDOTOOL;
  assert(
    executable && process.env.DISPLAY,
    'Desktop gameplay needs the private X display and VOXEL_XDOTOOL',
  );
  const execute = promisify(execFile),
    keys = new Set<string>();
  const input = (args: string[]) => execute(executable, args, { timeout: 3000 });
  await page.addInitScript(() => {
    const evidence = {
      moves: 0,
      lockedPrimary: 0,
      lockedSecondary: 0,
      untrusted: 0,
      keys: {} as Record<string, number>,
      samples: [] as unknown[],
    };
    (window as any).desktopInputEvidence = evidence;
    for (const type of ['mousemove', 'mousedown', 'keydown'])
      window.addEventListener(
        type,
        (event) => {
          const locked = !!document.pointerLockElement;
          if (!event.isTrusted) evidence.untrusted++;
          if (type === 'mousemove' && locked) evidence.moves++;
          if (type === 'mousedown' && locked) {
            const e = event as MouseEvent;
            if (e.button === 0) evidence.lockedPrimary++;
            if (e.button === 2) evidence.lockedSecondary++;
          }
          if (type === 'keydown') {
            const code = (event as KeyboardEvent).code;
            evidence.keys[code] = (evidence.keys[code] ?? 0) + 1;
          }
          if (type !== 'mousemove' || locked) {
            evidence.samples.push({
              type,
              trusted: event.isTrusted,
              locked,
              button: (event as MouseEvent).button,
              code: (event as KeyboardEvent).code,
            });
            if (evidence.samples.length > 128) evidence.samples.shift();
          }
        },
        true,
      );
  });
  const key = (name: string) => input(['key', name]);
  const release = async () => {
    for (const name of keys) await input(['keyup', name]);
    keys.clear();
    await input(['mouseup', '1', 'mouseup', '3']);
  };
  return {
    key,
    release,
    async resume() {
      await page.bringToFront();
      const p = await page.locator('#resume').evaluate((element) => {
        const r = element.getBoundingClientRect(),
          border = (window.outerWidth - window.innerWidth) / 2;
        return {
          x: Math.round(window.screenX + border + r.x + r.width / 2),
          y: Math.round(
            window.screenY + window.outerHeight - window.innerHeight - border + r.y + r.height / 2,
          ),
          scale: devicePixelRatio,
        };
      });
      assert.equal(p.scale, 1);
      await input(['mousemove', String(p.x), String(p.y), 'click', '1']);
      await page.waitForFunction(() => {
        const d = (window as any).voxel.debug();
        return document.pointerLockElement !== null && d.focused && d.body.frozen === 0;
      });
    },
    async inventory() {
      await release();
      const locked = await page.evaluate(() => !!document.pointerLockElement);
      if (locked) await key('e');
      else await page.locator('#inventory-open').click();
    },
    async controls(value: {
      x: number;
      z: number;
      jump: boolean;
      sneak: boolean;
      sprint: boolean;
    }) {
      const desired = new Set<string>();
      if (value.x > 0) desired.add('d');
      if (value.x < 0) desired.add('a');
      if (value.z > 0) desired.add('s');
      if (value.z < 0) desired.add('w');
      if (value.jump) desired.add('space');
      if (value.sneak) desired.add('Shift_L');
      if (value.sprint) desired.add('Control_L');
      for (const name of keys)
        if (!desired.has(name)) {
          await input(['keyup', name]);
          keys.delete(name);
        }
      for (const name of desired)
        if (!keys.has(name)) {
          await input(['keydown', name]);
          keys.add(name);
        }
    },
    async look(yaw: number, pitch: number) {
      for (let n = 0; n < 24; n++) {
        const d = await page.evaluate(() => (window as any).voxel.debug());
        assert.equal(d.inputMode, 'desktop');
        assert(d.pointerLocked, 'mouse look requires owned pointer lock');
        const dx = Math.atan2(Math.sin(yaw - d.view.yaw), Math.cos(yaw - d.view.yaw)),
          dy = d.view.pitch - pitch;
        if (Math.abs(dx) < 0.006 && Math.abs(dy) < 0.006) return;
        const x = Math.round(Math.max(-300, Math.min(300, dx / 0.002))),
          y = Math.round(Math.max(-200, Math.min(200, dy / 0.002)));
        const before = await page.evaluate(() => performance.now());
        await input(['mousemove_relative', '--', String(x), String(y)]);
        await page.waitForFunction((before) => {
          const d = (window as any).voxel.debug();
          return d.lastFrame > before && d.lastUpdate > before;
        }, before);
      }
      throw Error('trusted desktop mouse look did not converge');
    },
    down: () => input(['mousedown', '1']),
    up: () => input(['mouseup', '1']),
    async place() {
      await input(['mousedown', '3']);
      await page.waitForTimeout(50);
      await input(['mouseup', '3']);
    },
    evidence: () => page.evaluate(() => (window as any).desktopInputEvidence),
  };
}
