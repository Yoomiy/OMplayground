/**
 * Boot. Any failure here paints the error screen — the game never renders a blank
 * canvas or silently degrades.
 */

import { Game } from "./game"
import { escapeHtml } from "./ui-template"

class AssetLoadError extends Error {
  constructor(asset: string) {
    super(`${asset} did not load, so the game cannot start.`)
    this.name = "AssetLoadError"
  }
}

/**
 * The stylesheet defines --ink on :root. Asking the computed style whether it is
 * there is a deterministic check: a link onerror handler races the module boot
 * and can be painted over, this cannot.
 */
function assertStylesheetLoaded(): void {
  const ink = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim()
  if (ink === "") throw new AssetLoadError("The stylesheet (/assets/style.css)")
}

const FALLBACK_STYLE =
  "position:fixed;inset:0;display:grid;place-items:center;padding:32px;font:16px/1.5 system-ui,sans-serif;background:#fff2f2;color:#2a2440;text-align:center"

let game: Game | null = null

function paintFatal(message: string): void {
  game?.dispose()
  game = null
  const root = document.getElementById("app")
  const safeMessage = escapeHtml(message)
  if (root === null) {
    document.body.innerHTML = `<div dir="rtl" id="boot-error" style="${FALLBACK_STYLE}"><div><h1>לא ניתן לטעון את המשחק</h1><p>${safeMessage}</p></div></div>`
    return
  }
  root.innerHTML = `<div dir="rtl" id="boot-error" style="${FALLBACK_STYLE}"><div><h1>לא ניתן לטעון את המשחק</h1><p>${safeMessage}</p><button type="button" onclick="location.reload()" style="margin-top:16px;padding:12px 22px;font:inherit;font-weight:700;border:3px solid #2a2440;border-radius:14px;background:#ffd25e;cursor:pointer">טעינה מחדש</button></div></div>`
}

function boot(): void {
  const root = document.getElementById("app")
  if (root === null) throw new Error("The #app container is missing from the page.")
  assertStylesheetLoaded()
  game = new Game(root)
  globalThis.addEventListener("pagehide", () => game?.dispose(), { once: true })
}

// no-excuse-ok: catch — top-level boundary; every failure must reach the user.
try {
  boot()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error("[wobble-rush] boot failed", error)
  paintFatal(message)
}

// Nothing fails quietly: a runtime error after boot paints the same fatal screen
// rather than leaving a frozen canvas that looks like the game is still running.
window.addEventListener("error", (event: ErrorEvent) => {
  console.error("[wobble-rush] runtime error", event.error)
  paintFatal(event.message === "" ? "שגיאה בלתי צפויה עצרה את המשחק." : event.message)
})
window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
  console.error("[wobble-rush] unhandled rejection", event.reason)
  const reason: unknown = event.reason
  paintFatal(reason instanceof Error ? reason.message : "תקלה בלתי צפויה עצרה את המשחק.")
})
