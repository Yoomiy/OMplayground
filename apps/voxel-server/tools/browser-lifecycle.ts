import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import {
  createBuiltHarness,
  launchSoftwareBrowser,
} from "../../../games/voxel/tools/browser-harness.ts";
import { schoolFixture } from "../tests/helpers/school-fixture.ts";
import { schoolGatewayPolicy } from "../src/school-admission.ts";

const f = schoolFixture();
f.setNow(Date.now());
f.state.onRequest = () => f.setNow(Date.now());
f.state.defaults = Array.from({ length: 7 }, (_, day_of_week) => ({
  day_of_week,
  start_time: "00:00:00",
  end_time: "24:00:00",
  is_active: true,
}));
const policy = schoolGatewayPolicy(f.access);
const h = await createBuiltHarness(
  { mode: "survival" },
  async (request, body, response) => {
    // Trusted harness identity only; production uses bearer admission, never this cookie.
    const id = request.headers.cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("school-fixture="))
      ?.slice("school-fixture=".length);
    if (id !== f.kid && id !== f.teacher) {
      response.writeHead(401);
      response.end();
      return null;
    }
    request.headers.authorization = `Bearer ${f.token(id)}`;
    return policy.admit(request, body, response);
  },
  policy.resolveOwner,
  policy.roomPolicy,
);
const output = new URL(
  "../test-results/browser-lifecycle.json",
  import.meta.url,
);
rmSync(output, { force: true });
const browser = await launchSoftwareBrowser(),
  errors: string[] = [];
const deadline = setTimeout(() => {
  console.error("School lifecycle browser exceeded 180 seconds");
  void browser.close();
}, 180000);
try {
  const teacherContext = await browser.newContext({
    viewport: { width: 800, height: 600 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 1,
  });
  const kidContext = await browser.newContext({
    viewport: { width: 480, height: 300 },
    deviceScaleFactor: 1,
  });
  const pages = [],
    inputs: unknown[] = [];
  let captureResumeAfterEpoch = Infinity;
  let freshBackward: {
    epoch: number;
    sequence: number;
    z: number;
    yaw: number;
  } | null = null;
  for (const [context, id] of [
    [teacherContext, f.teacher],
    [kidContext, f.kid],
  ] as const) {
    await context.addCookies([
      {
        name: "school-fixture",
        value: id,
        url: h.origin,
        httpOnly: true,
        sameSite: "Strict",
      },
    ]);
    const page = await context.newPage();
    if (id === f.kid)
      page.on("websocket", (socket) =>
        socket.on("framesent", (frame) => {
          if (typeof frame.payload !== "string") return;
          const message = JSON.parse(frame.payload);
          if (message.type === "input") {
            inputs.push(message.frames);
            if (inputs.length > 8) inputs.shift();
            const frame = message.frames.find(
              (value: any) =>
                value.epoch >= captureResumeAfterEpoch && value.z > 0,
            );
            if (frame && !freshBackward)
              freshBackward = {
                epoch: frame.epoch,
                sequence: frame.sequence,
                z: frame.z,
                yaw: frame.yaw,
              };
          }
        }),
      );
    pages.push(page);
    page.setDefaultTimeout(15000);
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (e) => {
      if (e.type() === "error") errors.push(e.text());
    });
    await page.goto(`${h.origin}/?room=${f.room}&quality=low`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForFunction(
      () => {
        const d = (window as any).voxel?.debug();
        return (
          d?.phase === "playing" && d.collisionColumns >= 9 && d.meshed >= 9
        );
      },
      null,
      { timeout: 60000 },
    );
  }
  const [teacher, kid] = pages;
  const debug = (page: typeof kid) =>
    page.evaluate(() => (window as any).voxel.debug());
  await kid.bringToFront();
  await kid.locator("#resume").click();
  await kid.waitForFunction(
    () =>
      document.pointerLockElement !== null &&
      (window as any).voxel.debug().body?.frozen === 0,
  );
  const initial = await debug(kid);
  await kid.keyboard.down("KeyW");
  await kid.waitForFunction(
    (p) =>
      Math.hypot(
        (window as any).voxel.debug().position[0] - p[0],
        (window as any).voxel.debug().position[2] - p[2],
      ) > 0.15,
    initial.position,
  );
  f.state.session.status = "paused";
  await kid.waitForFunction(() => {
    const d = (window as any).voxel.debug();
    return (
      d.lifecycle === "paused" &&
      d.worldPauseReason === "session" &&
      d.body.frozen === 1 &&
      !d.focused &&
      document.pointerLockElement === null
    );
  });
  await kid.keyboard.up("KeyW");
  const paused = await debug(kid);
  await kid.locator("#resume").click();
  await kid.waitForTimeout(150);
  assert.equal((await debug(kid)).focused, false);
  assert.deepEqual((await debug(kid)).position, paused.position);
  await teacher.bringToFront();
  await teacher.waitForFunction(
    () => (window as any).voxel.debug().worldPauseReason === "session",
  );
  await teacher.locator("#resume").tap();
  await teacher.waitForFunction(
    () => (window as any).voxel.debug().body?.frozen === 0,
  );
  const camera = await debug(teacher),
    box = await teacher.locator('[data-control="jump"]').boundingBox();
  assert.ok(box);
  const cdp = await teacherContext.newCDPSession(teacher);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
        id: 1,
        radiusX: 4,
        radiusY: 4,
        force: 1,
      },
    ],
  });
  await teacher.waitForFunction(
    (y) => (window as any).voxel.debug().position[1] > y + 2,
    camera.position[1],
  );
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await teacher.waitForTimeout(100);
  const moved = await debug(teacher);
  assert.equal(moved.worldTick, paused.worldTick);
  assert.equal((await debug(kid)).worldTick, paused.worldTick);
  assert.deepEqual((await debug(kid)).position, paused.position);
  mkdirSync(new URL("../test-results/", import.meta.url), {
    recursive: true,
  });
  await teacher.screenshot({
    path: new URL(
      "../test-results/school-lifecycle-paused.png",
      import.meta.url,
    ).pathname,
  });
  f.state.session.status = "playing";
  await kid.bringToFront();
  await kid.waitForFunction(
    () => (window as any).voxel.debug().lifecycle === "playing",
  );
  assert.equal((await debug(kid)).focused, false);
  assert.equal((await debug(kid)).body.frozen, 1);
  await kid.waitForTimeout(100);
  assert.deepEqual((await debug(kid)).position, paused.position);
  await kid.locator("#resume").click();
  await kid.waitForFunction(
    () =>
      document.pointerLockElement !== null &&
      (window as any).voxel.debug().focused &&
      (window as any).voxel.debug().body.frozen === 0,
  );
  // Use the fresh backward key and verify movement in its actual camera-relative direction.
  const beforeResumedMotion = await debug(kid);
  captureResumeAfterEpoch = beforeResumedMotion.epoch;
  await kid.keyboard.down("KeyS");
  try {
    // Local prediction may cross the distance threshold before the next network
    // batch. Keep the real key held until its fresh epoch reaches the socket.
    for (let i = 0; i < 150 && !freshBackward; i++)
      await kid.waitForTimeout(20);
    assert.ok(freshBackward, "resume must transmit fresh backward input");
    await kid.waitForFunction(
      (value) => {
        const p = (window as any).voxel.debug().position;
        return (
          (p[0] - value.position[0]) * -Math.sin(value.yaw) +
            (p[2] - value.position[2]) * Math.cos(value.yaw) >
          0.15
        );
      },
      {
        position: beforeResumedMotion.position,
        yaw: (freshBackward as unknown as { yaw: number }).yaw,
      },
    );
  } catch (error) {
    const d = await debug(kid);
    console.error(
      "Resumed movement diagnostic",
      JSON.stringify({
        pausedPosition: paused.position,
        position: d.position,
        body: d.body,
        focused: d.focused,
        lifecycle: d.lifecycle,
        phase: d.phase,
        status: d.status,
        view: d.view,
        target: d.target,
        targetNormal: d.targetNormal,
        inputLag: d.inputLag,
        inputs,
      }),
    );
    throw error;
  }
  await kid.keyboard.up("KeyS");
  const resumed = await debug(kid);
  assert.ok(
    freshBackward !== null,
    "resume uses fresh backward input rather than the old held forward key",
  );
  assert.ok(resumed.epoch > initial.epoch);
  f.state.session.status = "completed";
  for (const page of pages)
    await page.waitForFunction(
      () => (window as any).voxel.debug().lifecycle === "ended",
    );
  await kid.waitForFunction(() => document.pointerLockElement === null);
  assert.ok(
    (await kid.locator("#status").textContent())?.includes("המפגש הסתיים"),
  );
  await kid.waitForTimeout(50);
  const authRequests = f.requests.filter((r) => r.path === "user").length;
  await kid.waitForTimeout(1700);
  assert.equal(
    f.requests.filter((r) => r.path === "user").length,
    authRequests,
    "terminal sessions must not automatically request admission again",
  );
  const cleanup = [];
  for (const page of pages) {
    await page.evaluate(() => (window as any).voxel.dispose());
    await page.waitForFunction(
      () => (window as any).voxel.debug().audio.state === "closed",
    );
    const d = await debug(page);
    assert.deepEqual(d.resources, { geometries: 0, textures: 0, workers: 0 });
    cleanup.push({ resources: d.resources, audio: d.audio });
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    output,
    JSON.stringify(
      {
        result: "PASS",
        buildId: h.build.buildId,
        engineHash: h.build.engineHash,
        contentHash: h.content.hash,
        browser: browser.version(),
        scope:
          "Built child pointer-lock pause/resume with cleared input, fixed world time and teacher touch flight while paused, terminal session/no automatic readmission and teardown; fixture school Auth/PostgREST and software Chromium",
        paused: { tick: paused.worldTick, position: paused.position },
        teacherRise: moved.position[1] - camera.position[1],
        resumed: {
          epoch: resumed.epoch,
          position: resumed.position,
          freshBackward,
        },
        noAutomaticReadmission: true,
        cleanup,
        errors,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Central pause, frozen world time, teacher flight, explicit child resume, terminal session and teardown pass",
  );
} finally {
  clearTimeout(deadline);
  await browser.close();
  await h.gateway.close();
}
