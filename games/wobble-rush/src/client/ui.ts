/** In-game HUD only. The parent app owns lobby, results and session actions. */

import { getCourse } from "../shared/course-catalog"
import { courseName } from "../shared/hebrew"
import type { RoomSession } from "../shared/session"
import { formatTime, query, TEMPLATE } from "./ui-template"

export class Ui {
  readonly canvas: HTMLCanvasElement
  private connectionDelayed = false
  private checkpointState = ""
  private placeText: string | null = null
  private hintTimer: ReturnType<typeof globalThis.setTimeout> | null = null
  constructor(private readonly root: HTMLElement) {
    root.innerHTML = TEMPLATE
    this.canvas = query<HTMLCanvasElement>(root, "#stage")
  }
  dispose(): void {
    if (this.hintTimer !== null) globalThis.clearTimeout(this.hintTimer)
    this.hintTimer = null
  }
  show(screen: "lobby" | "hud" | "finished"): void {
    query<HTMLElement>(this.root, '[data-screen="hud"]').hidden = screen !== "hud"
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

  showError(message: string): void {
    query<HTMLElement>(this.root, "#connection-delayed").textContent = message
    query<HTMLElement>(this.root, "#connection-delayed").hidden = false
    this.announce(message)
  }
  announce(message: string): void {
    query<HTMLElement>(this.root, "#live").textContent = message
  }
}
