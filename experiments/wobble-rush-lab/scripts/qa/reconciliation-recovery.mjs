/** Two real clients: ack stalls, snapshot stalls, backpressure and actual reconnect. */
import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { chromium } from "@playwright/test"

const base = process.env.LAB_URL || "http://127.0.0.1:19003"
const out = process.env.LAB_EVIDENCE || "evidence/reconciliation-recovery"
const browser = await chromium.launch({
  executablePath:
    "/home/ubuntu/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux-arm64/chrome-headless-shell",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
})
const errors = [],
  checks = [],
  snapshots = []
try {
  const contexts = await Promise.all(
    [0, 1].map(() =>
      browser.newContext({ viewport: { width: 900, height: 720 }, deviceScaleFactor: 0.25 }),
    ),
  )
  for (const context of contexts)
    await context.addInitScript(() => {
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
      globalThis.qa = {
        sessions: 0,
        sentInputs: 0,
        id: null,
        holdControls: false,
        holdFrames: false,
        backpressure: false,
        controls: [],
        frames: new Map(),
        lastFrame: null,
      }
      const Native = globalThis.WebSocket
      globalThis.WebSocket = class extends Native {
        constructor(...args) {
          super(...args)
          qa.socket = this
          super.addEventListener("message", (event) => {
            const message = JSON.parse(event.data)
            if (message.type === "session") qa.sessions++
            if (message.type === "welcome") qa.id = message.you
            if (message.type === "frame") qa.lastFrame = message
          })
        }
        get bufferedAmount() {
          return qa.backpressure ? 128 * 1024 : super.bufferedAmount
        }
        send(data) {
          if (qa.holdAppMessages) return
          if (JSON.parse(data).type === "input") qa.sentInputs++
          if (qa.holdControls && JSON.parse(data).type === "input") {
            qa.controls.push(data)
            return
          }
          super.send(data)
        }
        addEventListener(type, listener, options) {
          if (type !== "message") return super.addEventListener(type, listener, options)
          const deliver = (event) =>
            typeof listener === "function"
              ? listener.call(this, event)
              : listener.handleEvent(event)
          super.addEventListener(
            type,
            (event) => {
              if (qa.holdFrames && JSON.parse(event.data).type === "frame") {
                qa.frames.set(deliver, event)
                return
              }
              deliver(event)
            },
            options,
          )
        }
        flushControls() {
          qa.holdControls = false
          const count = qa.controls.length
          for (const data of qa.controls) super.send(data)
          qa.controls = []
          return count
        }
        flushFrames() {
          qa.holdFrames = false
          for (const [deliver, event] of qa.frames) deliver(event)
          qa.frames.clear()
        }
      }
    })
  const pages = await Promise.all(contexts.map((context) => context.newPage()))
  for (const page of pages) {
    page.setDefaultTimeout(90_000)
    page.on("pageerror", (error) => errors.push(error.message))
  }
  await Promise.all(pages.map((page) => page.goto(base, { waitUntil: "domcontentloaded" })))
  await Promise.all(pages.map((page) => page.waitForFunction(() => Boolean(window.wobble))))
  const [host, guest] = pages
  await host.fill("#name-input", "Recovery host")
  await host.click("#play-online")
  await host.waitForSelector('[data-screen="lobby"]:not([hidden])')
  const code = (await host.textContent("#room-code")).trim()
  await guest.fill("#name-input", "Recovery guest")
  await guest.fill("#room-input", code)
  await guest.click("#play-online")
  await guest.waitForFunction(() => document.querySelectorAll("#player-list .player").length === 2)
  for (const page of pages) await page.click("#ready-btn")
  await Promise.all(
    pages.map((page) => page.waitForFunction(() => wobble.state().phase === "racing")),
  )
  await guest.bringToFront()
  const identity = await guest.evaluate(() => ({ id: qa.id, sessions: qa.sessions }))
  const stable = async (label) => {
    const state = await guest.evaluate(() => ({
      ...wobble.state(),
      sessions: qa.sessions,
      id: qa.id,
    }))
    assert.equal(state.id, identity.id)
    assert.equal(state.sessions, identity.sessions)
    assert(state.predictionHistory <= 120)
    assert(await guest.locator("#reconnect-overlay").isHidden())
    snapshots.push({ label, state })
    console.log(
      JSON.stringify({
        check: label,
        pending: state.pendingInputs,
        history: state.predictionHistory,
        sessions: state.sessions,
      }),
    )
    checks.push(label)
  }
  await guest.evaluate(() => {
    qa.holdControls = true
  })
  await guest.waitForFunction(() => wobble.state().pendingInputs >= 140, {}, { timeout: 15_000 })
  await stable("over-two-seconds-of-unacked-inputs-do-not-reconnect")
  assert(await guest.locator("#connection-delayed").isVisible())
  const controls = await guest.evaluate(() => qa.socket.flushControls())
  assert(controls >= 15 && controls < 60)
  await guest.waitForFunction(() => {
    const state = wobble.state()
    return state.pendingInputs <= state.predictionHistory + 12
  })
  await stable("clumped-controls-resynchronize-on-the-same-socket")
  await guest.evaluate(() => {
    qa.holdFrames = true
  })
  await guest.waitForFunction(
    () => wobble.state().predictionFrozen && wobble.state().frameAgeMs > 800,
  )
  await stable("missing-snapshots-freeze-bounded-prediction-without-reconnecting")
  assert(await guest.locator("#connection-delayed").isVisible())
  await guest.waitForTimeout(1800)
  await guest.evaluate(() => qa.socket.flushFrames())
  await guest.waitForFunction(
    () => !wobble.state().predictionFrozen && wobble.state().frameAgeMs < 250,
  )
  await stable("latest-snapshot-restores-prediction")
  await guest.evaluate(() => {
    qa.backpressure = true
  })
  // Backpressure is a wall-clock event. Headless RAF can throttle, so do not
  // hold it until an assumed number of rendered input frames has accumulated.
  await guest.waitForTimeout(3000)
  await stable("brief-outbound-backpressure-does-not-reconnect")
  await guest.evaluate(() => {
    qa.backpressure = false
  })
  await guest.waitForFunction(() => {
    const state = wobble.state()
    return state.pendingInputs <= state.predictionHistory + 12
  })
  await stable("coalesced-latest-controls-resume-after-backpressure")
  const sentBeforePause = await guest.evaluate(() => {
    const native = globalThis.requestAnimationFrame
    let paused = null
    globalThis.requestAnimationFrame = (callback) => {
      paused = callback
      return 0
    }
    qa.resumeDraws = () => {
      globalThis.requestAnimationFrame = native
      if (paused) native(paused)
    }
    return qa.sentInputs
  })
  await guest.waitForTimeout(3000)
  const sentDuringPause = await guest.evaluate(() => qa.sentInputs - 0)
  assert(sentDuringPause - sentBeforePause > 20)
  await stable("three-seconds-without-rendering-keeps-controls-and-physics-running")
  await guest.evaluate(() => qa.resumeDraws())
  if (process.env.LAB_TIMER_THROTTLE === "1") {
    await guest.evaluate(() => {
      qa.holdAppMessages = true
    })
    // Exceed the old 30 s application-message timeout. Native browser pong
    // frames still prove the transport is alive while JS writes are silent.
    await guest.waitForTimeout(32_000)
    await stable("background-timer-silence-does-not-kill-a-live-transport")
    await guest.evaluate(() => {
      qa.holdAppMessages = false
    })
    await guest.waitForFunction(() => {
      const state = wobble.state()
      return state.pendingInputs <= state.predictionHistory + 12
    })
  }
  const epoch = await guest.evaluate(
    () => qa.lastFrame.actors.find((actor) => actor.id === qa.id).respawnSeq,
  )
  await guest.keyboard.press("r")
  await guest.waitForFunction(
    (before) => qa.lastFrame.actors.find((actor) => actor.id === qa.id).respawnSeq > before,
    epoch,
  )
  await stable("respawn-is-authoritative-and-preserves-identity")
  await guest.evaluate(() => qa.socket.close(4000, "QA actual drop"))
  await guest.waitForFunction(
    (before) => qa.sessions === before + 1 && wobble.state().phase === "racing",
    identity.sessions,
  )
  assert.equal(await guest.evaluate(() => qa.id), identity.id)
  checks.push("actual-socket-loss-resumes-the-same-racer")
  assert.equal(await host.evaluate(() => qa.sessions), 1)
  checks.push("unimpaired-client-stays-connected")
  const compressed = await Promise.all(
    pages.map((page) => page.evaluate(() => qa.socket.extensions.includes("permessage-deflate"))),
  )
  assert(compressed.every(Boolean))
  checks.push("both-native-browsers-negotiate-snapshot-compression")
  let results = []
  if (process.env.LAB_RECOVERY_ONLY !== "1") {
    console.log("Network recovery checks passed; completing one real race")
    await Promise.all(
      pages.map((page, index) => page.evaluate((route) => wobble.autopilot(true, route), index)),
    )
    await Promise.all(
      pages.map((page) =>
        page.waitForSelector('[data-screen="finish"]:not([hidden])', { timeout: 185_000 }),
      ),
    )
    results = await Promise.all(
      pages.map((page) => page.locator("#results .results__row").allTextContents()),
    )
    assert.deepEqual(results[0], results[1])
    assert(results[0].every((row) => !row.includes("ללא סיום")))
    checks.push("both-racers-finish-a-real-race-with-matching-results")
  }
  const health = await (await fetch(`${base}/api/health`)).json()
  assert.equal(health.metrics.rejectedMessages, 0)
  assert.equal(health.metrics.overloadStops, 0)
  assert(health.metrics.clientReports > 0)
  assert(health.metrics.resyncRequests > 0)
  assert.deepEqual(errors, [])
  await mkdir(out, { recursive: true })
  const summary = {
    base,
    checks,
    snapshots,
    controls,
    results,
    health,
    errors,
    limitation:
      "Software GPU draws skipped; not a physical-device FPS or Internet capacity measurement.",
  }
  await writeFile(`${out}/summary.json`, JSON.stringify(summary, null, 2))
  console.log(JSON.stringify(summary))
  for (const page of pages)
    await page.click(process.env.LAB_RECOVERY_ONLY === "1" ? "#race-menu" : "#menu-btn")
} catch (error) {
  console.error(error)
  throw error
} finally {
  await browser.close()
}
