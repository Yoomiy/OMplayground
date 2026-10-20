import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { chromium } from "@playwright/test"

// Focused regression: real manual keyboard controls, plus delayed packet batches.
// No autopilot, forged positions or synthetic finish claims.
const base = process.env.LAB_URL || "http://127.0.0.1:19003"
const out = process.env.LAB_EVIDENCE || "evidence/input-bursts"
await mkdir(out, { recursive: true })
const browser = await chromium.launch({
  executablePath:
    "/home/ubuntu/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux-arm64/chrome-headless-shell",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
})
const errors = []
try {
  const pages = await Promise.all(
    [0, 1].map(async () => {
      const context = await browser.newContext({ viewport: { width: 900, height: 720 } })
      const page = await context.newPage()
      page.on("pageerror", (error) => errors.push(error.message))
      page.setDefaultTimeout(90_000)
      await page.addInitScript(() => {
        const define = Object.defineProperty
        Object.defineProperty = (target, key, descriptor) => {
          if (target === globalThis && key === "wobbleScene" && descriptor.value?.renderer) {
            const renderer = descriptor.value.renderer
            renderer.setPixelRatio(0.125)
            renderer.shadowMap.enabled = false
            const render = renderer.render.bind(renderer)
            let painted = false
            renderer.render = (...args) => {
              if (painted) return
              painted = true
              render(...args)
            }
            Object.defineProperty = define
          }
          return define(target, key, descriptor)
        }
        const NativeWebSocket = globalThis.WebSocket
        globalThis.inputQa = { sent: 0, maxBatch: 0, frames: 0, errors: [], closed: [] }
        globalThis.WebSocket = class extends NativeWebSocket {
          held = false
          batch = []
          constructor(...args) {
            super(...args)
            globalThis.inputQa.socket = this
            this.addEventListener("close", (event) => globalThis.inputQa.closed.push(event.reason))
            this.addEventListener("message", (event) => {
              const message = JSON.parse(event.data)
              if (message.type === "error") globalThis.inputQa.errors.push(message)
              if (message.type === "frame") globalThis.inputQa.frames++
            })
          }
          send(raw) {
            if (JSON.parse(raw).type === "input") {
              globalThis.inputQa.sent++
              if (this.held) {
                this.batch.push(raw)
                return
              }
            }
            super.send(raw)
          }
          async burst(ms) {
            this.held = true
            await new Promise((done) => setTimeout(done, ms))
            this.held = false
            globalThis.inputQa.maxBatch = Math.max(globalThis.inputQa.maxBatch, this.batch.length)
            for (const raw of this.batch) super.send(raw)
            this.batch = []
          }
        }
      })
      await page.goto(base, { waitUntil: "domcontentloaded" })
      await page.waitForFunction(() => Boolean(window.wobble))
      return page
    }),
  )
  const [host, guest] = pages
  await host.fill("#name-input", "Manual QA host")
  await host.click('[data-course="spiral-summit"]')
  await host.click("#play-online")
  await host.waitForSelector('[data-screen="lobby"]:not([hidden])')
  const code = (await host.textContent("#room-code")).trim()
  await guest.fill("#name-input", "Manual QA guest")
  await guest.fill("#room-input", code)
  await guest.click("#play-online")
  await Promise.all(
    pages.map((page) =>
      page.waitForFunction(() => document.querySelectorAll("#player-list .player").length === 2),
    ),
  )
  await host.click("#ready-btn")
  await guest.click("#ready-btn")
  await Promise.all(
    pages.map((page) => page.waitForFunction(() => window.wobble.state().phase === "racing")),
  )
  // Exercise every manual axis, variable jump, dive, camera rotation and respawn.
  for (const key of ["KeyW", "KeyD", "KeyS", "KeyA", "ArrowUp", "ArrowRight", "KeyQ", "KeyE"]) {
    await Promise.all(pages.map((page) => page.keyboard.down(key)))
    await Promise.all(pages.map((page) => page.keyboard.press("Space")))
    await Promise.all(pages.map((page) => page.evaluate(() => inputQa.socket.burst(600))))
    await Promise.all(pages.map((page) => page.keyboard.up(key)))
    await Promise.all(pages.map((page) => page.keyboard.press("ShiftLeft")))
  }
  await Promise.all(pages.map((page) => page.keyboard.press("KeyR")))
  await Promise.all(pages.map((page) => page.waitForTimeout(1000)))
  const clients = await Promise.all(
    pages.map((page) =>
      page.evaluate(() => ({
        sent: inputQa.sent,
        maxBatch: inputQa.maxBatch,
        frames: inputQa.frames,
        errors: inputQa.errors,
        closed: inputQa.closed,
        state: window.wobble.state(),
      })),
    ),
  )
  await writeFile(
    `${out}/summary.json`,
    JSON.stringify({ base, clients, pageErrors: errors }, null, 2),
  )
  console.log(JSON.stringify({ clients, pageErrors: errors }))
  assert.deepEqual(errors, [])
  for (const client of clients) {
    assert(client.sent > 250)
    assert(client.maxBatch > 24, "test exceeds the old input queue ceiling")
    assert(client.frames > 50)
    assert.deepEqual(client.errors, [])
    assert.deepEqual(client.closed, [])
    assert.equal(client.state.phase, "racing")
    assert(client.state.pendingInputs < 10, "input backlog drains after jitter")
  }
} finally {
  await browser.close()
}
