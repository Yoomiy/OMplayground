/** Real React container + native Node/WebSocket service + isolated Supabase REST fixture. */
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { once } from "node:events"
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises"
import { createServer } from "node:http"
import { fileURLToPath } from "node:url"
import { chromium } from "@playwright/test"
import type { PlatformSession } from "../../src/platform/admission"
import { PlatformGateway } from "../../src/platform/gateway"
import { createPlatformService } from "../../src/platform/service"
import type { WobbleView } from "../../src/shared/platform-view"

const repo = fileURLToPath(new URL("../../../../", import.meta.url))
const game = fileURLToPath(new URL("../../", import.meta.url))
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const sessionId = uid(100)
const parentOrigin = "http://127.0.0.1:19108",
  endpoint = "http://127.0.0.1:19106",
  dbOrigin = "http://127.0.0.1:19107"
const row: PlatformSession = {
  id: sessionId,
  host_id: uid(1),
  gender: "boy",
  status: "waiting",
  is_open: true,
  invitation_code: "fixture-invite",
  player_ids: [uid(1)],
  player_names: ["נועה Alex <QA>"],
  game_state: null,
  games: { game_url: "wobble-rush", is_active: true },
}
const revokedVoice: string[] = []
const chat: Record<string, unknown>[] = []
const audit: unknown[] = []
const report: Record<string, unknown> = {
  productionDatabaseUsed: false,
  gpuGameDraws: false,
  actualMicrophoneAudio: "untested",
}
const jsonb = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(jsonb)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value)
            .reverse()
            .map(([key, child]) => [key, jsonb(child)]),
        )
      : value
function json(response: import("node:http").ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "content-type": "application/json" })
  response.end(JSON.stringify(value))
}
const fixture = createServer((request, response) => {
  void (async () => {
    response.setHeader("Access-Control-Allow-Origin", parentOrigin)
    response.setHeader(
      "Access-Control-Allow-Headers",
      request.headers["access-control-request-headers"] ??
        "authorization,apikey,content-type,x-client-info",
    )
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS")
    if (request.method === "OPTIONS") {
      response.writeHead(204)
      response.end()
      return
    }
    const url = new URL(request.url ?? "/", dbOrigin)
    if (url.pathname === "/auth/v1/user") {
      const n = Number(request.headers.authorization?.replace("Bearer fixture-token-", ""))
      json(response, n >= 1 && n <= 4 ? 200 : 401, { id: uid(n) })
      return
    }
    const table = url.pathname.replace("/rest/v1/", "")
    if (table === "chat_messages" && request.method === "GET") {
      json(response, 200, chat)
      return
    }
    if (
      table === "game_sessions" &&
      request.method === "GET" &&
      request.headers.apikey !== "fixture-service-key"
    ) {
      json(response, 200, row)
      return
    }
    if (request.headers.apikey !== "fixture-service-key") {
      json(response, 401, {})
      return
    }
    let body: Record<string, unknown> = {}
    if (["POST", "PATCH"].includes(request.method ?? "")) {
      let raw = ""
      for await (const chunk of request) raw += chunk.toString()
      body = JSON.parse(raw)
    }
    if (table === "kid_profiles") {
      const n = Number(url.searchParams.get("id")?.slice(-12))
      json(response, 200, [
        {
          id: uid(n),
          full_name: n === 1 ? "נועה Alex <QA>" : `חבר ${n}`,
          role: n === 4 ? "teacher" : "kid",
          gender: "boy",
          grade: "ג",
          is_active: true,
        },
      ])
      return
    }
    if (
      [
        "admin_profiles",
        "game_challenges",
        "class_recess_schedule_settings",
        "class_recess_schedule_exceptions",
      ].includes(table)
    ) {
      json(response, 200, [])
      return
    }
    if (table === "recess_schedules") {
      json(
        response,
        200,
        Array.from({ length: 7 }, (_, day_of_week) => ({
          day_of_week,
          start_time: "00:00",
          end_time: "23:59",
          is_active: true,
        })),
      )
      return
    }
    if (table === "audit_log") {
      audit.push(body)
      json(response, 201, [body])
      return
    }
    if (table === "chat_messages") {
      const line = { ...body, id: uid(500 + chat.length), timestamp: new Date().toISOString() }
      chat.push(line)
      json(response, 201, [line])
      return
    }
    if (table === "game_sessions") {
      if (request.method === "PATCH") {
        if (
          url.searchParams.get("status") !== `eq.${row.status}` ||
          url.searchParams.get("host_id") !== `eq.${row.host_id}` ||
          url.searchParams.get("player_ids") !== `eq.{${row.player_ids.join(",")}}` ||
          (row.game_state?.revision
            ? url.searchParams.get("game_state->>revision") !== `eq.${row.game_state.revision}`
            : url.searchParams.get("game_state") !== "is.null")
        ) {
          json(response, 200, [])
          return
        }
        Object.assign(row, jsonb(body))
      }
      json(response, 200, [row])
      return
    }
    json(response, 404, {})
  })().catch(() => json(response, 500, {}))
})
const manifest = JSON.parse(await readFile(`${game}/app-dist/build.json`, "utf8"))
const service = createPlatformService({
  gateway: new PlatformGateway(dbOrigin, "fixture-service-key"),
  secret: "fixture-secret-with-more-than-32-characters",
  origins: [parentOrigin],
  clientDir: `${game}/app-dist/client`,
  maxRooms: 2,
  release: manifest.release,
  revokeVoice: async (_sessionId, userId) => {
    revokedVoice.push(userId)
  },
})
const qaHtml = `${repo}/apps/web/wobble-integration-qa.html`,
  qaTsx = `${repo}/apps/web/src/wobble-integration-qa.tsx`
let htmlCreated = false,
  sourceCreated = false
let vite: ReturnType<typeof spawn> | null = null
let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null
const pause = (ms: number) => new Promise((done) => setTimeout(done, ms))
async function until(predicate: () => unknown, message: string, timeout = 20_000) {
  const start = Date.now()
  while (!(await predicate())) {
    if (Date.now() - start > timeout) throw new Error(`Timed out: ${message}`)
    await pause(40)
  }
}
try {
  await mkdir(`${game}/evidence/app-integration`, { recursive: true })
  fixture.listen(19107, "127.0.0.1")
  await once(fixture, "listening")
  service.server.listen(19106, "127.0.0.1")
  await once(service.server, "listening")
  await writeFile(
    qaHtml,
    '<!doctype html><html lang="he"><body style="margin:0"><div id="root"></div><script type="module" src="/src/wobble-integration-qa.tsx"></script></body></html>',
    { flag: "wx" },
  )
  htmlCreated = true
  await writeFile(
    qaTsx,
    `import {createRoot} from 'react-dom/client'; import {BrowserRouter} from 'react-router-dom'; import {StrictMode} from 'react';
import {ThemeProvider} from './context/ThemeContext'; import {WobbleSessionContainer} from './game/WobbleSessionContainer'; import {supabase} from './lib/supabase'; import './index.css';
const params=new URLSearchParams(location.search);Object.defineProperty(supabase.auth,'getSession',{value:async()=>({data:{session:{access_token:'fixture-token-'+(params.get('qaUser')||1)}},error:null})});
Object.defineProperty(supabase,'channel',{value:()=>{const channel={on:()=>channel,subscribe:()=>channel};return channel;}});Object.defineProperty(supabase,'removeChannel',{value:async()=>{}});
createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter><ThemeProvider><WobbleSessionContainer sessionId="${sessionId}"/></ThemeProvider></BrowserRouter></StrictMode>);`,
    { flag: "wx" },
  )
  sourceCreated = true
  vite = spawn(
    process.execPath,
    [
      `${repo}/node_modules/vite/bin/vite.js`,
      "--host",
      "127.0.0.1",
      "--port",
      "19108",
      "--strictPort",
    ],
    {
      cwd: `${repo}/apps/web`,
      env: {
        ...process.env,
        NODE_ENV: "development",
        VITE_WOBBLE_SERVICE_URL: endpoint,
        VITE_SUPABASE_URL: dbOrigin,
        VITE_SUPABASE_ANON_KEY: "fixture-anon-key",
      },
      stdio: "ignore",
    },
  )
  await until(
    () =>
      fetch(`${parentOrigin}/wobble-integration-qa.html`)
        .then((response) => response.ok)
        .catch(() => false),
    "parent app",
  )
  browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ??
      "/home/ubuntu/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux-arm64/chrome-headless-shell",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
  })
  const errors: string[] = []
  const context = await browser.newContext({
    viewport: { width: 1000, height: 720 },
    deviceScaleFactor: 0.5,
  })
  await context.addInitScript(() => {
    const NativeWebSocket = window.WebSocket
    const sockets: WebSocket[] = []
    Object.defineProperty(window, "qaSockets", { value: sockets, configurable: true })
    window.WebSocket = class extends NativeWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols)
        sockets.push(this)
      }
    }
    const define = Object.defineProperty
    Object.defineProperty = (target, key, descriptor) => {
      if (target === globalThis && key === "wobbleScene" && descriptor.value?.renderer) {
        descriptor.value.renderer.render = () => {}
      }
      return define(target, key, descriptor)
    }
  })
  const host = await context.newPage(),
    guest = await context.newPage()
  let launches = 0
  context.on("request", (request) => {
    if (request.url() === `${endpoint}/api/wobble/launch`) launches++
  })
  for (const page of [host, guest]) {
    page.on("pageerror", (error) => {
      errors.push(error.message)
      console.error("PAGE_ERROR", error.message)
    })
    page.on("console", (message) => {
      if (message.type() === "error") console.error("BROWSER_CONSOLE", message.text())
    })
  }
  await host.goto(`${parentOrigin}/wobble-integration-qa.html?qaUser=1`)
  await host.getByRole("heading", { name: "חדר ההמתנה", exact: true }).waitFor({ timeout: 60_000 })
  await guest.goto(`${parentOrigin}/wobble-integration-qa.html?qaUser=2`)
  await guest.getByRole("heading", { name: "חדר ההמתנה", exact: true }).waitFor({ timeout: 60_000 })
  const frame = (page: typeof host) => {
    const found = page.frames().find((frame) => frame.url().startsWith(endpoint))
    assert.ok(found, "Game iframe exists")
    return found
  }
  await until(
    () => host.getByRole("button", { name: "התחלת מרוץ", exact: true }).isEnabled(),
    "both clients loaded",
  )
  type PerformanceSnapshot = ReturnType<
    NonNullable<import("../../src/client/debug-api").WobbleDebugApi["performance"]>
  >
  const performanceSnapshot = (page: typeof host) =>
    frame(page).evaluate(() =>
      (
        window as unknown as { wobble: { performance(): PerformanceSnapshot } }
      ).wobble.performance(),
    )
  assert.equal((await performanceSnapshot(host)).graphics.quality, "balanced")
  const lobbyFrames = (await performanceSnapshot(host)).frames.renderedFrames
  await pause(250)
  assert.equal(
    (await performanceSnapshot(host)).frames.renderedFrames,
    lobbyFrames,
    "opaque lobby skips GPU draws",
  )
  await host.getByLabel("איכות תצוגה", { exact: true }).selectOption("low")
  await until(
    async () => (await performanceSnapshot(host)).graphics.quality === "low",
    "quality bridge",
  )
  assert.equal((await performanceSnapshot(host)).graphics.shadows, false)
  assert.equal(await host.getByText("חיפוש מסלול", { exact: true }).count(), 0)
  await guest.getByRole("button", { name: "צבע טורקיז", exact: true }).click()
  await until(
    () => service.rooms.get(sessionId)?.members.get(uid(2))?.colorIndex === 6,
    "guest chooses color",
  )
  await until(
    () =>
      guest
        .getByRole("button", { name: "צבע טורקיז", exact: true })
        .getAttribute("aria-pressed")
        .then((value) => value === "true"),
    "selected color accessible state",
  )
  await host.getByRole("button", { name: "צבע סגול", exact: true }).click()
  await until(
    () => service.rooms.get(sessionId)?.members.get(uid(1))?.colorIndex === 4,
    "host chooses color",
  )
  assert.equal(await frame(host).locator(".screen--start").isVisible(), false)
  assert.ok((await host.locator("body").innerText()).includes("נועה Alex <QA>"))
  await host.getByRole("button", { name: "צ׳אט וקול", exact: true }).click()
  await host.getByLabel("הודעה לחדר").fill("שלום מהמרוץ")
  await host.getByRole("button", { name: "שלח", exact: true }).click()
  await host
    .getByLabel("הודעות", { exact: true })
    .getByText("שלום מהמרוץ", { exact: false })
    .waitFor()
  assert.equal(chat[0]?.sender_id, uid(1))
  await host.getByRole("button", { name: "הצטרף לצ׳אט הקולי", exact: true }).waitFor()
  await host.getByRole("button", { name: "חזרה למשחק", exact: true }).click()
  await host.screenshot({ path: `${game}/evidence/app-integration/lobby-light.png` })
  await host.evaluate(() => {
    localStorage.setItem("playground-theme", "dark")
    location.reload()
  })
  await host.getByRole("heading", { name: "חדר ההמתנה", exact: true }).waitFor({ timeout: 60_000 })
  await until(
    () => host.getByRole("button", { name: "התחלת מרוץ", exact: true }).isEnabled(),
    "reload retains room",
  )
  assert.equal(
    await host.getByRole("button", { name: "צבע סגול", exact: true }).getAttribute("aria-pressed"),
    "true",
  )
  assert.equal(await host.getByLabel("איכות תצוגה", { exact: true }).inputValue(), "low")
  assert.equal(
    (await performanceSnapshot(host)).graphics.quality,
    "low",
    "parent and game preference survive refresh",
  )
  await host.screenshot({ path: `${game}/evidence/app-integration/lobby-dark.png` })
  await host.getByRole("button", { name: "מסך מלא", exact: true }).click()
  await host.waitForFunction(() => !!document.fullscreenElement?.querySelector("iframe"))
  assert.equal(
    await host.evaluate(() => !!document.fullscreenElement?.querySelector("iframe")),
    true,
  )
  await host.getByRole("button", { name: "יציאה ממסך מלא", exact: true }).click()
  await host.waitForFunction(() => !document.fullscreenElement)
  await host.getByRole("button", { name: "התחלת מרוץ", exact: true }).click()
  await frame(host).waitForFunction(
    () =>
      (window as unknown as { wobble?: { state(): { phase: string } } }).wobble?.state().phase ===
      "racing",
    null,
    { timeout: 20_000 },
  )
  const race = service.rooms.get(sessionId)?.engine.race
  for (const quality of ["high", "balanced", "low"]) {
    await host.getByLabel("איכות תצוגה", { exact: true }).selectOption(quality)
    await until(
      async () => (await performanceSnapshot(host)).graphics.quality === quality,
      "live quality switch",
    )
    assert.equal((await performanceSnapshot(host)).graphics.shadows, quality !== "low")
    assert.equal(service.rooms.get(sessionId)?.engine.race, race, "quality preserves race")
  }
  const activeFrames = (await performanceSnapshot(host)).frames.renderedFrames
  await until(
    async () => (await performanceSnapshot(host)).frames.renderedFrames > activeFrames,
    "racing draws resume",
  )
  const raceActors = service.rooms.get(sessionId)?.engine.race?.frame("racing", Date.now()).actors
  assert.equal(raceActors?.find((actor) => actor.id === uid(1))?.colorIndex, 4)
  assert.equal(raceActors?.find((actor) => actor.id === uid(2))?.colorIndex, 6)
  const before = await frame(host).evaluate(
    () =>
      (
        window as unknown as { wobble: { state(): { position: { x: number; z: number } } } }
      ).wobble.state().position,
  )
  await frame(host).locator("canvas").click()
  await host.keyboard.down("KeyD")
  await pause(400)
  await host.keyboard.up("KeyD")
  const after = await frame(host).evaluate(
    () =>
      (
        window as unknown as { wobble: { state(): { position: { x: number; z: number } } } }
      ).wobble.state().position,
  )
  assert.ok(Math.hypot(after.x - before.x, after.z - before.z) > 0.2)
  await host.getByRole("button", { name: "השהיה", exact: true }).click()
  await host.getByRole("heading", { name: "המשחק מושהה", exact: true }).waitFor()
  await until(() => !!service.rooms.get(sessionId)?.saved, "durable pause")
  const tick = service.rooms.get(sessionId)?.engine.race?.tick
  await pause(300)
  assert.equal(service.rooms.get(sessionId)?.engine.race?.tick, tick)
  const pausedFrames = (await performanceSnapshot(host)).frames.renderedFrames
  await pause(200)
  assert.equal(
    (await performanceSnapshot(host)).frames.renderedFrames,
    pausedFrames,
    "pause skips GPU draws",
  )
  const oldBridge = await host.locator("iframe").getAttribute("src")
  await frame(host).evaluate(() => {
    const canvas = document.querySelector("canvas")
    const gl = canvas?.getContext("webgl2")
    const extension = gl?.getExtension("WEBGL_lose_context")
    if (!extension) throw new Error("Context loss extension missing")
    extension.loseContext()
  })
  await host.getByRole("alert").waitFor()
  await host.getByRole("button", { name: "ניסיון נוסף", exact: true }).click()
  await until(
    async () => (await host.locator("iframe").getAttribute("src")) !== oldBridge,
    "graphics retry replaces iframe",
  )
  await host.getByRole("heading", { name: "המשחק מושהה", exact: true }).waitFor({ timeout: 60_000 })
  await until(
    async () => {
      try {
        return (await performanceSnapshot(host)).graphics.quality === "low"
      } catch {
        return false
      }
    },
    "graphics retry retains quality",
    60_000,
  )
  assert.equal(service.rooms.get(sessionId)?.engine.race, race, "graphics retry preserves race")
  assert.equal(
    service.rooms.get(sessionId)?.engine.race?.tick,
    tick,
    "paused physics survives context loss",
  )
  await host.getByRole("button", { name: "המשך משחק", exact: true }).last().click()
  await until(() => !service.rooms.get(sessionId)?.paused, "resume")
  const late = await context.newPage()
  late.on("pageerror", (error) => errors.push(error.message))
  await late.goto(`${parentOrigin}/wobble-integration-qa.html?qaUser=3`)
  await late.getByText("הצטרפת לחדר.", { exact: false }).waitFor({ timeout: 60_000 })
  assert.equal(service.rooms.get(sessionId)?.view(uid(3)).pending, true)
  await host.getByRole("button", { name: "שחקנים (3/8)", exact: true }).click()
  await host
    .getByRole("region", { name: "שחקנים בחדר" })
    .getByText("חבר 3", { exact: true })
    .waitFor()
  await host.getByRole("button", { name: "חזרה למשחק", exact: true }).click()
  const teacher = await context.newPage()
  teacher.on("pageerror", (error) => errors.push(error.message))
  await teacher.goto(`${parentOrigin}/wobble-integration-qa.html?qaUser=4`)
  await teacher
    .getByRole("button", { name: "שחקנים (3/8)", exact: true })
    .waitFor({ timeout: 60_000 })
  await frame(teacher).waitForFunction(
    () => {
      const state = (
        window as unknown as {
          wobble?: { state(): { predictedActors: unknown[]; remotes: number } }
        }
      ).wobble?.state()
      return state && state.predictedActors.length === 4 && state.remotes >= 1
    },
    null,
    { timeout: 60_000 },
  )
  await frame(teacher).waitForFunction(
    () => {
      const state = (
        window as unknown as {
          wobble?: {
            state(): {
              spectatorBufferedFrames: number
              predictionTick: number
              serverTick: number
              renderWorldTimeSec: number
              pendingInputs: number
            }
          }
        }
      ).wobble?.state()
      return (
        state &&
        state.spectatorBufferedFrames >= 2 &&
        state.predictionTick < state.serverTick &&
        state.pendingInputs === 0 &&
        Math.abs(state.renderWorldTimeSec - (3 + state.predictionTick / 60)) < 0.001
      )
    },
    null,
    { timeout: 60_000 },
  )
  // Hold teacher re-admission briefly so the disconnected scene must remain
  // at its last displayed pose rather than reverting to an unused local pose.
  let releaseTeacherLaunch: () => void = () => {}
  const teacherLaunchGate = new Promise<void>((resolve) => {
    releaseTeacherLaunch = resolve
  })
  await teacher.route(`${endpoint}/api/wobble/launch`, async (route) => {
    await teacherLaunchGate
    await route.continue()
  })
  await frame(teacher).evaluate(() => {
    const target = window as unknown as {
      qaSockets: WebSocket[]
      wobble: { state(): { renderPosition: unknown } }
      qaDisconnectedPose?: unknown
    }
    const socket = target.qaSockets.find((socket) => socket.readyState === WebSocket.OPEN)
    if (!socket) throw new Error("Missing teacher socket")
    socket.addEventListener(
      "close",
      () => {
        target.qaDisconnectedPose = target.wobble.state().renderPosition
      },
      { once: true },
    )
    socket.close()
  })
  await frame(teacher).waitForFunction(() => {
    const target = window as unknown as {
      qaDisconnectedPose?: unknown
      wobble: { state(): { spectatorBufferedFrames: number } }
    }
    return target.qaDisconnectedPose && target.wobble.state().spectatorBufferedFrames === 0
  })
  await pause(250)
  assert.equal(
    await frame(teacher).evaluate(() => {
      const target = window as unknown as {
        qaDisconnectedPose?: unknown
        wobble: { state(): { renderPosition: unknown } }
      }
      return (
        JSON.stringify(target.qaDisconnectedPose) ===
        JSON.stringify(target.wobble.state().renderPosition)
      )
    }),
    true,
    "teacher's disconnected presentation freezes without returning to spawn",
  )
  releaseTeacherLaunch()
  await teacher.unroute(`${endpoint}/api/wobble/launch`)
  await frame(teacher).waitForFunction(
    () => {
      const target = window as unknown as {
        wobble: { state(): { spectatorBufferedFrames: number } }
      }
      return target.wobble.state().spectatorBufferedFrames >= 2
    },
    null,
    { timeout: 60_000 },
  )
  const teacherView = service.rooms.get(sessionId)?.view(uid(4))
  assert.ok(teacherView)
  assert.equal(teacherView.canControl, false)
  assert.equal(teacherView.canModerate, true)
  assert.equal(teacherView.canManageSession, false)
  assert.equal(teacherView.canRemovePlayers, false)
  // UI projections exercise lobby/cup menus with the real teacher capabilities.
  // The server's actual three-race permission checks live in platform-integration.test.ts.
  const projectTeacherView = async (patch: Partial<WobbleView>) => {
    await frame(teacher).evaluate(
      (state) => {
        const params = new URLSearchParams(location.search)
        const origin = params.get("parentOrigin")
        if (!origin) throw new Error("Missing parent origin")
        parent.postMessage(
          {
            source: "wobble-frame",
            version: 1,
            sessionId: params.get("sessionId"),
            bridgeId: params.get("bridgeId"),
            kind: "state",
            state,
          },
          origin,
        )
      },
      { ...teacherView, ...patch },
    )
  }
  await projectTeacherView({ phase: "lobby", paused: false, round: 0 })
  await teacher.getByRole("heading", { name: "חדר ההמתנה", exact: true }).waitFor()
  assert.equal(await teacher.getByRole("button", { name: "התחלת מרוץ", exact: true }).count(), 0)
  assert.equal(
    await teacher
      .getByText("סוג משחק", { exact: true })
      .locator("..")
      .locator("select")
      .isDisabled(),
    true,
  )
  assert.equal(
    await teacher.getByText("מסלול", { exact: true }).locator("..").locator("select").isDisabled(),
    true,
  )
  assert.equal(await teacher.getByLabel("קצב מכשולים משתנה", { exact: true }).isDisabled(), true)
  assert.equal(await teacher.getByRole("button", { name: "צבע סגול", exact: true }).count(), 0)
  await projectTeacherView({ phase: "finished", paused: false, mode: "cup", complete: false })
  await teacher.getByRole("heading", { name: "מרוץ 1 הסתיים", exact: true }).waitFor()
  assert.equal(await teacher.getByRole("button", { name: "המרוץ הבא", exact: true }).count(), 0)
  await projectTeacherView({ phase: "finished", paused: false, mode: "cup", complete: true })
  await teacher.getByRole("heading", { name: "הגביע הסתיים!", exact: true }).waitFor()
  assert.equal(await teacher.getByRole("button", { name: "משחק נוסף", exact: true }).count(), 0)
  await projectTeacherView({})
  assert.equal(await teacher.getByRole("button", { name: "השהיה", exact: true }).count(), 0)
  assert.equal(await teacher.getByRole("button", { name: "סיום", exact: true }).count(), 0)
  await host.getByRole("button", { name: "השהיה", exact: true }).click()
  await teacher.getByRole("heading", { name: "המשחק מושהה", exact: true }).waitFor()
  assert.equal(service.rooms.get(sessionId)?.paused, true)
  assert.equal(await teacher.getByRole("button", { name: "המשך משחק", exact: true }).count(), 0)
  await host.getByRole("button", { name: "המשך משחק", exact: true }).last().click()
  await until(() => !service.rooms.get(sessionId)?.paused, "host retains resume")
  assert.equal(service.rooms.get(sessionId)?.view(uid(4)).observer, true)
  assert.equal(service.rooms.get(sessionId)?.engine.state.players.length, 2)
  await teacher.getByRole("button", { name: "שחקנים (3/8)", exact: true }).click()
  assert.equal(await teacher.getByRole("button", { name: "הסרה", exact: true }).count(), 0)
  await teacher.getByRole("button", { name: "צ׳אט וקול", exact: true }).click()
  assert.equal(await teacher.getByRole("button", { name: "ניקוי צ׳אט", exact: true }).count(), 1)
  await teacher.close()
  await until(
    () => !service.rooms.get(sessionId)?.observers.has(uid(4)),
    "teacher detached before offline test",
  )
  await host.evaluate(() =>
    window.postMessage(
      { source: "wobble-frame", version: 1, kind: "state", state: { canModerate: true } },
      location.origin,
    ),
  )
  assert.equal(await host.getByRole("button", { name: "הסרה", exact: true }).count(), 0)
  await frame(host).evaluate(() => {
    const target = window as unknown as { qaSocket?: WebSocket; WebSocket: typeof WebSocket }
    // The renderer's debug state is retained across an actual browser offline/online reconnect below.
    Object.defineProperty(target, "qaCanvas", {
      value: document.querySelector("canvas"),
      configurable: true,
    })
  })
  await context.setOffline(true)
  await pause(5500)
  await context.setOffline(false)
  await until(
    () =>
      service.rooms
        .get(sessionId)
        ?.view(uid(1))
        .players.every((player) => player.connected && player.loaded),
    "reconnected and loaded actors",
    30_000,
  )
  await frame(host).waitForFunction(() => {
    const state = (
      window as unknown as { wobble?: { state(): { frameAgeMs?: number } } }
    ).wobble?.state()
    return state?.frameAgeMs !== undefined && state.frameAgeMs < 1000
  })
  if (service.rooms.get(sessionId)?.paused) {
    await host.getByRole("button", { name: "המשך משחק", exact: true }).last().click()
    await until(() => !service.rooms.get(sessionId)?.paused, "resume after empty-room recovery")
  }
  assert.equal(
    await frame(host).evaluate(
      () =>
        document.querySelector("canvas") ===
        (window as unknown as { qaCanvas: HTMLCanvasElement }).qaCanvas,
    ),
    true,
  )
  await host.getByRole("button", { name: "השהיה", exact: true }).click()
  await host.getByRole("heading", { name: "המשחק מושהה", exact: true }).waitFor()
  await host.setViewportSize({ width: 640, height: 480 })
  assert.equal(
    (await performanceSnapshot(host)).graphics.quality,
    "low",
    "resize retains selected quality",
  )
  await host.getByRole("button", { name: "שחקנים (3/8)", exact: true }).click()
  assert.equal(
    await host.getByRole("button", { name: "חזרה למשחק", exact: true }).isVisible(),
    true,
  )
  await host.getByRole("button", { name: "חזרה למשחק", exact: true }).click()
  const voiceBeforeStop = revokedVoice.length
  host.once("dialog", (dialog) => void dialog.accept())
  await host.getByRole("button", { name: "סיום", exact: true }).click()
  for (const page of [host, guest, late]) {
    await page.getByRole("heading", { name: "המפגש הסתיים", exact: true }).waitFor()
    assert.equal(await page.getByRole("alert").count(), 0)
  }
  // Maintenance may retry an idempotent removal before close handlers detach peers.
  const revokedAtStop = () => [...new Set(revokedVoice.slice(voiceBeforeStop))].sort()
  await until(() => revokedAtStop().length === 3, "every participant voice session removed at stop")
  assert.deepEqual(revokedAtStop(), [uid(1), uid(2), uid(3)].sort())
  await until(async () => {
    const health = await (await fetch(`${endpoint}/health`)).json()
    return health.connections === 0
  }, "all game connections closed at stop")
  report.voiceRevocations = [...revokedVoice]
  const afterEndLaunches = launches
  await frame(guest).evaluate(() => {
    const params = new URLSearchParams(location.search)
    const parentOrigin = params.get("parentOrigin")
    if (!parentOrigin) throw new Error("Missing parent origin")
    parent.postMessage(
      {
        source: "wobble-frame",
        version: 1,
        sessionId: params.get("sessionId"),
        bridgeId: params.get("bridgeId"),
        kind: "disconnected",
      },
      parentOrigin,
    )
  })
  await pause(6500)
  assert.equal(
    launches,
    afterEndLaunches,
    "ended clients never relaunch after a stale disconnect/watchdog",
  )
  await host.reload()
  await host.getByRole("heading", { name: "המפגש הסתיים", exact: true }).waitFor()
  assert.equal(await host.getByRole("alert").count(), 0)
  const completedLaunches = launches
  await frame(host).evaluate(() => {
    const params = new URLSearchParams(location.search)
    const parentOrigin = params.get("parentOrigin")
    if (!parentOrigin) throw new Error("Missing parent origin")
    parent.postMessage(
      {
        source: "wobble-frame",
        version: 1,
        sessionId: params.get("sessionId"),
        bridgeId: params.get("bridgeId"),
        kind: "disconnected",
      },
      parentOrigin,
    )
  })
  await pause(1600)
  assert.equal(launches, completedLaunches, "HTTP SESSION_COMPLETED is terminal too")
  const oldSrc = await host.locator("iframe").getAttribute("src")
  await host.evaluate(() => {
    const element = document.querySelector("iframe")
    if (!element?.contentWindow) throw new Error("Missing frame")
    const url = new URL(element.src)
    element.contentWindow.postMessage(
      {
        source: "playground-app",
        version: 1,
        sessionId: url.searchParams.get("sessionId"),
        bridgeId: url.searchParams.get("bridgeId"),
        kind: "dispose",
      },
      url.origin,
    )
  })
  await frame(host).waitForFunction(() => !(window as unknown as { wobble?: unknown }).wobble)
  assert.ok(oldSrc)
  assert.deepEqual(errors, [])
  Object.assign(report, {
    twoRealBrowserClients: "PASS",
    strictMode: "PASS",
    lobbyAndHostStart: "PASS",
    persistedChat: "PASS",
    HebrewAndNames: "PASS",
    themesAndFullscreen: "PASS",
    nativeMovement: "PASS",
    pauseResume: "PASS",
    persistentGraphicsPresets: "PASS",
    coveredViewsSkipDraws: "PASS",
    contextLossRetryPreservesRace: "PASS",
    lateJoining: "PASS",
    reconnectKeepsRenderer: "PASS",
    dispose: "PASS",
    teacherObserverAndChatModerationUI: "PASS",
    teacherRaceMenusAreReadOnly: "PASS (projected UI states; real capabilities)",
    teacherSessionControlsHidden:
      "PASS (host retains pause/resume; teacher retains chat moderation)",
    teacherBufferedWorld:
      "PASS (characters and obstacles share a delayed server tick; no uploaded controls)",
    teacherReconnectFreezesPresentation: "PASS",
    smallScreenPanelNavigation: "PASS",
    explicitEndClosesGameAndVoice: "PASS",
    endedClientsNeverRelaunch: "PASS",
    completedSessionRefreshIsClean: "PASS",
    browserErrors: errors,
  })
  console.log(JSON.stringify(report, null, 2))
} catch (error) {
  report.voiceRevocations = [...revokedVoice]
  report.room = service.rooms.get(sessionId)?.view(uid(1))
  if (browser)
    report.pages = await Promise.all(
      browser
        .contexts()
        .flatMap((context) => context.pages())
        .map(async (page) => ({
          url: page.url(),
          text: await page
            .locator("body")
            .innerText()
            .catch(() => ""),
          frames: page.frames().map((frame) => frame.url()),
        })),
    )
  console.error(JSON.stringify(report, null, 2))
  throw error
} finally {
  await browser?.close()
  if (vite) {
    vite.kill("SIGTERM")
    await once(vite, "exit").catch(() => undefined)
  }
  await service.close()
  await new Promise<void>((done) => fixture.close(() => done()))
  if (htmlCreated) await unlink(qaHtml)
  if (sourceCreated) await unlink(qaTsx)
  await writeFile(`${game}/evidence/app-integration/summary.json`, JSON.stringify(report, null, 2))
}
