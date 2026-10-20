/** Local-only lifecycle QA. Rendering is counted without GPU draws; this is not a performance test. */
import assert from "node:assert/strict"
import { chromium } from "@playwright/test"

const base = process.env.LAB_URL
assert(base && ["127.0.0.1", "localhost"].includes(new URL(base).hostname), "Set a local LAB_URL")
const browser = await chromium.launch({
  executablePath:
    process.env.LAB_CHROMIUM ||
    "/home/ubuntu/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux-arm64/chrome-headless-shell",
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
})
const errors = []
try {
  for (const failure of [false, true]) {
    const page = await browser.newPage()
    page.on("pageerror", (error) => errors.push(error.message))
    await page.addInitScript(() => {
      const resizeListeners = new Set()
      const add = globalThis.addEventListener.bind(globalThis)
      const remove = globalThis.removeEventListener.bind(globalThis)
      globalThis.addEventListener = (type, listener, options) => {
        if (type === "resize") resizeListeners.add(listener)
        add(type, listener, options)
      }
      globalThis.removeEventListener = (type, listener, options) => {
        if (type === "resize") resizeListeners.delete(listener)
        remove(type, listener, options)
      }
      globalThis.lifecycleQa = { renders: 0, resizeListeners }
      const define = Object.defineProperty
      Object.defineProperty = (target, key, descriptor) => {
        if (target === globalThis && key === "wobbleScene") {
          descriptor.value.renderer.render = () => {
            globalThis.lifecycleQa.renders++
          }
          Object.defineProperty = define
        }
        return define(target, key, descriptor)
      }
    })
    await page.goto(base, { waitUntil: "domcontentloaded" })
    await page.waitForFunction(() => globalThis.wobble && globalThis.lifecycleQa.renders > 0)
    assert.equal(await page.evaluate(() => globalThis.lifecycleQa.resizeListeners.size), 1)
    if (!failure) {
      await page.click('[data-course="sunrise-scramble"]')
      await page.click("#play-solo")
      await page.waitForFunction(() => globalThis.wobble.state().phase === "racing")
      await page.evaluate(() => globalThis.wobble.autopilot(true))
      await page.waitForFunction(() => globalThis.wobble.state().phase === "finished", null, {
        timeout: 180_000,
      })
      const finished = await page.evaluate(() => globalThis.wobble.state().position)
      await page.waitForTimeout(500)
      assert.deepEqual(await page.evaluate(() => globalThis.wobble.state().position), finished)
    }
    const stoppedAt = await page.evaluate((failure) => {
      if (failure) globalThis.dispatchEvent(new ErrorEvent("error", { message: "Lifecycle QA" }))
      else {
        globalThis.dispatchEvent(new PageTransitionEvent("pagehide"))
        globalThis.dispatchEvent(new PageTransitionEvent("pagehide"))
      }
      return globalThis.lifecycleQa.renders
    }, failure)
    await page.waitForTimeout(100)
    const disposed = await page.evaluate(() => ({
      renders: globalThis.lifecycleQa.renders,
      resizeListeners: globalThis.lifecycleQa.resizeListeners.size,
      debugGone: globalThis.wobble === undefined && globalThis.wobbleScene === undefined,
      fatal: document.querySelector("#boot-error")?.textContent,
    }))
    assert.equal(disposed.renders, stoppedAt, "disposed game stops rendering")
    assert.equal(disposed.resizeListeners, 0, "owned resize listener removed")
    assert.equal(disposed.debugGone, true, "owned debug handles removed")
    if (failure) assert.match(disposed.fatal, /Lifecycle QA/)
    console.log(
      JSON.stringify({
        check: failure ? "fatal-disposes" : "finish-freezes-and-pagehide-disposes",
        passed: true,
      }),
    )
    await page.close()
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
