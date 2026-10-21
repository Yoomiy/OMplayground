/** The overlay markup and the small pure helpers the UI renders with. */

export class MissingElementError extends Error {
  constructor(selector: string) {
    super(`Required UI element is missing: ${selector}`)
    this.name = "MissingElementError"
  }
}

export function query<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector)
  if (element === null) throw new MissingElementError(selector)
  return element
}

/** Stopwatch format used across the HUD and the results table. */
export const formatTime = (milliseconds: number): string => {
  const clamped = Math.max(0, milliseconds)
  const minutes = Math.floor(clamped / 60000)
  const seconds = Math.floor((clamped % 60000) / 1000)
  const millis = Math.floor(clamped % 1000)
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`
}

export const TEMPLATE = /* html */ `
<canvas id="stage" aria-label="תצוגת המשחק Wobble Rush"></canvas>
<section class="screen screen--hud" dir="rtl" data-screen="hud" hidden>
  <div class="hud">
    <div class="hud__course" id="hud-course"></div>
    <div class="hud__timer" id="timer" dir="ltr">00:00.000</div>
    <div id="connection-delayed" class="connection-delayed" hidden role="status">עיכוב בחיבור…</div>
    <div class="hud__pips" id="pips" aria-label="נקודות שמירה"></div>
    <div class="hud__place" id="place" dir="ltr"></div>
  </div>
  <div class="waiting-hint" id="waiting-hint" hidden>סיימת! ממתינים לשאר המשתתפים…</div>
  <div class="controls-hint" id="controls-hint"><kbd dir="ltr" lang="en">WASD</kbd> תנועה · <kbd dir="ltr" lang="en">Space</kbd> קפיצה · <kbd dir="ltr" lang="en">Shift</kbd> זינוק · <kbd dir="ltr" lang="en">R</kbd> חזרה לנקודה · <kbd dir="ltr" lang="en">Q/E</kbd> מצלמה · <kbd dir="ltr" lang="en">C</kbd> מרכוז</div>
  <div class="countdown" id="countdown" hidden></div>
</section>

<div class="live" id="live" aria-live="polite"></div>
<div id="reconnect-overlay" dir="rtl" hidden role="status">מתחברים מחדש…</div>
`
