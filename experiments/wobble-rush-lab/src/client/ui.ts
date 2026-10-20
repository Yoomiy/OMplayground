/**
 * DOM overlay: every screen in DESIGN.md section 8.
 * The renderer owns the canvas; this owns everything drawn on top of it.
 */

import { RUNNER_COLORS } from "../shared/course"
import { COURSES, getCourse } from "../shared/course-catalog"
import { type GraphicsQuality, isGraphicsQuality } from "../shared/graphics-quality"
import type { RaceResult, RoomPhase, RoomSnapshot } from "../shared/room"
import {
  DEFAULT_SELECTION,
  type RaceSelection,
  type RoomSession,
  sessionForRoom,
} from "../shared/session"
import type { PlayerId } from "../shared/types"
import { courseDescription, courseName, difficultyName, isolate } from "./hebrew"
import type { Screen } from "./ui-template"
import { escapeHtml, formatTime, query, SCREENS, TEMPLATE } from "./ui-template"
import { winnerAnnouncement } from "./winner-announcement"

export { formatTime, MissingElementError } from "./ui-template"

export type UiHandlers = {
  onPlaySolo(name: string, colorIndex: number): void
  onPlayOnline(name: string, colorIndex: number, code: string | null): void
  onReady(ready: boolean): void
  onLeaveLobby(): void
  onRestart(): void
  onBackToMenu(): void
  onToggleSound(muted: boolean): void
  onGraphicsQuality?(quality: GraphicsQuality): void
  onConfigure?(selection: RaceSelection): void
}

export class Ui {
  readonly canvas: HTMLCanvasElement
  private readonly root: HTMLElement
  private readonly handlers: UiHandlers
  private connectionDelayed = false
  private checkpointState = ""
  private placeText: string | null = null
  private colorIndex = 0
  private courseId = DEFAULT_SELECTION.courseId
  private hintTimer: ReturnType<typeof globalThis.setTimeout> | null = null

  constructor(root: HTMLElement, handlers: UiHandlers) {
    this.root = root
    this.handlers = handlers
    root.innerHTML = TEMPLATE
    this.canvas = query<HTMLCanvasElement>(root, "#stage")
    this.buildColorRow()
    this.buildCourses()
    this.wire()
  }

  dispose(): void {
    if (this.hintTimer !== null) globalThis.clearTimeout(this.hintTimer)
    this.hintTimer = null
  }

  get selection(): RaceSelection {
    return {
      courseId: this.courseId,
      mode: query<HTMLSelectElement>(this.root, "#start-mode").value === "cup" ? "cup" : "race",
      remix: query<HTMLInputElement>(this.root, "#start-remix").checked,
    }
  }

  private buildCourses(): void {
    const grid = query<HTMLElement>(this.root, "#course-grid")
    const select = query<HTMLSelectElement>(this.root, "#lobby-course")
    for (const course of COURSES) {
      const card = document.createElement("button")
      card.type = "button"
      card.className = "course-card"
      card.dataset.course = course.id
      card.style.setProperty("--course-color", course.theme?.accent ?? "#fdb83e")
      card.style.setProperty("--course-sky", course.theme?.skyTop ?? "#91c7ef")
      card.setAttribute("aria-pressed", String(course.id === this.courseId))
      card.innerHTML = `<span class="course-card__art" aria-hidden="true"><i></i><i></i><i></i></span><strong>${escapeHtml(courseName(course))}</strong><span>${difficultyName(course.difficulty)} · ${course.routes === undefined ? `${course.checkpoints.length - 1} מקטעים` : "דרכים מסתעפות"}</span>`
      card.dataset.search =
        `${courseName(course)} ${courseDescription(course)} ${difficultyName(course.difficulty)} ${course.name} ${course.description ?? ""} ${course.theme?.landmark ?? ""} ${course.difficulty ?? ""}`.toLowerCase()
      card.addEventListener("click", () => {
        this.courseId = course.id
        for (const other of grid.querySelectorAll("button"))
          other.setAttribute("aria-pressed", String(other === card))
        query<HTMLElement>(this.root, "#course-description").textContent = courseDescription(course)
      })
      grid.append(card)
      const option = document.createElement("option")
      option.value = course.id
      option.textContent = courseName(course)
      select.append(option)
    }
    query<HTMLElement>(this.root, "#course-description").textContent = courseDescription(
      getCourse(this.courseId),
    )
    const search = query<HTMLInputElement>(this.root, "#course-search")
    const count = query<HTMLElement>(this.root, "#course-count")
    const filter = (): void => {
      const term = search.value.trim().toLowerCase()
      let visible = 0
      for (const card of grid.querySelectorAll<HTMLButtonElement>("button")) {
        card.hidden = !(card.dataset.search ?? "").includes(term)
        if (!card.hidden) visible++
      }
      count.textContent =
        visible === 0
          ? "לא נמצאו מסלולים. נסו חיפוש אחר."
          : `${visible} מתוך ${COURSES.length} מסלולים · נבחר: ${courseName(getCourse(this.courseId))}`
    }
    search.addEventListener("input", filter)
    grid.addEventListener("click", filter)
    filter()
  }

  private buildColorRow(): void {
    const row = query<HTMLDivElement>(this.root, "#color-row")
    RUNNER_COLORS.forEach((color, index) => {
      const swatch = document.createElement("button")
      swatch.type = "button"
      swatch.className = "swatch"
      swatch.style.setProperty("--swatch", color)
      swatch.setAttribute("aria-label", `צבע ${index + 1}`)
      swatch.setAttribute("aria-pressed", String(index === 0))
      swatch.addEventListener("click", () => {
        this.colorIndex = index
        for (const other of row.querySelectorAll(".swatch"))
          other.setAttribute("aria-pressed", "false")
        swatch.setAttribute("aria-pressed", "true")
      })
      row.append(swatch)
    })
  }

  private wire(): void {
    query<HTMLButtonElement>(this.root, "#reconnect-leave").addEventListener("click", () =>
      this.handlers.onBackToMenu(),
    )
    const nameInput = query<HTMLInputElement>(this.root, "#name-input")
    const roomInput = query<HTMLInputElement>(this.root, "#room-input")
    const name = (): string => (nameInput.value.trim() === "" ? "משתתף" : nameInput.value.trim())
    for (const selector of ["#lobby-course", "#lobby-mode", "#lobby-remix"]) {
      query<HTMLElement>(this.root, selector).addEventListener("change", () =>
        this.handlers.onConfigure?.({
          courseId: query<HTMLSelectElement>(this.root, "#lobby-course").value,
          mode: query<HTMLSelectElement>(this.root, "#lobby-mode").value === "cup" ? "cup" : "race",
          remix: query<HTMLInputElement>(this.root, "#lobby-remix").checked,
        }),
      )
    }

    query<HTMLButtonElement>(this.root, "#play-solo").addEventListener("click", () => {
      this.handlers.onPlaySolo(name(), this.colorIndex)
    })
    query<HTMLButtonElement>(this.root, "#play-online").addEventListener("click", () => {
      const code = roomInput.value.trim().toUpperCase()
      this.handlers.onPlayOnline(name(), this.colorIndex, code === "" ? null : code)
    })
    query<HTMLButtonElement>(this.root, "#ready-btn").addEventListener("click", (event) => {
      const button = event.currentTarget
      if (!(button instanceof HTMLButtonElement)) return
      const next = button.dataset.ready !== "true"
      button.dataset.ready = String(next)
      button.textContent = next ? "ממתינים לשאר המשתתפים…" : "אפשר להתחיל"
      this.handlers.onReady(next)
    })
    query<HTMLButtonElement>(this.root, "#leave-btn").addEventListener("click", () =>
      this.handlers.onLeaveLobby(),
    )
    query<HTMLButtonElement>(this.root, "#restart-btn").addEventListener("click", () =>
      this.handlers.onRestart(),
    )
    query<HTMLButtonElement>(this.root, "#menu-btn").addEventListener("click", () =>
      this.handlers.onBackToMenu(),
    )
    query<HTMLButtonElement>(this.root, "#race-menu").addEventListener("click", () =>
      this.handlers.onBackToMenu(),
    )
    query<HTMLButtonElement>(this.root, "#error-reload").addEventListener("click", () =>
      globalThis.location.reload(),
    )

    query<HTMLSelectElement>(this.root, "#graphics-quality").addEventListener("change", (event) => {
      const value = (event.currentTarget as HTMLSelectElement).value
      if (isGraphicsQuality(value)) this.handlers.onGraphicsQuality?.(value)
    })
    const sound = query<HTMLButtonElement>(this.root, "#sound-toggle")
    sound.addEventListener("click", () => {
      const muted = sound.getAttribute("aria-pressed") !== "true"
      sound.setAttribute("aria-pressed", String(muted))
      sound.textContent = muted ? "צליל כבוי" : "צליל פועל"
      this.handlers.onToggleSound(muted)
    })
  }

  setGraphicsQuality(quality: GraphicsQuality): void {
    query<HTMLSelectElement>(this.root, "#graphics-quality").value = quality
  }

  show(screen: Screen): void {
    for (const name of SCREENS) {
      const section = query<HTMLElement>(this.root, `[data-screen="${name}"]`)
      section.hidden = name !== screen
    }
    if (screen === "hud") this.resetControlsHint()
  }

  /** The HUD and the countdown overlay live together; the countdown can be shown over it. */
  private resetControlsHint(): void {
    const hint = query<HTMLElement>(this.root, "#controls-hint")
    hint.classList.remove("controls-hint--faded")
    if (this.hintTimer !== null) globalThis.clearTimeout(this.hintTimer)
    this.hintTimer = globalThis.setTimeout(() => hint.classList.add("controls-hint--faded"), 6000)
  }

  setTimer(milliseconds: number): void {
    query<HTMLElement>(this.root, "#timer").textContent = formatTime(milliseconds)
  }

  setCheckpoints(current: number, total: number): void {
    const state = `${current}:${total}`
    if (state === this.checkpointState) return
    this.checkpointState = state
    const pips = query<HTMLElement>(this.root, "#pips")
    if (pips.childElementCount !== total) {
      pips.replaceChildren()
      for (let index = 0; index < total; index += 1) {
        const pip = document.createElement("span")
        pip.className = "pip"
        pips.append(pip)
      }
    }
    pips.querySelectorAll(".pip").forEach((pip, index) => {
      pip.classList.toggle("pip--on", index < current)
    })
  }

  setPlace(text: string): void {
    if (text === this.placeText) return
    this.placeText = text
    query<HTMLElement>(this.root, "#place").textContent = text
  }

  setCountdown(value: string | null): void {
    const element = query<HTMLElement>(this.root, "#countdown")
    if (value === null) {
      element.hidden = true
      return
    }
    const label = value === "GO!" ? "צאו!" : value
    // The simulation sends this at 60 Hz. Animate/announce only a new number.
    if (!element.hidden && element.textContent === label) return
    element.hidden = false
    element.textContent = label
    element.classList.remove("countdown--pop")
    void element.offsetWidth
    element.classList.add("countdown--pop")
    this.announce(element.textContent)
  }

  setRoom(snapshot: RoomSnapshot, selfName: string, selfId?: PlayerId | null): void {
    query<HTMLElement>(this.root, "#room-code").textContent = snapshot.code
    const list = query<HTMLElement>(this.root, "#player-list")
    list.replaceChildren()
    for (const player of snapshot.players) {
      const item = document.createElement("li")
      item.className = `player${player.ready ? " player--ready" : ""}`
      const color = RUNNER_COLORS[player.colorIndex % RUNNER_COLORS.length] ?? RUNNER_COLORS[0]
      item.innerHTML = `<span class="player__dot" style="--dot:${color}"></span><span class="player__name"><bdi dir="auto">${escapeHtml(player.name)}</bdi>${(selfId === undefined ? player.name === selfName : player.id === selfId) ? " (אני)" : ""}${player.id === snapshot.players[0]?.id ? " · מארח החדר" : ""}</span><span class="player__state">${player.connected === false ? "מתחברים מחדש…" : player.ready ? "מוכנים" : "ממתינים"}</span>`
      list.append(item)
    }
    const session = sessionForRoom(snapshot)
    const host = snapshot.players[0]?.id === selfId
    const editable = host && snapshot.phase === "lobby" && session.round === 0
    const course = query<HTMLSelectElement>(this.root, "#lobby-course")
    const mode = query<HTMLSelectElement>(this.root, "#lobby-mode")
    const remix = query<HTMLInputElement>(this.root, "#lobby-remix")
    course.value = session.courseId
    mode.value = session.mode
    remix.checked = session.remix
    course.disabled = mode.disabled = remix.disabled = !editable
    query<HTMLElement>(this.root, "#lobby-route").textContent =
      session.mode === "cup"
        ? `מרוץ ${isolate(`${session.round + 1}/3`)}: ${session.playlist.map((id) => courseName(getCourse(id))).join(" ← ")}`
        : courseDescription(getCourse(session.courseId))
    query<HTMLElement>(this.root, "#host-hint").textContent =
      session.round > 0
        ? "סדר המסלולים נקבע. אפשר להתכונן למרוץ הבא."
        : host
          ? "כאן בוחרים את המסלול. לאחר שינוי כולם צריכים לאשר מחדש."
          : "מארח החדר בוחר את המסלול. כולם מתחרים באותו מסלול."
    const self = snapshot.players.find((p) => p.id === selfId)
    const readyButton = query<HTMLButtonElement>(this.root, "#ready-btn")
    readyButton.dataset.ready = String(self?.ready ?? false)
    readyButton.textContent = self?.ready ? "ממתינים לשאר המשתתפים…" : "אפשר להתחיל"
  }

  setCourse(session: RoomSession): void {
    const course = getCourse(session.courseId)
    query<HTMLElement>(this.root, "#hud-course").textContent =
      `${courseName(course)}${session.mode === "cup" ? ` · ${session.round + 1}/3` : ""}${session.remix ? " · קצב משתנה" : ""}`
    query<HTMLElement>(this.root, "#waiting-hint").hidden = true
    this.setCheckpoints(0, course.checkpoints.length - 1)
  }

  setConnectionDelayed(delayed: boolean): void {
    if (this.connectionDelayed === delayed) return
    this.connectionDelayed = delayed
    query<HTMLElement>(this.root, "#connection-delayed").hidden = !delayed
  }

  setReconnecting(reconnecting: boolean): void {
    query<HTMLElement>(this.root, "#reconnect-overlay").hidden = !reconnecting
  }
  setWaiting(): void {
    query<HTMLElement>(this.root, "#waiting-hint").hidden = false
  }

  setPhaseHint(phase: RoomPhase): void {
    const hint = query<HTMLElement>(this.root, ".screen--lobby .panel__hint")
    hint.textContent =
      phase === "countdown" ? "כולם מוכנים — מתחילים!" : "שתפו את הקוד. המרוץ מתחיל כשכולם מוכנים."
  }

  showFinish(
    timeMs: number,
    note: string,
    results: readonly RaceResult[],
    session?: RoomSession,
    finished = true,
  ): void {
    query<HTMLElement>(this.root, "#finish-time").dir = finished ? "ltr" : "rtl"
    query<HTMLElement>(this.root, "#finish-time").textContent = finished
      ? formatTime(timeMs)
      : "הזמן נגמר"
    query<HTMLElement>(this.root, "#finish-title").textContent =
      session?.mode === "cup"
        ? session.complete
          ? "הגביע הסתיים!"
          : `מרוץ ${session.round + 1} הסתיים`
        : finished
          ? "המרוץ הסתיים!"
          : "המרוץ הסתיים"
    query<HTMLElement>(this.root, "#restart-btn").textContent =
      session?.mode === "cup" ? (session.complete ? "גביע חדש" : "המרוץ הבא") : "מרוץ נוסף"
    const cup = query<HTMLElement>(this.root, "#cup-results")
    cup.hidden = session?.mode !== "cup"
    if (session?.mode === "cup") {
      query<HTMLElement>(this.root, "#cup-title").textContent = session.complete
        ? "דירוג הגביע הסופי"
        : "דירוג הגביע"
      query<HTMLElement>(this.root, "#cup-standings").innerHTML = session.standings
        .map(
          (row, index) =>
            `<li class="results__row"><span class="results__place">${index + 1}</span><span class="results__name"><bdi dir="auto">${escapeHtml(row.name)}</bdi></span><span class="results__time">${row.points} נק׳</span></li>`,
        )
        .join("")
    }
    query<HTMLElement>(this.root, "#finish-note").textContent = note
    const announcement = winnerAnnouncement(results, session)
    query<HTMLElement>(this.root, "#winner-announcement").textContent = announcement
    const list = query<HTMLElement>(this.root, "#results")
    list.replaceChildren()
    for (const result of results) {
      const item = document.createElement("li")
      item.className = "results__row"
      item.innerHTML = `<span class="results__place">${result.place}</span><span class="results__name"><bdi dir="auto">${escapeHtml(result.name)}</bdi></span><span class="results__time" dir="${result.timeMs === null ? "rtl" : "ltr"}">${result.timeMs === null ? "ללא סיום" : formatTime(result.timeMs)}</span>`
      list.append(item)
    }
    this.show("finish")
    this.announce(announcement)
  }

  showError(message: string): void {
    query<HTMLElement>(this.root, "#error-message").textContent = message
    this.show("error")
  }

  announce(message: string): void {
    query<HTMLElement>(this.root, "#live").textContent = message
  }

  resetReadyButton(): void {
    const button = query<HTMLButtonElement>(this.root, "#ready-btn")
    button.dataset.ready = "false"
    button.textContent = "אפשר להתחיל"
  }
}
