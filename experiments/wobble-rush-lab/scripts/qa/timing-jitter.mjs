/** Focused two-browser check: real controls and bar transforms under ordered jitter. */
import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { chromium } from "@playwright/test"

const base = process.env.LAB_URL || "http://127.0.0.1:19003"
const out = process.env.LAB_EVIDENCE || "evidence/timing-jitter"
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
  for (let index = 0; index < contexts.length; index++) {
    await contexts[index].addInitScript((jitter) => {
      globalThis.qaTiming = { samples: [], messages: [], frames: 0, recording: false }
      const define = Object.defineProperty
      Object.defineProperty = (target, key, descriptor) => {
        if (target === globalThis && key === "wobbleScene" && descriptor.value?.renderer) {
          const { renderer, scene } = descriptor.value
          renderer.setPixelRatio(0.125)
          renderer.shadowMap.enabled = false
          renderer.render = () => {
            if (!qaTiming.recording) return
            let arm = null
            scene.traverse((object) => {
              if (arm === null && object.name === "sweeper:sweep-2") arm = object
            })
            if (arm !== null)
              qaTiming.samples.push({
                at: globalThis.wobble.state().renderAtMs,
                angle: arm.rotation.y,
                worldTimeSec: globalThis.wobble.state().renderWorldTimeSec,
              })
          }
          Object.defineProperty = define
        }
        return define(target, key, descriptor)
      }
      const Native = globalThis.WebSocket
      globalThis.WebSocket = class extends Native {
        addEventListener(type, listener, options) {
          if (type !== "message") return super.addEventListener(type, listener, options)
          let deliveredAt = 0
          let pending = Promise.resolve()
          super.addEventListener(
            type,
            (event) => {
              const message = JSON.parse(event.data)
              const now = performance.now()
              let delay = jitter ? 35 : 0
              if (message.type === "frame") {
                qaTiming.frames++
                // A regular 100 ms delay spike, plus changing apparent RTT.
                if (jitter) delay += qaTiming.frames % 10 === 0 ? 100 : (qaTiming.frames % 3) * 12
              }
              deliveredAt = Math.max(now + delay, deliveredAt + 0.1)
              const due = deliveredAt
              pending = pending
                .then(
                  () =>
                    new Promise((resolve) =>
                      setTimeout(resolve, Math.max(0, due - performance.now())),
                    ),
                )
                .then(() => {
                  if (this.readyState !== Native.OPEN) return
                  if (typeof listener === "function") listener.call(this, event)
                  else listener.handleEvent(event)
                  if (message.type === "frame" || message.type === "phase")
                    qaTiming.messages.push({
                      at: performance.now(),
                      type: message.type,
                      tick: message.tick,
                      worldTimeSec: message.worldTimeSec,
                      phase: message.phase,
                      local: globalThis.wobble?.state().worldTimeSec,
                    })
                })
            },
            options,
          )
        }
      }
    }, index === 1)
  }
  const pages = await Promise.all(contexts.map((context) => context.newPage()))
  for (const page of pages) {
    page.setDefaultTimeout(90_000)
    page.on("pageerror", (error) => {
      errors.push(error.message)
      console.error("PAGE_ERROR", error.message)
    })
    page.on("console", (message) => {
      if (message.type() === "error") console.error("BROWSER_ERROR", message.text())
    })
  }
  await Promise.all(pages.map((page) => page.goto(base, { waitUntil: "domcontentloaded" })))
  await Promise.all(pages.map((page) => page.waitForFunction(() => Boolean(window.wobble))))
  console.log("BROWSERS_READY")
  const [host, guest] = pages
  await host.fill("#name-input", "Timing host")
  await host.click("#play-online")
  await host.waitForSelector('[data-screen="lobby"]:not([hidden])')
  const code = (await host.textContent("#room-code")).trim()
  await guest.fill("#name-input", "Timing guest")
  await guest.fill("#room-input", code)
  await guest.click("#play-online")
  await guest.waitForFunction(() => document.querySelectorAll("#player-list .player").length === 2)
  for (const page of pages) await page.click("#ready-btn")
  await Promise.all(
    pages.map((page) => page.waitForFunction(() => wobble.state().phase === "racing")),
  )
  // Move the focused guest with ordinary manual controls; no forged state.
  await guest.bringToFront()
  const guestStart = await guest.evaluate(() => wobble.state().position.z)
  await guest.keyboard.down("w")
  await host.waitForTimeout(1500)
  await guest.keyboard.up("w")
  assert((await guest.evaluate(() => wobble.state().position.z)) > guestStart + 2)
  const before = await Promise.all(pages.map((page) => page.evaluate(() => wobble.state())))
  await Promise.all(
    pages.map((page) =>
      page.evaluate(() => {
        qaTiming.recording = true
      }),
    ),
  )
  await host.waitForTimeout(8000)
  const results = await Promise.all(
    pages.map((page) => page.evaluate(() => ({ ...qaTiming, state: wobble.state() }))),
  )
  await mkdir(out, { recursive: true })
  await writeFile(`${out}/samples.json`, JSON.stringify(results))
  const summaries = results.map(({ samples, messages, state, frames }, index) => {
    assert(samples.length > 50)
    const slopes = []
    for (let sample = 1; sample < samples.length; sample++) {
      const dt = (samples[sample].at - samples[sample - 1].at) / 1000
      if (dt > 0.005 && dt < 0.1)
        slopes.push((samples[sample].angle - samples[sample - 1].angle) / dt)
    }
    assert(slopes.length > 40)
    const direction = Math.sign(slopes[Math.floor(slopes.length / 2)])
    const reverseSteps = slopes.filter((speed) => speed * direction < -0.01).length
    assert.equal(reverseSteps, 0)
    // Sunrise sweep-2 has constant angular speed (sweep-1 intentionally surges).
    const moving = slopes
      .map(Math.abs)
      .filter((speed) => speed > 0.01)
      .sort((a, b) => a - b)
    const median = moving[Math.floor(moving.length / 2)]
    const p99 = moving[Math.floor(moving.length * 0.99)]
    console.log(
      JSON.stringify({ index, median, p99, courseId: state.courseId, samples: samples.length }),
    )
    assert(p99 < median * 1.3)
    assert.equal(state.phase, "racing")
    assert.equal(state.remotes, 1)
    assert.equal(state.npcs, 2)
    assert(state.serverTick > before[index].serverTick + 300)
    assert(state.pendingInputs < 40)
    // Pair a drawn angle with network time at THAT draw, not with a later IPC
    // read: background/software-GPU tabs may stop drawing while sockets continue.
    const last = samples.at(-1)
    const frame = messages
      .filter((message) => message.type === "frame" && message.at <= last.at)
      .at(-1)
    assert(frame)
    const drawnWorldSec = (last.angle - (140 * Math.PI) / 180) / ((-100 * Math.PI) / 180)
    const authorityAtDraw = frame.worldTimeSec + (last.at - frame.at) / 1000
    const authorityLeadSec = drawnWorldSec - authorityAtDraw
    const clockErrorSec = drawnWorldSec - last.worldTimeSec
    assert(Math.abs(clockErrorSec) < 1e-6)
    const ticks = messages
      .filter((message) => message.type === "frame")
      .map((message) => message.tick)
    assert(ticks.every((tick, n) => n === 0 || tick >= ticks[n - 1]))
    return {
      jitter: index === 1,
      frames,
      samples: samples.length,
      reverseSteps,
      medianRadSec: median,
      p99RadSec: p99,
      clockErrorSec,
      authorityLeadSec,
      state,
    }
  })
  for (const page of pages) {
    assert(await page.locator('[data-screen="error"]').isHidden())
    await page.click("#race-menu")
  }
  assert.deepEqual(errors, [])
  const evidence = {
    base,
    checks: [
      "two-real-browser-racers",
      "manual-controls",
      "ordered-35-to-159ms-inbound-jitter",
      "actual-sweeper-transforms-never-reverse",
      "no-angular-speed-spikes",
      "bar-and-local-collision-clock-aligned-at-the-same-draw",
      "no-page-errors",
    ],
    summaries,
    errors,
    limitation: "Software GPU draws skipped; this measures JS/network timing, not device FPS.",
  }
  await mkdir(out, { recursive: true })
  await writeFile(`${out}/summary.json`, JSON.stringify(evidence, null, 2))
  console.log(JSON.stringify(evidence))
} catch (error) {
  console.error(error)
  throw error
} finally {
  await browser.close()
}
