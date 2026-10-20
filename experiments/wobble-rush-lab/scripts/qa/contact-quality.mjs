/** Native controls, delayed sockets and actual mesh transforms at player contact. */
import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { chromium } from "@playwright/test"

const base = process.env.LAB_URL || "http://127.0.0.1:19003"
const out = process.env.LAB_EVIDENCE || "evidence/contact-quality"
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
            if (!draw)
              renderer.render = () => {
                if (!globalThis.qa?.armed) return
                const state = globalThis.wobble?.state()
                const peer = state?.predictedActors?.find(
                  (actor) => !actor.npc && actor.id !== state.selfId,
                )
                const view = state?.remotePositions?.find((actor) => actor.id === peer?.id)
                if (!peer || !view) return
                const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
                qa.draws.push({
                  at: performance.now(),
                  tick: state.predictionTick,
                  simDistance: distance(state.position, peer.position),
                  drawDistance: distance(state.renderPosition, view.position),
                  xOrder: state.position.x - peer.position.x,
                  drawnOrder: state.renderPosition.x - view.position.x,
                  frameAgeMs: state.frameAgeMs,
                  respawned: state.predictedActors
                    .filter((actor) => !actor.npc)
                    .some((actor) => actor.respawnSeq !== qa.startRespawns[actor.id]),
                })
              }
            Object.defineProperty = define
          }
          return define(target, key, descriptor)
        }
        const interval = globalThis.setInterval
        if (index)
          globalThis.setInterval = (callback, ms, ...args) =>
            interval(callback, ms === 8 ? 16 : ms, ...args)
        globalThis.qa = {
          sessions: 0,
          frames: [],
          closes: [],
          sent: 0,
          armed: false,
          jumps: 0,
          draws: [],
        }
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
                    if (message.type === "frame") qa.authority = message
                    if (typeof listener === "function") listener.call(this, event)
                    else listener.handleEvent(event)
                    const after = globalThis.wobble?.state()
                    if (qa.armed && message.type === "frame" && before && after)
                      qa.frames.push({
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
  // Keep this human-contact fixture isolated from NPCs respawning onto the
  // starting plaza. They must earn checkpoint 1 through real physics first.
  await host.waitForFunction(() =>
    qa.authority?.actors.filter((actor) => actor.npc).every((actor) => actor.sim.checkpoint >= 1),
  )
  await guest.waitForTimeout(2000)
  for (const page of pages)
    await page.evaluate(() => {
      qa.startRespawns = Object.fromEntries(
        wobble
          .state()
          .predictedActors.filter((actor) => !actor.npc)
          .map((actor) => [actor.id, actor.respawnSeq]),
      )
      qa.armed = true
    })
  // Let the NPCs leave, then drive the two humans directly towards one another.
  await Promise.all([host.keyboard.down("KeyA"), guest.keyboard.down("KeyD")])
  // End after a measured steady-contact window, before releasing controls.
  // Release/recovery and spawn overlap are separate scenarios, not steady contact.
  await Promise.all(
    pages.map((page) =>
      page.waitForFunction(
        () => {
          const first = qa.draws.find((sample) => sample.simDistance < 0.95)
          return (
            first &&
            qa.draws.filter((sample) => sample.simDistance < 0.95 && sample.at > first.at + 600)
              .length >= 60
          )
        },
        null,
        { timeout: 15000 },
      ),
    ),
  )
  for (const page of pages)
    await page.evaluate(() => {
      qa.armed = false
    })
  await Promise.all([host.keyboard.up("KeyA"), guest.keyboard.up("KeyD")])
  await guest.waitForTimeout(700)
  const reports = await Promise.all(
    pages.map((page) =>
      page.evaluate(() => ({
        sessions: qa.sessions,
        closes: qa.closes,
        state: wobble.state(),
        draws: qa.draws,
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
          "Native browsers/real delayed sockets and Three mesh transforms; GPU drawing suppressed, not physical-device FPS acceptance.",
      },
      null,
      2,
    ),
  )
  for (const report of reports) {
    const contact = report.draws.filter((sample) => sample.simDistance < 0.95)
    const stable = contact.filter((sample) => sample.at > contact[0]?.at + 600)
    const minDistance = Math.min(...stable.map((sample) => sample.drawDistance))
    const summary = {
      check: "shared-world-human-contact",
      sessions: report.sessions,
      rttMs: report.state.rttMs,
      contactFrames: contact.length,
      stableFrames: stable.length,
      minDisplayedSeparationM: minDistance,
      passThroughFrames: stable.filter((sample) => sample.xOrder * sample.drawnOrder < 0).length,
    }
    console.log(JSON.stringify(summary))
    assert(
      report.draws.every((sample) => !sample.respawned),
      "Contact fixture must stay on the plaza",
    )
    assert.equal(report.sessions, 1)
    assert.deepEqual(report.closes, [])
    assert(stable.length > 30, "Must actually drive into and maintain player contact")
    assert(minDistance > 0.85, "Meshes must remain separated during known-control contact")
    assert.equal(summary.passThroughFrames, 0)
  }
  assert.deepEqual(errors, [])
  for (const page of pages) await page.click("#race-menu")
} finally {
  await browser.close()
}
