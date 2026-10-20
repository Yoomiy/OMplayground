/**
 * The race state machine: countdown, running timer, finish.
 * Kept separate from Game so the phase rules read as one small table.
 */

import { NetworkTimeline } from "./network-timeline"

export const RACE_PHASES = ["idle", "countdown", "racing", "finished"] as const
export type RacePhase = (typeof RACE_PHASES)[number]

export class RaceClock {
  private state: RacePhase = "idle"
  private elapsedMs = 0
  private countdown = 0
  private worldSec = 0
  private anchor: { timeline: NetworkTimeline; countdownSec: number } | null = null

  constructor(private readonly monoNow: () => number = () => performance.now()) {}

  syncNetworkWorld(serverNowMs: number, startsAtMs: number, countdownSec: number): void {
    this.syncAuthority(
      Math.max(0, countdownSec + (serverNowMs - startsAtMs) / 1000),
      0,
      countdownSec,
    )
  }

  /** Rendering/HUD estimate; physical prediction uses integer authoritative ticks. */
  syncAuthority(
    worldTimeSec: number,
    oneWaySec: number,
    countdownSec: number,
    reset = false,
  ): void {
    const nowMs = this.monoNow()
    const timeSec = worldTimeSec + oneWaySec
    if (this.anchor === null || reset) {
      this.anchor = { timeline: new NetworkTimeline(timeSec, nowMs), countdownSec }
      this.worldSec = timeSec
    } else this.anchor.timeline.sync(timeSec, nowMs)
  }

  /** Sample on every draw, including displays that render faster than 60 Hz. */
  get renderWorldTimeSec(): number {
    return this.anchor?.timeline.read(this.monoNow()) ?? this.worldSec
  }

  finishAt(raceMs: number): void {
    this.elapsedMs = raceMs
    this.state = "finished"
  }

  get phase(): RacePhase {
    return this.state
  }

  get raceMs(): number {
    return this.elapsedMs
  }

  /** True whenever player input must be ignored. */
  get locked(): boolean {
    return this.state !== "racing"
  }

  /**
   * Time fed to obstacle kinematics and the NPC brains.
   *
   * Anchored to the countdown rather than to page load: every client in a party
   * is told the same countdown by the server, so they all drive the world from
   * the same obstacle rhythms. NPC movement still uses each client's fixed steps.
   */
  get worldTimeSec(): number {
    return this.worldSec
  }

  /**
   * `worldStartSec` is how much of the countdown has already elapsed on the
   * server, so a client that joins the countdown late still lines up.
   */
  beginCountdown(seconds: number, worldStartSec = 0): void {
    this.state = "countdown"
    this.anchor = null
    this.countdown = seconds
    this.elapsedMs = 0
    this.worldSec = Math.max(0, worldStartSec)
  }

  /** Server-driven races skip the local countdown and start on command. */
  startRacing(): void {
    this.state = "racing"
  }

  finish(): void {
    this.state = "finished"
  }

  idle(): void {
    this.state = "idle"
    this.anchor = null
    this.elapsedMs = 0
    this.worldSec = 0
  }

  /** Freeze the local view while reconnecting; the server keeps simulating. */
  suspend(): void {
    this.state = "idle"
    this.anchor = null
  }

  /**
   * Advances one fixed step. Returns the countdown label to display (null once the
   * countdown is over) and whether the race just started locally.
   */
  tick(
    dt: number,
    autoStart: boolean,
  ): { readonly label: string | null; readonly started: boolean } {
    if (this.state !== "idle") {
      this.worldSec =
        this.anchor === null ? this.worldSec + dt : this.anchor.timeline.read(this.monoNow())
    }
    if (this.state === "countdown") {
      this.countdown =
        this.anchor === null ? this.countdown - dt : this.anchor.countdownSec - this.worldSec
      if (this.countdown > 0) return { label: String(Math.ceil(this.countdown)), started: false }
      if (autoStart) {
        this.state = "racing"
        return { label: "GO!", started: true }
      }
      return { label: "GO!", started: false }
    }
    if (this.state === "racing") {
      this.elapsedMs =
        this.anchor === null
          ? this.elapsedMs + dt * 1000
          : Math.max(0, (this.worldSec - this.anchor.countdownSec) * 1000)
      return { label: null, started: false }
    }
    return { label: null, started: false }
  }
}
