import { isGraphicsQuality } from "../shared/graphics-quality"
import { platformControlSchema } from "../shared/platform-protocol"
import { AppPartyLink } from "./app-link"
import { Game } from "./game"

declare const WOBBLE_BUILD: string

async function boot(): Promise<void> {
  const params = new URLSearchParams(location.search)
  const origin = params.get("parentOrigin"),
    sessionId = params.get("sessionId"),
    bridgeId = params.get("bridgeId")
  if (
    window.parent === window ||
    !origin ||
    !sessionId ||
    !/^[0-9a-f-]{36}$/i.test(sessionId) ||
    !bridgeId ||
    bridgeId.length > 80
  )
    throw new Error("Invalid app frame")
  const response = await fetch("/api/wobble/config", { cache: "no-store" })
  const config = (await response.json()) as {
    version: number
    release: string
    appOrigins: string[]
  }
  if (
    !response.ok ||
    config.version !== 1 ||
    config.release !== WOBBLE_BUILD ||
    !config.appOrigins.includes(origin)
  )
    throw new Error("Invalid app origin or mismatched build")
  const root = document.getElementById("app")
  if (!root) throw new Error("Missing game root")
  let closed = false,
    launching = false
  let link: AppPartyLink | null = null
  let ready: ReturnType<typeof setInterval> | null = null
  const events = new AbortController()
  const post = (kind: string, fields: Record<string, unknown> = {}) => {
    if (!closed)
      parent.postMessage(
        { source: "wobble-frame", version: 1, bridgeId, sessionId, kind, ...fields },
        origin,
      )
  }
  const game = new Game(root, {
    createParty(callbacks) {
      link = new AppPartyLink(callbacks, sessionId, {
        view(view) {
          launching = false
          game.setPlatformView(view)
          post("state", { state: view })
        },
        error(code) {
          launching = false
          post("error", { code })
        },
        disconnected() {
          launching = false
          post("disconnected")
        },
      })
      return link
    },
  })
  const dispose = () => {
    if (closed) return
    closed = true
    if (ready) clearInterval(ready)
    events.abort()
    game.dispose()
  }
  window.addEventListener(
    "pagehide",
    (event) => {
      if (!event.persisted) dispose()
    },
    { signal: events.signal },
  )
  window.addEventListener(
    "message",
    (event) => {
      if (closed || event.source !== window.parent || event.origin !== origin) return
      const message = event.data
      if (
        message?.source !== "playground-app" ||
        message.version !== 1 ||
        message.bridgeId !== bridgeId ||
        message.sessionId !== sessionId
      )
        return
      if (message.kind === "dispose") {
        dispose()
        return
      }
      if (message.kind === "release-input") {
        game.releaseInput()
        return
      }
      if (message.kind === "theme" && ["light", "dark"].includes(message.theme)) {
        document.documentElement.dataset.theme = message.theme
        return
      }
      if (message.kind === "graphics-quality" && isGraphicsQuality(message.quality)) {
        game.setGraphicsQuality(message.quality)
        return
      }
      if (message.kind === "control") {
        const control = platformControlSchema.safeParse(message.control)
        if (control.success) link?.control(control.data)
      }
      if (
        message.kind === "launch" &&
        !launching &&
        typeof message.ticket === "string" &&
        message.ticket.length <= 2048
      ) {
        launching = true
        if (ready) clearInterval(ready)
        void link?.connect(message.ticket).catch(() => {
          launching = false
          post("error", { code: "SERVICE_UNAVAILABLE" })
          post("disconnected")
        })
      }
    },
    { signal: events.signal },
  )
  window.addEventListener(
    "error",
    () => {
      post("error", { code: "CLIENT_ERROR" })
      dispose()
    },
    { signal: events.signal },
  )
  window.addEventListener(
    "unhandledrejection",
    () => {
      post("error", { code: "CLIENT_ERROR" })
      dispose()
    },
    { signal: events.signal },
  )
  root.querySelector("canvas")?.addEventListener(
    "webglcontextlost",
    (event) => {
      event.preventDefault()
      game.releaseInput()
      post("error", { code: "GRAPHICS_LOST" })
      dispose()
    },
    { signal: events.signal },
  )
  ready = setInterval(() => post("ready"), 500)
  post("ready")
}
void boot().catch(() => {
  const root = document.getElementById("app")
  if (root) {
    root.dir = "rtl"
    root.textContent = "לא ניתן לטעון את המשחק. אפשר לנסות שוב דרך האפליקציה."
  }
})
