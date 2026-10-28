import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import {
  createBuiltHarness,
  launchSoftwareBrowser,
} from "../../../games/voxel/tools/browser-harness.ts";
import { schoolFixture } from "../tests/helpers/school-fixture.ts";
import { schoolGatewayPolicy } from "../src/school-admission.ts";

// The browser runs the release client. Only school Auth/PostgREST responses are fixtures.
const fixture = schoolFixture();
fixture.setNow(Date.now());
fixture.state.onRequest = () => fixture.setNow(Date.now());
const policy = schoolGatewayPolicy(fixture.access);
const harness = await createBuiltHarness(
  { mode: "survival" },
  async (request, body, response) => {
    // Trusted harness supplies the fixture JWT; this is not production cookie authentication.
    request.headers.authorization = `Bearer ${fixture.token(fixture.teacher)}`;
    return policy.admit(request, body, response);
  },
  policy.resolveOwner,
  policy.roomPolicy,
);
const resultFile = new URL(
  "../test-results/browser-school.json",
  import.meta.url,
);
rmSync(resultFile, { force: true });
const browser = await launchSoftwareBrowser();
const deadline = setTimeout(() => {
  console.error("School observer browser exceeded 120 seconds");
  void browser.close();
}, 120000);
const errors: string[] = [];
try {
  const context = await browser.newContext({
    viewport: { width: 800, height: 600 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const controls: unknown[] = [];
  page.on("websocket", (socket) =>
    socket.on("framesent", (frame) => {
      if (typeof frame.payload !== "string") return;
      const value = JSON.parse(frame.payload);
      if (["focus", "flight"].includes(value.type)) controls.push(value);
    }),
  );
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (event) => {
    if (event.type() === "error") errors.push(event.text());
  });
  await page.goto(`${harness.origin}/?room=${fixture.room}&quality=low`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(
    () => {
      const d = (window as any).voxel?.debug();
      return (
        d?.phase === "playing" &&
        d.collisionColumns >= 9 &&
        d.meshed >= 9 &&
        d.render.drawCalls > 0
      );
    },
    null,
    { timeout: 60000 },
  );
  const debug = () => page.evaluate(() => (window as any).voxel.debug());
  assert.equal((await debug()).mode, "survival");
  await page.waitForFunction(
    () => (window as any).voxel.debug().worldPauseReason === "no_participants",
  );
  const pausedTick = (await debug()).worldTick;
  assert.equal((await debug()).combat, false);
  assert.equal((await debug()).canIgnite, false);
  assert.equal(await page.locator("#vitals").isHidden(), true);
  assert.equal(await page.locator("#eat").isHidden(), true);
  const flight = page.getByRole("button", { name: "תעופה", exact: true });
  assert.equal(await flight.isVisible(), true);
  assert.equal(
    await page
      .getByRole("button", { name: "תקיפה (Q)", exact: true })
      .isHidden(),
    true,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "הצתה (G)", exact: true })
      .isHidden(),
    true,
  );
  await page.locator("#resume").tap();
  await page.waitForFunction(
    () => (window as any).voxel.debug().body?.frozen === 0,
  );
  await page.waitForFunction(
    () => (window as any).voxel.debug().body?.flying === 1,
  );
  await page
    .getByRole("button", { name: "תעופה", exact: true, pressed: true })
    .waitFor({ state: "visible" });
  assert.equal(await flight.getAttribute("aria-pressed"), "true");
  await flight.tap();
  await page.waitForFunction(
    () => (window as any).voxel.debug().body?.flying === 0,
  );
  await page
    .getByRole("button", { name: "תעופה", exact: true, pressed: false })
    .waitFor({ state: "visible" });
  let flying: any;
  await page.evaluate(() => {
    (window as any).schoolKeys = [];
    window.addEventListener("keydown", (event) => {
      const d = (window as any).voxel.debug();
      (window as any).schoolKeys.push({
        code: event.code,
        key: event.key,
        mode: d.inputMode,
        focused: d.focused,
        status: d.status,
      });
    });
  });
  try {
    await page.keyboard.press("KeyF");
    await page.waitForFunction(
      () => (window as any).voxel.debug().body?.flying === 1,
    );
    await page
      .getByRole("button", { name: "תעופה", exact: true, pressed: true })
      .waitFor({ state: "visible" });
    flying = await debug();
    await page.keyboard.press("KeyF");
    await page.waitForFunction(
      () => (window as any).voxel.debug().body?.flying === 0,
    );
  } catch (error) {
    const d = await debug();
    console.error(
      "Observer keyboard diagnostic",
      JSON.stringify({
        controls,
        keys: await page.evaluate(() => (window as any).schoolKeys),
        focused: d.focused,
        inputMode: d.inputMode,
        phase: d.phase,
        status: d.status,
        body: d.body,
        lastResult: d.lastResult,
      }),
    );
    throw error;
  }
  mkdirSync(new URL("../test-results/", import.meta.url), { recursive: true });
  await page.screenshot({
    path: new URL("../test-results/school-observer.png", import.meta.url)
      .pathname,
  });
  fixture.profiles.get(fixture.teacher)!.is_active = false;
  assert.equal(
    (await debug()).worldTick,
    pausedTick,
    "teacher controls must not advance the paused world clock",
  );
  await page.waitForFunction(
    () => (window as any).voxel.debug().status === "error",
  );
  const status = await page.locator("#status").textContent();
  assert.ok(status?.includes("החיבור"));
  await page.evaluate(() => (window as any).voxel.dispose());
  await page.waitForFunction(
    () => (window as any).voxel.debug().audio.state === "closed",
  );
  const cleanup = await debug();
  assert.equal(cleanup.resources.workers, 0);
  assert.equal(cleanup.resources.geometries, 0);
  assert.equal(cleanup.resources.textures, 0);
  assert.deepEqual(
    controls
      .filter((event: any) => event.type === "flight")
      .map((event: any) => event.on),
    [false, true, false],
  );
  assert.equal(errors.length, 0, JSON.stringify(errors));
  writeFileSync(
    resultFile,
    JSON.stringify(
      {
        result: "PASS",
        buildId: harness.build.buildId,
        browser: browser.version(),
        scope:
          "Built observer touch/keyboard flight in survival, role-specific HUD, live account revocation and teardown; fixture Auth/PostgREST, software Chromium",
        flying: {
          body: flying.body,
          combat: flying.combat,
          canIgnite: flying.canIgnite,
        },
        status,
        controls,
        keys: await page.evaluate(() => (window as any).schoolKeys),
        cleanup: { resources: cleanup.resources, audio: cleanup.audio },
        errors,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "School observer touch/keyboard flight, authority revocation and teardown pass",
  );
} finally {
  clearTimeout(deadline);
  await browser.close();
  await harness.gateway.close();
}
