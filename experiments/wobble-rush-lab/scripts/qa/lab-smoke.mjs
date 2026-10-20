import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdir, writeFile } from "node:fs/promises"
import { chromium } from "@playwright/test"

const base = process.env.LAB_URL || "https://wobble.labs.play-ormenachem.com"
const selectedCourse = process.env.LAB_COURSE || "cloudline-fork"
const expectedCourses = 23
const previewCourses = process.env.LAB_PREVIEWS !== "skip"
const out = process.env.LAB_EVIDENCE || "evidence/public-content"
const skipRendering = process.env.LAB_RENDER === "skip"
const guestDelayMs = Number(process.env.LAB_GUEST_DELAY_MS || 0)
const reconnectChecks = process.env.LAB_RECONNECT === "1"
const reconnectEvidence = []
let intentionalOutage = false
assert(Number.isFinite(guestDelayMs) && guestDelayMs >= 0 && guestDelayMs <= 500)
await mkdir(out, { recursive: true })
const browser = await chromium.launch({
  executablePath:
    process.env.LAB_CHROMIUM ||
    "/home/ubuntu/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux-arm64/chrome-headless-shell",
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
})
const errors = []
const frames = [[], []]
const sentFrames = [[], []]
const resources = []
const state = (page) =>
  page.evaluate(() => ({
    ...window.wobble.state(),
    sampledAtMs: Date.now(),
    clockSample: globalThis.wobbleQaClock,
  }))
const sample = () => {
  if (!base.startsWith("https:")) return
  const properties = execFileSync(
    "systemctl",
    [
      "show",
      "playground-lab-wobble.service",
      "-p",
      "CPUUsageNSec",
      "-p",
      "MemoryCurrent",
      "-p",
      "MemoryPeak",
      "-p",
      "NRestarts",
    ],
    { encoding: "utf8" },
  )
  resources.push({ wallMs: Date.now(), properties })
}
try {
  sample()
  const contexts = await Promise.all(
    [0, 1].map(() =>
      browser.newContext({ viewport: { width: 900, height: 720 }, deviceScaleFactor: 0.25 }),
    ),
  )
  for (const context of contexts) context.setDefaultTimeout(90_000)
  const pages = await Promise.all(contexts.map((context) => context.newPage()))
  if (reconnectChecks) {
    for (const page of pages)
      await page.addInitScript(() => {
        const Native = globalThis.WebSocket
        globalThis.WebSocket = class extends Native {
          constructor(...args) {
            super(...args)
            globalThis.wobbleQaSocket = this
          }
        }
      })
  }
  if (guestDelayMs > 0)
    await pages[1].addInitScript((delayMs) => {
      const NativeWebSocket = globalThis.WebSocket
      globalThis.WebSocket = class extends NativeWebSocket {
        send(data) {
          setTimeout(() => {
            if (this.readyState === NativeWebSocket.OPEN) super.send(data)
          }, delayMs)
        }
        addEventListener(type, listener, options) {
          if (type !== "message") {
            super.addEventListener(type, listener, options)
            return
          }
          super.addEventListener(
            type,
            (event) => {
              setTimeout(() => {
                if (this.readyState !== NativeWebSocket.OPEN) return
                if (typeof listener === "function") listener.call(this, event)
                else listener.handleEvent(event)
              }, delayMs)
            },
            options,
          )
        }
      }
    }, guestDelayMs)
  // Install QA rendering limits before the first frame queues GPU work.
  await Promise.all(
    pages.map((page) =>
      page.addInitScript(
        ({ pixelRatio, drawMs }) => {
          const define = Object.defineProperty
          Object.defineProperty = (target, key, descriptor) => {
            if (target === globalThis && key === "wobbleScene" && descriptor.value?.renderer) {
              const renderer = descriptor.value.renderer
              renderer.setPixelRatio(pixelRatio)
              renderer.shadowMap.enabled = false
              const render = renderer.render.bind(renderer)
              let lastDraw = -1000
              renderer.render = (...args) => {
                // Pair the simulation clock with its frame timestamp BEFORE a
                // synchronous software GPU stall can delay the caller's read.
                const snap = globalThis.wobble?.state()
                if (snap)
                  globalThis.wobbleQaClock = {
                    worldTimeSec: snap.worldTimeSec,
                    sampledAtMs: Date.now(),
                    courseId: snap.courseId,
                    round: snap.session?.round,
                  }
                if (drawMs < 0) {
                  globalThis.wobbleQaPaint = snap?.courseId
                  return
                }
                const now = performance.now()
                if (now - lastDraw < drawMs) return
                lastDraw = now
                render(...args)
                globalThis.wobbleQaPaint = snap?.courseId
              }
              Object.defineProperty = define
            }
            return define(target, key, descriptor)
          }
        },
        {
          pixelRatio: Number(process.env.LAB_PIXEL_RATIO || 0.25),
          drawMs: skipRendering ? -1 : Number(process.env.LAB_DRAW_MS || 1000),
        },
      ),
    ),
  )
  for (const [index, page] of pages.entries()) {
    page.on("pageerror", (error) => errors.push(error.message))
    page.on("websocket", (socket) => {
      socket.on("framesent", (event) => {
        try {
          sentFrames[index].push(JSON.parse(String(event.payload)))
        } catch {
          /* keepalive */
        }
      })
      socket.on("framereceived", (event) => {
        try {
          frames[index].push(JSON.parse(String(event.payload)))
        } catch {
          /* worker keepalive */
        }
      })
      socket.on("socketerror", (error) => {
        if (!(intentionalOutage && index === 1)) errors.push(String(error))
      })
    })
  }
  await Promise.all(pages.map((page) => page.goto(base, { waitUntil: "domcontentloaded" })))
  const [host, guest] = pages
  await Promise.all(
    pages.map((page) => page.waitForFunction(() => !!window.wobble, null, { timeout: 90_000 })),
  )
  assert.equal(await host.locator(".course-card").count(), expectedCourses)
  await host.fill("#course-search", "Cloudline")
  assert.equal(await host.locator(".course-card:visible").count(), 1)
  await host.fill("#course-search", "no such course")
  assert.equal(await host.locator(".course-card:visible").count(), 0)
  assert.match(await host.textContent("#course-count"), /לא נמצאו מסלולים/)
  await host.fill("#course-search", "")
  assert.equal(await host.locator(".course-card:visible").count(), expectedCourses)
  const playBounds = await host.locator("#play-online").boundingBox()
  assert(
    playBounds && playBounds.y + playBounds.height <= 720,
    "Play controls fit the desktop viewport",
  )
  if (!skipRendering) await host.screenshot({ path: `${out}/course-menu.png` })
  await host.click(`[data-course="${selectedCourse}"]`)
  await host.selectOption("#start-mode", "cup")
  await host.check("#start-remix")
  await host.fill("#name-input", "LabHost")
  await host.click("#play-online")
  await host.waitForSelector('[data-screen="lobby"]:not([hidden])')
  await host.waitForFunction(() => window.wobble.state().session.mode === "cup")
  const code = (await host.textContent("#room-code")).trim()
  assert.match(code, /^[A-HJ-NP-Z]{4}$/)
  await guest.fill("#name-input", "LabGuest")
  await guest.fill("#room-input", code)
  await guest.click("#play-online")
  await Promise.all(
    pages.map((page) =>
      page.waitForFunction(() => document.querySelectorAll("#player-list .player").length === 2),
    ),
  )
  assert(await guest.locator("#lobby-course").isDisabled())
  await guest.click("#ready-btn")
  await host.selectOption("#lobby-course", "sky-hop")
  await Promise.all(
    pages.map((page) =>
      page.waitForFunction(
        () =>
          window.wobble.state().courseId === "sky-hop" &&
          document.querySelector("#ready-btn").dataset.ready === "false",
      ),
    ),
  )
  await host.selectOption("#lobby-course", selectedCourse)
  await Promise.all(
    pages.map((page) =>
      page.waitForFunction(
        (expected) => window.wobble.state().courseId === expected,
        selectedCourse,
      ),
    ),
  )
  const playlist = (await state(host)).session.playlist
  assert.equal(new Set(playlist).size, 3)
  assert.deepEqual((await state(guest)).session.playlist, playlist)
  console.log("SHARED_SELECTION_PASS", JSON.stringify({ code, playlist }))
  const rounds = []
  for (let round = 0; round < 3; round++) {
    await Promise.all(
      pages.map((page) =>
        page.waitForFunction((expected) => globalThis.wobbleQaPaint === expected, playlist[round], {
          timeout: 90_000,
        }),
      ),
    )
    await host.click("#ready-btn")
    await guest.click("#ready-btn")
    await Promise.all(
      pages.map((page) => page.waitForFunction(() => window.wobble.state().phase === "racing")),
    )
    await Promise.all(
      pages.map((page, index) =>
        page.evaluate((route) => window.wobble.autopilot(true, route), index === 0 ? 2 : 1),
      ),
    )
    const initial = await Promise.all(pages.map(state))
    assert(initial.every((s) => s.courseId === playlist[round] && s.session.round === round))
    let movingChecked = false
    let reconnected = false
    let done = false
    const deadline = Date.now() + 190_000
    while (Date.now() < deadline) {
      await host.waitForTimeout(5000)
      const snapshots = await Promise.all(pages.map(state))
      console.log("RACE", round + 1, JSON.stringify(snapshots))
      sample()
      if (
        reconnectChecks &&
        !reconnected &&
        round < 2 &&
        snapshots[1].checkpoint >= 1 &&
        snapshots[1].phase === "racing"
      ) {
        const you = frames[1].findLast((message) => message.type === "welcome").you
        const before = snapshots[1]
        if (round === 0) {
          await guest.reload({ waitUntil: "domcontentloaded" })
        } else {
          intentionalOutage = true
          await contexts[1].setOffline(true)
          await guest.evaluate(() => globalThis.wobbleQaSocket.close(4000, "QA network drop"))
          await guest.waitForSelector("#reconnect-overlay:not([hidden])")
          await guest.waitForTimeout(1500)
          await contexts[1].setOffline(false)
        }
        await guest.waitForFunction(
          (code) =>
            window.wobble?.state().room === code &&
            window.wobble.state().phase === "racing" &&
            document.querySelector("#reconnect-overlay").hidden,
          code,
        )
        intentionalOutage = false
        assert.equal(frames[1].findLast((message) => message.type === "welcome").you, you)
        const after = await state(guest)
        assert(after.checkpoint >= before.checkpoint)
        assert(after.serverTick >= before.serverTick)
        assert.equal(after.session.round, round)
        await guest.evaluate(() => window.wobble.autopilot(true, 1))
        assert.equal(await guest.locator("#section-hint").count(), 0)
        reconnectEvidence.push({
          type: round === 0 ? "refresh" : "offline-retry",
          round,
          beforeCheckpoint: before.checkpoint,
          afterCheckpoint: after.checkpoint,
        })
        reconnected = true
      }
      if (!movingChecked && snapshots.every((s) => s.position.z > 0)) {
        assert(snapshots.every((s) => s.remotes === 1))
        assert(
          snapshots.every((s) => s.remoteProgress.some((z) => z > -3)),
          "remote runners move",
        )
        assert(
          snapshots.every(
            (s) => s.clockSample?.courseId === playlist[round] && s.clockSample.round === round,
          ),
          "clock sample belongs to this round",
        )
        assert(
          Math.abs(
            snapshots[0].clockSample.worldTimeSec -
              snapshots[0].clockSample.sampledAtMs / 1000 -
              (snapshots[1].clockSample.worldTimeSec - snapshots[1].clockSample.sampledAtMs / 1000),
          ) < 1,
          "shared obstacle clock within software-render sampling tolerance",
        )
        if (!skipRendering) await host.screenshot({ path: `${out}/round-${round + 1}-race.png` })
        movingChecked = true
      }
      if (
        frames.every((messages) =>
          messages.some((m) => m.type === "results" && m.session?.round === round),
        )
      ) {
        done = true
        break
      }
    }
    assert(done && movingChecked, "round finished with both clients moving")
    const resultFrames = frames.map((messages) =>
      messages.find((m) => m.type === "results" && m.session?.round === round),
    )
    assert.deepEqual(resultFrames[0], resultFrames[1])
    assert(
      resultFrames[0].results.every((r) => r.timeMs > 0),
      "both runners finish through real physics before deadline",
    )
    await Promise.all(
      pages.map((page) => page.waitForSelector('[data-screen="finish"]:not([hidden])')),
    )
    assert.equal(
      await host.locator("#results").innerText(),
      await guest.locator("#results").innerText(),
    )
    assert.equal(
      await host.locator("#cup-standings").innerText(),
      await guest.locator("#cup-standings").innerText(),
    )
    assert.match(await host.textContent("#winner-announcement"), /הזוכה|זכייה משותפת|תיקו/)
    assert.equal(
      await host.textContent("#winner-announcement"),
      await guest.textContent("#winner-announcement"),
    )
    if (reconnectChecks && round < 2) assert(reconnected, "requested reconnect scenario ran")
    rounds.push(resultFrames[0])
    if (!skipRendering) await host.screenshot({ path: `${out}/round-${round + 1}-results.png` })
    console.log("ROUND_PASS", JSON.stringify(resultFrames[0]))
    if (round < 2) {
      await host.click("#restart-btn")
      await Promise.all(
        pages.map((page) => page.waitForSelector('[data-screen="lobby"]:not([hidden])')),
      )
      await Promise.all(
        pages.map((page) =>
          page.waitForFunction(
            (expected) => window.wobble.state().courseId === expected,
            playlist[round + 1],
          ),
        ),
      )
      assert(await host.locator("#lobby-course").isDisabled(), "cup route locks between rounds")
    }
  }
  assert.equal(rounds[2].session.complete, true)
  assert.equal(await host.textContent("#restart-btn"), "גביע חדש")
  if (reconnectChecks) {
    const saved = await guest.evaluate(() => sessionStorage.getItem("wobble-resume-session"))
    assert(saved)
    const beforeResumeCount = sentFrames[1].filter((message) => message.type === "resume").length
    const replacement = await contexts[1].newPage()
    replacement.on("pageerror", (error) => errors.push(error.message))
    await replacement.addInitScript((saved) => {
      sessionStorage.setItem("wobble-resume-session", saved)
      const define = Object.defineProperty
      Object.defineProperty = (target, key, descriptor) => {
        if (target === globalThis && key === "wobbleScene" && descriptor.value?.renderer) {
          descriptor.value.renderer.render = () => {}
          Object.defineProperty = define
        }
        return define(target, key, descriptor)
      }
    }, saved)
    await replacement.goto(base, { waitUntil: "domcontentloaded" })
    await replacement.waitForSelector('[data-screen="finish"]:not([hidden])')
    await guest.waitForSelector('[data-screen="error"]:not([hidden])')
    assert.match(await guest.textContent("#error-message"), /בלשונית אחרת/)
    assert.equal(
      await replacement.textContent("#winner-announcement"),
      await host.textContent("#winner-announcement"),
    )
    assert.equal(
      await replacement.locator("#cup-standings").innerText(),
      await host.locator("#cup-standings").innerText(),
    )
    await guest.waitForTimeout(1500)
    assert.equal(
      sentFrames[1].filter((message) => message.type === "resume").length,
      beforeResumeCount,
    )
    reconnectEvidence.push({ type: "finished-cup-restored-and-old-tab-fenced" })
    pages[1] = replacement
  }
  await host.click("#restart-btn")
  await Promise.all(
    pages.map((page) => page.waitForSelector('[data-screen="lobby"]:not([hidden])')),
  )
  assert.equal((await state(host)).session.round, 0)
  assert.deepEqual((await state(host)).session.standings, [])
  await Promise.all(pages.map((page) => page.click("#leave-btn")))
  const previewed = []
  const ids = previewCourses
    ? await host.locator(".course-card").evaluateAll((cards) => cards.map((c) => c.dataset.course))
    : []
  for (const id of ids) {
    await host.click(`[data-course="${id}"]`)
    await host.click("#play-solo")
    await host.waitForFunction((expected) => window.wobble.state().courseId === expected, id)
    await host.waitForTimeout(750)
    if (!skipRendering) await host.screenshot({ path: `${out}/${id}-preview.png` })
    assert.equal(await host.locator("#boot-error").count(), 0)
    previewed.push(id)
    await host.click("#race-menu")
    await host.waitForSelector('[data-screen="start"]:not([hidden])')
  }
  assert.deepEqual(errors, [])
  const authoritative = frames.some((messages) =>
    messages.some((message) => message.type === "authority"),
  )
  let authority = null
  if (authoritative) {
    assert(
      sentFrames.every(
        (messages) =>
          !messages.some((message) => message.type === "state" || message.type === "finish"),
      ),
      "clients send no transform/result claims",
    )
    assert(
      sentFrames.every((messages) => messages.some((message) => message.type === "input")),
      "both clients send controls",
    )
    const raceIds = [
      ...new Set(
        frames[0].filter((message) => message.type === "frame").map((message) => message.raceId),
      ),
    ]
    assert.equal(raceIds.length, 3)
    const finishes = raceIds.map((raceId) => {
      const last = frames[0]
        .filter((message) => message.type === "frame" && message.raceId === raceId)
        .at(-1)
      const humans = last.actors.filter((actor) => !actor.npc)
      assert.equal(humans.length, 2)
      assert(humans.every((actor) => actor.finishedMs > 0 && actor.sim.checkpoint >= 1))
      assert(
        last.actors.some((actor) => actor.npc),
        "NPCs are host-owned",
      )
      return {
        raceId,
        tick: last.tick,
        humans: humans.map((actor) => ({
          id: actor.id,
          ack: actor.ack,
          checkpoint: actor.sim.checkpoint,
          finishedMs: actor.finishedMs,
        })),
      }
    })
    authority = {
      finishes,
      inputCounts: sentFrames.map(
        (messages) => messages.filter((message) => message.type === "input").length,
      ),
      health: await (await fetch(`${base}/api/health`)).json(),
    }
  }
  sample()
  await writeFile(
    `${out}/summary.json`,
    JSON.stringify(
      {
        base,
        skipRendering,
        limitation: skipRendering
          ? "Drawing/screenshots skipped after renderer startup; functional gameplay, not physical FPS or visual acceptance."
          : "Software GPU captures, not physical-device performance.",
        guestDelayMs,
        code,
        playlist,
        rounds,
        previewed,
        resources,
        authority,
        errors,
        reconnectEvidence,
        checks: [
          "twenty-three-course-searchable-menu",
          "desktop-play-controls-visible",
          "shared-host-selection",
          "guest-controls-disabled",
          "ready-reset-on-change",
          "three-actual-course-races",
          "local-and-remote-movement",
          "different-branch-pilots",
          "shared-obstacle-clock",
          "matching-results-and-cup-standings",
          "winner-announcement",
          ...(reconnectChecks
            ? [
                "refresh-restores-progress",
                "temporary-outage-retry",
                "duplicate-tab-takeover",
                "finished-cup-restoration",
                "no-section-challenge-copy",
              ]
            : []),
          "next-round-ready-lobbies",
          "locked-cup-route",
          "new-cup-reset",
          ...(previewCourses ? ["all-twenty-three-course-render-and-solo-start"] : []),
          "leave-to-menu",
          ...(authoritative
            ? ["authoritative-human-and-npc-snapshots", "inputs-without-client-result-claims"]
            : []),
          ...(guestDelayMs > 0 ? ["guest-artificial-bidirectional-latency"] : []),
        ],
      },
      null,
      2,
    ),
  )
  console.log("CONTENT_MULTIPLAYER_PASS")
} finally {
  await browser.close()
}
