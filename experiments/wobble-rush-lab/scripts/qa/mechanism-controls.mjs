/** Actual DOM/countdown and keyboard-camera checks in an unmodified simulation. */
import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { chromium } from "@playwright/test"

const base = process.env.LAB_URL || "http://127.0.0.1:19003"
const out = process.env.LAB_EVIDENCE || "evidence/mechanism-controls"
await mkdir(out, { recursive: true })
const browser = await chromium.launch({
  executablePath:
    "/home/ubuntu/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux-arm64/chrome-headless-shell",
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
})
const errors = [],
  races = []
try {
  const page = await browser.newPage({
    viewport: { width: 900, height: 720 },
    deviceScaleFactor: 0.25,
  })
  page.setDefaultTimeout(90_000)
  page.on("pageerror", (e) => errors.push(e.message))
  await page.addInitScript(() => {
    const define = Object.defineProperty
    Object.defineProperty = (target, key, descriptor) => {
      if (target === globalThis && key === "wobbleScene" && descriptor.value?.renderer) {
        const renderer = descriptor.value.renderer
        renderer.setPixelRatio(0.25)
        renderer.shadowMap.enabled = false
        const render = renderer.render.bind(renderer)
        let last = -1000
        renderer.render = (...args) => {
          const now = performance.now()
          if (now - last < 1000) return
          last = now
          render(...args)
        }
        Object.defineProperty = define
      }
      return define(target, key, descriptor)
    }
  })
  await page.goto(base, { waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => !!window.wobble)
  await page.evaluate(() => {
    window.countdownLabels = []
    const el = document.querySelector("#countdown")
    new MutationObserver((records) => {
      for (const record of records)
        if (record.type === "childList") window.countdownLabels.push(el.textContent)
    }).observe(el, { childList: true })
  })
  await page.click('[data-course="lift-lock"]')
  await page.click("#play-solo")
  await page.waitForFunction(() => window.wobble.state().phase === "racing")
  const labels = await page.evaluate(() => window.countdownLabels)
  for (const label of ["3", "2", "1"]) {
    assert.equal(
      labels.filter((x) => x === label).length,
      1,
      `one text/animation update for ${label}`,
    )
  }
  assert.equal(labels.length, 4, "three numbers and Go, without per-tick mutations")
  await page.waitForTimeout(2000)
  const pose = () =>
    page.evaluate(() => {
      const c = window.wobbleScene.camera,
        p = window.wobble.state().position
      const runner = window.wobbleScene.scene.children.find(
        (g) =>
          g.isGroup &&
          Math.hypot(g.position.x - p.x, g.position.z - p.z) < 0.01 &&
          Math.abs(g.position.y + 0.45 - p.y) < 0.01,
      )
      return {
        yaw: Math.atan2(p.x - c.position.x, p.z - c.position.z),
        facing: runner?.rotation.y,
        position: p,
      }
    })
  const start = await pose()
  await page.keyboard.down("KeyQ")
  await page.waitForTimeout(550)
  await page.keyboard.up("KeyQ")
  await page.waitForTimeout(450)
  const q = await pose()
  assert(q.yaw - start.yaw > 0.4, "Q rotates the actual follow camera")
  await page.keyboard.down("KeyE")
  await page.waitForTimeout(550)
  await page.keyboard.up("KeyE")
  await page.waitForTimeout(450)
  const e = await pose()
  assert(e.yaw < q.yaw - 0.4, "E rotates the opposite way")
  await page.keyboard.press("KeyC")
  await page.waitForTimeout(1000)
  const centered = await pose()
  assert.equal(typeof e.facing, "number", "read actual runner facing")
  assert(
    Math.abs(Math.atan2(Math.sin(centered.yaw - e.facing), Math.cos(centered.yaw - e.facing))) <
      0.2,
    "C recentres behind the stationary runner",
  )
  assert(
    Math.hypot(centered.position.x - start.position.x, centered.position.z - start.position.z) <
      0.1,
    "camera keys do not move the player",
  )
  await page.screenshot({ path: `${out}/camera-controls.png` })
  for (const [index, id] of [
    "lift-lock",
    "shutter-shuttle",
    "sky-transfer",
    "pendulum-pier",
  ].entries()) {
    if (index > 0) {
      await page.click("#menu-btn")
      await page.click(`[data-course="${id}"]`)
      await page.click("#play-solo")
      await page.waitForFunction(() => window.wobble.state().phase === "racing")
    }
    await page.evaluate(() => window.wobble.autopilot(true, 0))
    await page.waitForFunction(() => window.wobble.state().phase === "finished", null, {
      timeout: 240_000,
    })
    const state = await page.evaluate(() => window.wobble.state())
    assert(state.raceMs < 180_000, `${id}: actual physics reaches the finish`)
    races.push(state)
    await page.screenshot({ path: `${out}/${id}-finish.png` })
    console.log("MECHANISM_RACE_PASS", id, state.raceMs)
  }
  assert.deepEqual(errors, [])
  await writeFile(
    `${out}/summary.json`,
    JSON.stringify({ base, labels, start, q, e, centered, races, errors }, null, 2),
  )
  console.log("MECHANISM_CONTROLS_PASS")
} finally {
  await browser.close()
}
