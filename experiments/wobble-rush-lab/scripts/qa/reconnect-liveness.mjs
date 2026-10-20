import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { chromium } from "@playwright/test"

const base = process.env.LAB_URL || "http://127.0.0.1:19003"
const out = process.env.LAB_EVIDENCE || "evidence/reconnect-liveness"
const browser = await chromium.launch({
  executablePath:
    "/home/ubuntu/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux-arm64/chrome-headless-shell",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
})
const errors = []
try {
  const contexts = await Promise.all(
    [0, 1].map(() =>
      browser.newContext({ viewport: { width: 900, height: 720 }, deviceScaleFactor: 0.25 }),
    ),
  )
  for (const context of contexts)
    await context.addInitScript(() => {
      // This checks networking and DOM lifecycle; it deliberately skips GPU draws.
      const define = Object.defineProperty
      Object.defineProperty = (target, key, descriptor) => {
        if (target === globalThis && key === "wobbleScene" && descriptor.value?.renderer) {
          descriptor.value.renderer.setPixelRatio(0.125)
          descriptor.value.renderer.shadowMap.enabled = false
          descriptor.value.renderer.render = () => {}
          Object.defineProperty = define
        }
        return define(target, key, descriptor)
      }
      globalThis.qaConnections = { sessions: 0, id: null }
      const Native = globalThis.WebSocket
      globalThis.WebSocket = class extends Native {
        constructor(...args) {
          super(...args)
          globalThis.qaSocket = this
          this.addEventListener("message", (event) => {
            const message = JSON.parse(event.data)
            if (message.type === "session") globalThis.qaConnections.sessions++
            if (message.type === "welcome") globalThis.qaConnections.id = message.you
          })
        }
      }
    })
  const pages = await Promise.all(contexts.map((context) => context.newPage()))
  for (const page of pages) {
    page.setDefaultTimeout(90_000)
    page.on("pageerror", (error) => errors.push(error.message))
  }
  const [host, guest] = pages
  await Promise.all(pages.map((page) => page.goto(base, { waitUntil: "domcontentloaded" })))
  await Promise.all(pages.map((page) => page.waitForFunction(() => Boolean(window.wobble))))
  await host.fill("#name-input", "Liveness host")
  await host.click("#play-online")
  await host.waitForSelector('[data-screen="lobby"]:not([hidden])')
  const code = (await host.textContent("#room-code")).trim()
  await guest.fill("#name-input", "Liveness guest")
  await guest.fill("#room-input", code)
  await guest.click("#play-online")
  await guest.waitForFunction(() => document.querySelectorAll("#player-list .player").length === 2)
  const before = await guest.evaluate(() => ({ ...qaConnections }))
  const resumeMeta = await guest.evaluate(() =>
    JSON.parse(sessionStorage.getItem("wobble-resume-session")),
  )
  await guest.evaluate(() => {
    const start = performance.now()
    while (performance.now() - start < 6500) {
      /* simulate a blocked rendering thread */
    }
  })
  await guest.waitForTimeout(1500)
  assert.deepEqual(await guest.evaluate(() => ({ ...qaConnections })), before)
  assert(await guest.locator("#reconnect-overlay").isHidden())
  await guest.evaluate(() => {
    const raf = globalThis.requestAnimationFrame
    let paused = null
    globalThis.requestAnimationFrame = (callback) => {
      paused = callback
      return 0
    }
    globalThis.qaResumeFrames = () => {
      globalThis.requestAnimationFrame = raf
      if (paused !== null) raf(paused)
    }
  })
  await guest.waitForTimeout(7000)
  assert.deepEqual(await guest.evaluate(() => ({ ...qaConnections })), before)
  await guest.evaluate(() => qaResumeFrames())
  await guest.reload({ waitUntil: "domcontentloaded" })
  await guest.waitForSelector('[data-screen="lobby"]:not([hidden])')
  assert.equal(await guest.evaluate(() => qaConnections.id), before.id)
  await contexts[1].setOffline(true)
  await guest.evaluate(() => qaSocket.close(4000, "QA drop"))
  await guest.waitForSelector("#reconnect-overlay:not([hidden])")
  await guest.waitForTimeout(350)
  await guest.click("#reconnect-leave")
  await guest.waitForSelector('[data-screen="start"]:not([hidden])')
  await contexts[1].setOffline(false)
  await guest.waitForTimeout(1500)
  assert.equal(await guest.evaluate(() => sessionStorage.getItem("wobble-resume-session")), null)
  await guest.reload({ waitUntil: "domcontentloaded" })
  await guest.waitForFunction(() => Boolean(window.wobble))
  assert(await guest.locator('[data-screen="start"]').isVisible())
  assert.equal(await guest.evaluate(() => qaConnections.sessions), 0)
  const expired = await contexts[1].newPage()
  expired.on("pageerror", (error) => errors.push(error.message))
  await expired.addInitScript(
    (ticket) => sessionStorage.setItem("wobble-resume-session", JSON.stringify(ticket)),
    { ...resumeMeta, token: "x".repeat(43) },
  )
  await expired.goto(base, { waitUntil: "domcontentloaded" })
  await expired.waitForSelector('[data-screen="error"]:not([hidden])')
  assert.match(await expired.textContent("#error-message"), /reconnect|new room/i)
  assert.equal(await expired.evaluate(() => sessionStorage.getItem("wobble-resume-session")), null)
  assert.deepEqual(errors, [])
  await mkdir(out, { recursive: true })
  await writeFile(
    `${out}/summary.json`,
    JSON.stringify(
      {
        base,
        errors,
        checks: [
          "6.5-second-render-stall-does-not-reconnect",
          "7-second-paused-render-loop-keeps-heartbeats",
          "lobby-refresh-preserves-identity",
          "cancel-offline-retry",
          "leave-clears-refresh-ticket",
          "invalid-ticket-shows-clear-error-and-clears-storage",
        ],
      },
      null,
      2,
    ),
  )
  console.log("RECONNECT_LIVENESS_PASS")
} catch (error) {
  console.error("PAGE_ERRORS", JSON.stringify(errors))
  throw error
} finally {
  await browser.close()
}
