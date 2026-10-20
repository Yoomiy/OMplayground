/** Native browsers and real sockets: ordinary network delay must not bend jump arcs. */
import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { chromium } from "@playwright/test"

const base = process.env.LAB_URL || "http://127.0.0.1:19003"
const out = process.env.LAB_EVIDENCE || "evidence/jump-quality"
await mkdir(out, { recursive: true })
const browser = await chromium.launch({
  executablePath:
    "/home/ubuntu/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux-arm64/chrome-headless-shell",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
})
const errors = []
try {
  const contexts = await Promise.all(
    [0, 1].map(() =>
      browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 0.5 }),
    ),
  )
  for (const [index, context] of contexts.entries())
    await context.addInitScript(
      ({ index, draw }) => {
        const define = Object.defineProperty
        Object.defineProperty = (target, key, descriptor) => {
          if (target === globalThis && key === "wobbleScene" && descriptor.value?.renderer) {
            const renderer = descriptor.value.renderer
            renderer.setPixelRatio(0.35)
            renderer.shadowMap.enabled = false
            if (!draw) renderer.render = () => {}
            Object.defineProperty = define
          }
          return define(target, key, descriptor)
        }
        const interval = globalThis.setInterval
        if (index)
          globalThis.setInterval = (callback, ms, ...args) =>
            interval(callback, ms === 8 ? 16 : ms, ...args)
        globalThis.qa = { sessions: 0, frames: [], closes: [], sent: 0, armed: false, jumps: 0 }
        const Native = globalThis.WebSocket
        const up = index ? 100 : 20,
          down = index ? 100 : 20
        globalThis.WebSocket = class extends Native {
          incomingAt = 0
          outgoingAt = 0
          constructor(...args) {
            super(...args)
            qa.socket = this
            super.addEventListener("close", (event) =>
              qa.closes.push({ code: event.code, reason: event.reason }),
            )
          }
          send(data) {
            const message = JSON.parse(data)
            if (message.type === "input") {
              qa.sent++
              if (message.input.jumpPressed) qa.jumps++
            }
            const jitter = index ? (qa.sent % 3) * 15 : 0
            this.outgoingAt = Math.max(this.outgoingAt, performance.now() + up + jitter)
            setTimeout(
              () => {
                if (this.readyState === Native.OPEN) super.send(data)
              },
              Math.max(0, this.outgoingAt - performance.now()),
            )
          }
          addEventListener(type, listener, options) {
            if (type !== "message") return super.addEventListener(type, listener, options)
            super.addEventListener(
              type,
              (event) => {
                const message = JSON.parse(event.data)
                this.incomingAt = Math.max(
                  this.incomingAt,
                  performance.now() + down + (index ? (qa.sent % 3) * 15 : 0),
                )
                setTimeout(
                  () => {
                    const before = globalThis.wobble?.state()
                    if (message.type === "session") qa.sessions++
                    if (typeof listener === "function") listener.call(this, event)
                    else listener.handleEvent(event)
                    const after = globalThis.wobble?.state()
                    if (qa.armed && message.type === "frame" && before && after)
                      qa.frames.push({
                        atMs: performance.now(),
                        jump: qa.jumps,
                        frameAgeBeforeMs: before.frameAgeMs,
                        leadBefore: before.predictionTick - before.serverTick,
                        incomingTick: message.tick,
                        beforeTick: before.predictionTick,
                        afterTick: after.predictionTick,
                        dy: after.position.y - before.position.y,
                        distance: Math.hypot(
                          after.position.x - before.position.x,
                          after.position.y - before.position.y,
                          after.position.z - before.position.z,
                        ),
                        tickDelta: after.predictionTick - before.predictionTick,
                        before: before.position,
                        after: after.position,
                        pending: after.pendingInputs,
                        rtt: after.rttMs,
                        replay: after.predictionHistory,
                      })
                  },
                  Math.max(0, this.incomingAt - performance.now()),
                )
              },
              options,
            )
          }
        }
      },
      { index, draw: process.env.LAB_DRAW === "1" },
    )
  const pages = await Promise.all(contexts.map((context) => context.newPage()))
  for (const page of pages) {
    page.setDefaultTimeout(90_000)
    page.on("pageerror", (error) => errors.push(error.message))
  }
  await Promise.all(pages.map((page) => page.goto(base, { waitUntil: "domcontentloaded" })))
  await Promise.all(pages.map((page) => page.waitForFunction(() => Boolean(window.wobble))))
  const [host, guest] = pages
  await host.fill("#name-input", "Fast link")
  await host.click("#play-online")
  await host.waitForSelector('[data-screen="lobby"]:not([hidden])')
  const code = (await host.textContent("#room-code")).trim()
  await guest.fill("#name-input", "Jitter link")
  await guest.fill("#room-input", code)
  await guest.click("#play-online")
  await guest.waitForFunction(() => document.querySelectorAll("#player-list .player").length === 2)
  // Let RTT calibration observe both paths before the countdown starts.
  await guest.waitForTimeout(3500)
  for (const page of pages) await page.click("#ready-btn")
  await Promise.all(
    pages.map((page) => page.waitForFunction(() => wobble.state().phase === "racing")),
  )
  await guest.waitForTimeout(2000)
  for (const page of pages)
    await page.evaluate(() => {
      qa.armed = true
    })
  for (let jump = 0; jump < 8; jump++) {
    await Promise.all(pages.map((page) => page.keyboard.down("Space")))
    await guest.waitForTimeout(jump % 2 ? 300 : 80)
    await Promise.all(pages.map((page) => page.keyboard.up("Space")))
    await guest.waitForTimeout(1000)
  }
  const reports = await Promise.all(
    pages.map((page) =>
      page.evaluate(() => ({
        sessions: qa.sessions,
        closes: qa.closes,
        sent: qa.sent,
        jumps: qa.jumps,
        state: wobble.state(),
        frames: qa.frames,
        maxVerticalCorrectionM: Math.max(0, ...qa.frames.map((frame) => Math.abs(frame.dy))),
        maxCorrectionM: Math.max(0, ...qa.frames.map((frame) => frame.distance)),
        correctionsOver5cm: qa.frames.filter((frame) => frame.distance > 0.05).length,
        verticalCorrectionsOver5cm: qa.frames.filter((frame) => Math.abs(frame.dy) > 0.05).length,
        tickChangesOnReconcile: qa.frames.filter((frame) => frame.tickDelta !== 0).length,
      })),
    ),
  )
  await writeFile(
    `${out}/summary.json`,
    JSON.stringify(
      {
        base,
        reports,
        errors,
        limitation:
          process.env.LAB_DRAW === "1"
            ? "Software GPU, low resolution; not physical-device FPS acceptance."
            : "Drawing skipped after renderer startup; tests actual browser controls, sockets and reconciliation.",
      },
      null,
      2,
    ),
  )
  for (const report of reports) {
    console.log(JSON.stringify({ ...report, frames: report.frames.length }))
    assert.equal(report.sessions, 1)
    assert.equal(report.closes.length, 0)
    assert.equal(report.jumps, 8)
    assert(report.frames.length > 150)
    assert.equal(report.verticalCorrectionsOver5cm, 0)
    assert.equal(report.tickChangesOnReconcile, 0)
  }
  // A refresh has no old RTT estimator. Admission must seed lead before frames.
  await guest.reload({ waitUntil: "domcontentloaded" })
  await guest.waitForFunction(() => globalThis.wobble?.state().phase === "racing")
  await guest.waitForTimeout(1500)
  await guest.evaluate(() => {
    qa.armed = true
  })
  for (let jump = 0; jump < 4; jump++) {
    await guest.keyboard.down("Space")
    await guest.waitForTimeout(jump % 2 ? 300 : 80)
    await guest.keyboard.up("Space")
    await guest.waitForTimeout(1000)
  }
  const refreshed = await guest.evaluate(() => ({
    state: wobble.state(),
    sessions: qa.sessions,
    closes: qa.closes,
    jumps: qa.jumps,
    frames: qa.frames,
    maxVerticalCorrectionM: Math.max(0, ...qa.frames.map((frame) => Math.abs(frame.dy))),
    verticalCorrectionsOver5cm: qa.frames.filter((frame) => Math.abs(frame.dy) > 0.05).length,
    tickChangesOnReconcile: qa.frames.filter((frame) => frame.tickDelta !== 0).length,
  }))
  console.log(JSON.stringify({ check: "refreshed-jittery-client-jumps", ...refreshed }))
  await writeFile(`${out}/refreshed.json`, JSON.stringify(refreshed, null, 2))
  assert.equal(refreshed.sessions, 1)
  assert.equal(refreshed.jumps, 4)
  assert.equal(refreshed.closes.length, 0)
  assert.equal(refreshed.verticalCorrectionsOver5cm, 0)
  assert.equal(refreshed.tickChangesOnReconcile, 0)
  assert.deepEqual(errors, [])
  for (const page of pages) await page.click("#race-menu")
} finally {
  await browser.close()
}
