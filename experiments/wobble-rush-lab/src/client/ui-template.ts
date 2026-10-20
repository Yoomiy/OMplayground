/** The overlay markup and the small pure helpers the UI renders with. */

export const SCREENS = ["start", "lobby", "hud", "finish", "error"] as const
export type Screen = (typeof SCREENS)[number]

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

export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;"
      case "<":
        return "&lt;"
      case ">":
        return "&gt;"
      case '"':
        return "&quot;"
      default:
        return "&#39;"
    }
  })

export const TEMPLATE = /* html */ `
<canvas id="stage" aria-label="תצוגת המשחק Wobble Rush 3D"></canvas>

<section class="screen screen--start" dir="rtl" data-screen="start">
  <div class="panel panel--start">
    <h1 class="logo" dir="ltr" lang="en"><span class="logo__wobble">Wobble</span><span class="logo__rush">Rush</span><span class="logo__three">3D</span></h1>
    <p class="tagline">23 מסלולים. קיצורי דרך. מרוצים עם חברים.</p>
    <div class="start-layout"><div class="course-picker">
    <label class="course-search">חיפוש מסלול <input id="course-search" dir="auto" type="search" placeholder="שם, נושא או מכשול…" /></label>
    <p id="course-count" class="course-count" aria-live="polite"></p>
    <div id="course-grid" class="course-grid" role="group" aria-label="בחירת מסלול"></div>
    <p id="course-description" class="course-description"></p>
    <div class="race-options">
      <label>סוג מרוץ ברשת <select id="start-mode"><option value="race">מרוץ יחיד</option><option value="cup">גביע של שלושה מרוצים</option></select></label>
      <label class="remix-option"><input id="start-remix" type="checkbox" /> קצב מכשולים משתנה</label>
    </div>
    </div><div class="racer-options">
    <label class="field">
      <span class="field__label">שם במשחק</span>
      <input id="name-input" dir="auto" class="field__input" maxlength="16" placeholder="השם שלך" autocomplete="off" />
    </label>
    <fieldset class="colors">
      <legend class="field__label">צבע</legend>
      <div id="color-row" class="colors__row"></div>
    </fieldset>
    <div class="actions">
      <button id="play-solo" class="btn btn--primary" type="button">משחק לבד</button>
      <button id="play-online" class="btn btn--secondary" type="button">משחק ברשת</button>
    </div>
    <label class="field field--inline">
      <span class="field__label">קוד חדר (לא חובה)</span>
      <input id="room-input" dir="ltr" lang="en" spellcheck="false" class="field__input field__input--code" maxlength="4" placeholder="ABCD" autocomplete="off" />
    </label>
    <p class="hint"><kbd dir="ltr" lang="en">WASD</kbd> תנועה · <kbd dir="ltr" lang="en">Space</kbd> קפיצה · <kbd dir="ltr" lang="en">Shift</kbd> זינוק · <kbd dir="ltr" lang="en">R</kbd> חזרה לנקודה · <kbd dir="ltr" lang="en">Q/E</kbd> מצלמה · <kbd dir="ltr" lang="en">C</kbd> מרכוז</p>
    </div></div>
  </div>
  <label class="graphics-setting">איכות גרפיקה
    <select id="graphics-quality"><option value="low">חסכונית</option><option value="balanced" selected>מאוזנת</option><option value="high">גבוהה</option></select>
  </label>
  <button id="sound-toggle" class="sound" type="button" aria-pressed="false">צליל פועל</button>
</section>

<section class="screen screen--lobby" dir="rtl" data-screen="lobby" hidden>
  <div class="panel">
    <h2 class="panel__title">חדר ההמתנה</h2>
    <p class="roomcode">קוד חדר <strong id="room-code" dir="ltr">----</strong></p>
    <p class="panel__hint">שתפו את הקוד. המרוץ מתחיל כשכולם מוכנים.</p>
    <div class="race-options lobby-options">
      <label>מסלול <select id="lobby-course"></select></label>
      <label>סוג מרוץ <select id="lobby-mode"><option value="race">מרוץ יחיד</option><option value="cup">גביע של שלושה מרוצים</option></select></label>
      <label class="remix-option"><input id="lobby-remix" type="checkbox" /> קצב מכשולים משתנה</label>
    </div>
    <p id="lobby-route" class="course-description"></p>
    <p id="host-hint" class="hint"></p>
    <ul id="player-list" class="players"></ul>
    <div class="actions">
      <button id="ready-btn" class="btn btn--primary" type="button">אפשר להתחיל</button>
      <button id="leave-btn" class="btn btn--ghost" type="button">יציאה</button>
    </div>
  </div>
</section>

<section class="screen screen--hud" dir="rtl" data-screen="hud" hidden>
  <div class="hud">
    <div class="hud__course" id="hud-course"></div>
    <div class="hud__timer" id="timer" dir="ltr">00:00.000</div>
    <div id="connection-delayed" class="connection-delayed" hidden role="status">עיכוב בחיבור…</div>
    <div class="hud__pips" id="pips" aria-label="נקודות שמירה"></div>
    <div class="hud__place" id="place" dir="ltr"></div>
  </div>
  <div class="waiting-hint" id="waiting-hint" hidden>סיימת! ממתינים לשאר המשתתפים…</div>
  <button id="race-menu" class="race-menu" type="button">יציאה מהמרוץ</button>
  <div class="controls-hint" id="controls-hint"><kbd dir="ltr" lang="en">WASD</kbd> תנועה · <kbd dir="ltr" lang="en">Space</kbd> קפיצה · <kbd dir="ltr" lang="en">Shift</kbd> זינוק · <kbd dir="ltr" lang="en">R</kbd> חזרה לנקודה · <kbd dir="ltr" lang="en">Q/E</kbd> מצלמה · <kbd dir="ltr" lang="en">C</kbd> מרכוז</div>
  <div class="countdown" id="countdown" hidden></div>
</section>

<section class="screen screen--finish" dir="rtl" data-screen="finish" hidden>
  <div class="panel panel--finish">
    <h2 class="panel__title" id="finish-title">המרוץ הסתיים!</h2>
    <p class="finish-time" id="finish-time" dir="ltr">00:00.000</p>
    <p class="finish-note" id="finish-note"></p>
    <ol id="results" class="results"></ol>
    <p id="winner-announcement" class="winner-announcement"></p>
    <section id="cup-results" hidden><h3 id="cup-title">דירוג הגביע</h3><ol id="cup-standings" class="results"></ol><p class="hint">ניקוד: <bdi dir="ltr">10 · 8 · 6 · 5 · 4 · 3 · 2 · 1</bdi>. ללא סיום מקבלים 0 נקודות.<br />בתיקו חולקים בנקודות. שוויון בגביע מוכרע לפי מספר הסיומים ואז הזמן הכולל.</p></section>
    <div class="actions">
      <button id="restart-btn" class="btn btn--primary" type="button">מרוץ נוסף</button>
      <button id="menu-btn" class="btn btn--ghost" type="button">חזרה לתפריט</button>
    </div>
  </div>
</section>

<section class="screen screen--error" dir="rtl" data-screen="error" hidden>
  <div class="panel panel--error">
    <h2 class="panel__title">המשחק נעצר</h2>
    <p class="error-message" id="error-message"></p>
    <p class="panel__hint">טענו מחדש כדי לחזור לתפריט ולהצטרף למרוץ חדש.</p>
    <button id="error-reload" class="btn btn--primary" type="button">טעינה מחדש</button>
  </div>
</section>

<div class="live" id="live" aria-live="polite"></div>
<div id="reconnect-overlay" class="reconnect-overlay" dir="rtl" hidden role="status" aria-live="polite">
  <div class="panel"><h2>מתחברים מחדש…</h2><p>המקום שלך נשמר למשך 30 שניות. המרוץ ממשיך בינתיים.</p>
  <button id="reconnect-leave" class="btn" type="button">חזרה לתפריט</button></div>
</div>
`
