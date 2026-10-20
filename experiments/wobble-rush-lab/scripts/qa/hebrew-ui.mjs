/** Rendered DOM direction + native controls, with GPU game drawing suppressed. */
import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { chromium } from "@playwright/test"

const base = process.env.LAB_URL || "http://127.0.0.1:19003",
  out = process.env.LAB_EVIDENCE || "evidence/hebrew-ui"
await mkdir(out, { recursive: true })
const browser = await chromium.launch({
  executablePath:
    "/home/ubuntu/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux-arm64/chrome-headless-shell",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
})
const errors = [],
  checks = []
try {
  const contexts = await Promise.all(
    [0, 1].map(() =>
      browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 0.5 }),
    ),
  )
  for (const context of contexts)
    await context.addInitScript(() => {
      const define = Object.defineProperty
      Object.defineProperty = (target, key, descriptor) => {
        if (target === globalThis && key === "wobbleScene" && descriptor.value?.renderer) {
          descriptor.value.renderer.render = () => {}
          Object.defineProperty = define
        }
        return define(target, key, descriptor)
      }
    })
  const pages = await Promise.all(contexts.map((c) => c.newPage())),
    [host, guest] = pages
  for (const page of pages) {
    page.setDefaultTimeout(90000)
    page.on("pageerror", (e) => errors.push(e.message))
  }
  await Promise.all(pages.map((p) => p.goto(base, { waitUntil: "domcontentloaded" })))
  await Promise.all(pages.map((p) => p.waitForFunction(() => Boolean(globalThis.wobble))))
  const menu = await host.evaluate(() => ({
    lang: document.documentElement.lang,
    stageDirection: getComputedStyle(document.querySelector("#stage")).direction,
    startDirection: getComputedStyle(document.querySelector('[data-screen="start"]')).direction,
    courses: [...document.querySelectorAll(".course-card strong")].map((e) => e.textContent),
    keyDirections: [...document.querySelectorAll("kbd")].map((e) => getComputedStyle(e).direction),
    button: document.querySelector("#play-online").textContent,
  }))
  assert.equal(menu.lang, "he")
  assert.equal(menu.stageDirection, "ltr")
  assert.equal(menu.startDirection, "rtl")
  assert.equal(menu.courses.length, 23)
  assert(menu.courses.every((name) => /[א-ת]/.test(name)))
  assert(menu.keyDirections.every((dir) => dir === "ltr"))
  assert.equal(menu.button, "משחק ברשת")
  await host.fill("#course-search", "פסגה")
  assert.equal(await host.locator(".course-card:visible").count(), 1)
  await host.fill("#course-search", "Spiral")
  assert.equal(await host.locator(".course-card:visible").count(), 1)
  await host.fill("#course-search", "")
  await host.screenshot({ path: `${out}/menu.png` })
  checks.push("hebrew-menu-and-bilingual-search", "scoped-rtl-ui-ltr-canvas-and-keys")
  await host.fill("#name-input", "נועם ABC")
  await host.click("#play-online")
  await host.waitForSelector('[data-screen="lobby"]:not([hidden])')
  const code = (await host.textContent("#room-code")).trim()
  assert.match(code, /^[A-HJ-NP-Z]{4}$/)
  await guest.fill("#name-input", "Alex דנה")
  await guest.fill("#room-input", code)
  await guest.click("#play-online")
  await host.waitForFunction(() => document.querySelectorAll("#player-list .player").length === 2)
  const lobby = await host.evaluate(() => ({
    code: getComputedStyle(document.querySelector("#room-code")).direction,
    names: [...document.querySelectorAll("#player-list bdi")].map((e) => ({
      name: e.textContent,
      dir: getComputedStyle(e).direction,
    })),
    ready: document.querySelector("#ready-btn").textContent,
  }))
  assert.equal(lobby.code, "ltr")
  assert.deepEqual(lobby.names, [
    { name: "נועם ABC", dir: "rtl" },
    { name: "Alex דנה", dir: "ltr" },
  ])
  assert.equal(lobby.ready, "אפשר להתחיל")
  await host.screenshot({ path: `${out}/lobby.png` })
  checks.push("ltr-room-code-and-auto-isolated-mixed-player-names")
  for (const page of pages) await page.click("#ready-btn")
  await Promise.all(pages.map((p) => p.waitForFunction(() => wobble.state().phase === "racing")))
  await host.waitForTimeout(800)
  const before = await host.evaluate(() => wobble.state().position)
  await host.keyboard.down("KeyD")
  await host.waitForTimeout(250)
  await host.keyboard.up("KeyD")
  await host.waitForTimeout(100)
  const after = await host.evaluate(() => wobble.state().position)
  assert(
    after.x < before.x - 0.15,
    "D keeps its existing camera-relative direction after Hebrew translation",
  )
  const hud = await host.evaluate(() => ({
    timer: getComputedStyle(document.querySelector("#timer")).direction,
    place: getComputedStyle(document.querySelector("#place")).direction,
    layout: getComputedStyle(document.querySelector(".hud")).direction,
    value: document.querySelector("#place").textContent,
    title: document.querySelector("#hud-course").textContent,
    transform: getComputedStyle(document.querySelector("#stage")).transform,
  }))
  assert.equal(hud.timer, "ltr")
  assert.equal(hud.place, "ltr")
  assert.equal(hud.layout, "ltr")
  assert.match(hud.value, /^[1-4] \/ 4$/)
  assert.match(hud.title, /[א-ת]/)
  assert.equal(hud.transform, "none")
  await host.screenshot({ path: `${out}/hud.png` })
  checks.push("ltr-timer-placement-and-unchanged-hud-layout", "native-key-movement-unmirrored")
  // A short viewport must remain scrollable, with the primary action reachable.
  await host.click("#race-menu")
  await guest.click("#race-menu")
  await host.setViewportSize({ width: 800, height: 500 })
  await host.locator("#play-online").scrollIntoViewIfNeeded()
  const bounds = await host.locator("#play-online").boundingBox()
  assert(bounds && bounds.y >= 0 && bounds.y + bounds.height <= 500)
  checks.push("short-desktop-menu-actions-reachable")
  assert.deepEqual(errors, [])
  const summary = {
    base,
    checks,
    menu,
    lobby,
    hud,
    before,
    after,
    errors,
    limitation:
      "DOM screenshots and native controls; GPU game drawing suppressed, not physical-device FPS acceptance.",
  }
  await writeFile(`${out}/summary.json`, JSON.stringify(summary, null, 2))
  console.log(JSON.stringify(summary))
} finally {
  await browser.close()
}
