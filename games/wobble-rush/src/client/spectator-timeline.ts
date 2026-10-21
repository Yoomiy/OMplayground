/** A buffered whole-world view: spectators never guess another player's next input. */
import type { AuthorityActor, AuthorityFrame } from "../shared/action-protocol"
import { FIXED_STEP_SEC } from "../shared/constants"
import { NetworkTimeline } from "./network-timeline"

export const SPECTATOR_BUFFER_MS = 100
const MAX_FRAMES = 32
const RESET_GAP_MS = 500

export type SpectatorSample = {
  readonly actors: readonly AuthorityActor[]
  readonly references: readonly AuthorityActor[]
  readonly tick: number
  readonly worldTimeSec: number
}

export class SpectatorTimeline {
  private frames: AuthorityFrame[] = []
  private timeline: NetworkTimeline | null = null
  private receivedAtMs = 0
  private sampledTick = 0
  private sampled: SpectatorSample | null = null

  constructor(private readonly now: () => number = () => performance.now()) {}

  get frameAgeMs(): number {
    return Math.max(0, this.now() - this.receivedAtMs)
  }
  get sample(): SpectatorSample | null {
    return this.sampled
  }
  get frameCount(): number {
    return this.frames.length
  }

  push(frame: AuthorityFrame): void {
    const latest = this.frames.at(-1)
    if (latest?.raceId === frame.raceId && frame.tick < latest.tick) return
    const reset =
      !latest ||
      latest.raceId !== frame.raceId ||
      latest.phase !== frame.phase ||
      this.frameAgeMs > RESET_GAP_MS
    if (reset) this.clear()
    this.receivedAtMs = this.now()
    const time = frame.tick * FIXED_STEP_SEC - SPECTATOR_BUFFER_MS / 1000
    if (!this.timeline) this.timeline = new NetworkTimeline(time, this.receivedAtMs)
    else this.timeline.sync(time, this.receivedAtMs)
    if (this.frames.at(-1)?.tick === frame.tick) this.frames.pop()
    this.frames.push(structuredClone(frame))
    if (this.frames.length > MAX_FRAMES) this.frames.shift()
  }

  read(nowMs = this.now()): SpectatorSample | null {
    const latest = this.frames.at(-1)
    const oldest = this.frames[0]
    if (!latest || !oldest || !this.timeline) return null
    let time = this.timeline.read(nowMs)
    // After TCP delivers a long stale batch, return to the buffered live edge
    // instead of spending seconds replaying the backlog at a slightly faster rate.
    if (latest.tick - time / FIXED_STEP_SEC > RESET_GAP_MS / (FIXED_STEP_SEC * 1000)) {
      time = latest.tick * FIXED_STEP_SEC - SPECTATOR_BUFFER_MS / 1000
      this.timeline = new NetworkTimeline(time, nowMs)
    }
    const tick =
      latest.phase === "racing"
        ? Math.min(latest.tick, Math.max(oldest.tick, this.sampledTick, time / FIXED_STEP_SEC))
        : latest.tick
    this.sampledTick = tick
    let lower = oldest
    let upper = oldest
    for (const frame of this.frames) {
      upper = frame
      if (frame.tick >= tick) break
      lower = frame
    }
    const alpha = upper.tick === lower.tick ? 1 : (tick - lower.tick) / (upper.tick - lower.tick)
    const next = new Map(upper.actors.map((actor) => [actor.id, actor]))
    const actors = lower.actors.map((actor) => {
      const target = next.get(actor.id)
      // A respawn or removal becomes visible at its authoritative boundary, never
      // as a fast flight across the course. Finish flags also stay on that boundary.
      if (!target || actor.respawnSeq !== target.respawnSeq) return actor
      const from = actor.sim,
        to = target.sim
      const mix = (a: number, b: number) => a + (b - a) * alpha
      return {
        ...actor,
        sim: {
          ...from,
          position: {
            x: mix(from.position.x, to.position.x),
            y: mix(from.position.y, to.position.y),
            z: mix(from.position.z, to.position.z),
          },
          velocity: {
            x: mix(from.velocity.x, to.velocity.x),
            y: mix(from.velocity.y, to.velocity.y),
            z: mix(from.velocity.z, to.velocity.z),
          },
          yaw:
            from.yaw + Math.atan2(Math.sin(to.yaw - from.yaw), Math.cos(to.yaw - from.yaw)) * alpha,
        },
      }
    })
    const shown = tick === upper.tick ? upper.actors : actors
    const reference = new Map(
      (alpha < 0.5 ? lower.actors : upper.actors).map((actor) => [actor.id, actor]),
    )
    this.sampled = {
      actors: shown,
      references: shown.map((actor) => {
        const endpoint = reference.get(actor.id)
        return endpoint?.respawnSeq === actor.respawnSeq ? endpoint : actor
      }),
      tick,
      worldTimeSec: lower.worldTimeSec + (upper.worldTimeSec - lower.worldTimeSec) * alpha,
    }
    // Keep the lower bracket for the next draw, including packet bunching.
    while (this.frames.length > 2 && (this.frames[1]?.tick ?? Infinity) <= tick) this.frames.shift()
    return this.sampled
  }

  clear(): void {
    this.frames = []
    this.timeline = null
    this.sampledTick = 0
    this.sampled = null
  }
}
