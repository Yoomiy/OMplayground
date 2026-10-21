/** Reflect authoritative session phases in the renderer, audio and HUD. */
import { NET } from "../shared/constants"
import { RUNNER_COLORS } from "../shared/course"
import type { RoomPhase } from "../shared/room"
import type { RoomSession } from "../shared/session"
import type { CourseDefinition } from "../shared/types"
import { asCheckpointIndex, assertNever } from "../shared/types"
import type { AudioKit } from "./audio"
import type { LocalRunner } from "./local-runner"
import type { RaceClock } from "./race-clock"
import type { Ui } from "./ui"

export class RaceDirector {
  private colorIndex = 0
  constructor(
    private readonly ports: {
      readonly ui: Ui
      readonly audio: AudioKit
      readonly clock: RaceClock
      readonly runner: LocalRunner
      readonly course: CourseDefinition
      readonly onRunnersReset: () => void
    },
  ) {}
  get currentColorIndex(): number {
    return this.colorIndex
  }
  restoreIdentity(_name: string, colorIndex: number): void {
    this.colorIndex = colorIndex
    this.ports.runner.setColor(RUNNER_COLORS[colorIndex % RUNNER_COLORS.length] ?? "#FF7A5C")
  }
  onPhase(
    phase: RoomPhase,
    endsAtMs: number | null,
    serverNowMs: number,
    session?: RoomSession,
  ): void {
    const { clock, ui, audio } = this.ports
    switch (phase) {
      case "lobby":
        clock.idle()
        ui.show("lobby")
        break
      case "countdown": {
        this.ports.runner.reset(this.ports.course.checkpoints[0]?.index ?? asCheckpointIndex(0))
        this.ports.onRunnersReset()
        const remaining =
          endsAtMs === null ? NET.countdownSec : Math.max(0, (endsAtMs - serverNowMs) / 1000)
        clock.beginCountdown(remaining, Math.max(0, NET.countdownSec - remaining))
        if (session?.startsAtMs !== null && session?.startsAtMs !== undefined)
          clock.syncNetworkWorld(serverNowMs, session.startsAtMs, NET.countdownSec)
        ui.show("hud")
        audio.startMusic()
        break
      }
      case "racing":
        clock.startRacing()
        ui.show("hud")
        if (session) ui.setCourse(session)
        audio.startMusic()
        if (session?.startsAtMs !== null && session?.startsAtMs !== undefined)
          clock.syncNetworkWorld(serverNowMs, session.startsAtMs, NET.countdownSec)
        ui.setCountdown(null)
        break
      case "finished":
        ui.show("finished")
        break
      default:
        assertNever(phase, "onPhase")
    }
  }
}
