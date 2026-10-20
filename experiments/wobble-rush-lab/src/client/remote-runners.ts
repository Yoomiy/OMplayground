/** Remote meshes display the shared predicted world, on the local runner's exact timeline. */
import type * as THREE from "three"
import type { AuthorityActor } from "../shared/action-protocol"
import { RUNNER } from "../shared/constants"
import { RUNNER_COLORS } from "../shared/course"
import type { RoomSnapshot } from "../shared/room"
import type { PlayerId, RunnerSim } from "../shared/types"
import { CorrectionSmoother } from "./correction-smoother"
import { FixedPose } from "./fixed-pose"
import { RunnerView } from "./runner-view"

type Entry = {
  readonly view: RunnerView
  readonly npc: boolean
  readonly colorIndex: number
  pose: FixedPose | null
  sim: RunnerSim | null
  readonly correction: CorrectionSmoother
  respawnSeq: number
  tick: number
}
export class RemoteRunners {
  private readonly entries = new Map<PlayerId, Entry>()
  constructor(private readonly scene: THREE.Scene) {}
  get count(): number {
    return [...this.entries.values()].filter((entry) => !entry.npc).length
  }
  get npcCount(): number {
    return [...this.entries.values()].filter((entry) => entry.npc).length
  }
  progress(): number[] {
    return [...this.entries.values()].map(
      (entry) => entry.sim?.position.z ?? Number.NEGATIVE_INFINITY,
    )
  }

  syncPredicted(
    actors: readonly AuthorityActor[],
    selfId: PlayerId | null,
    tick: number,
    atMs: number,
    reconcile = false,
    reset = false,
  ): void {
    const alive = new Set<PlayerId>()
    for (const actor of actors) {
      if (actor.id === selfId) continue
      alive.add(actor.id)
      const entry = this.entryFor(actor)
      const previous = entry.sim?.position
      const snap = reset || entry.pose === null || actor.respawnSeq !== entry.respawnSeq
      if (snap || previous === undefined) {
        entry.pose = new FixedPose(actor.sim.position)
        entry.correction.reset()
      } else if (reconcile) {
        entry.pose?.translate({
          x: actor.sim.position.x - previous.x,
          y: actor.sim.position.y - previous.y,
          z: actor.sim.position.z - previous.z,
        })
        entry.correction.correct(previous, actor.sim.position, false, true)
      } else if (tick !== entry.tick) entry.pose?.push(previous, actor.sim.position, atMs)
      entry.sim = structuredClone(actor.sim)
      entry.tick = tick
      entry.respawnSeq = actor.respawnSeq
    }
    for (const [id, entry] of this.entries) if (!alive.has(id)) this.remove(id, entry)
  }

  sync(snapshot: RoomSnapshot, selfId: PlayerId | null): void {
    const alive = new Set<PlayerId>()
    for (const player of snapshot.players) {
      if (player.id === selfId) continue
      alive.add(player.id)
      this.entryFor({ ...player, npc: false })
    }
    for (const [id, entry] of this.entries) if (!entry.npc && !alive.has(id)) this.remove(id, entry)
  }

  render(nowMs: number, dt: number): void {
    for (const entry of this.entries.values()) {
      if (entry.sim === null || entry.pose === null) continue
      entry.correction.advance(dt)
      const position = entry.correction.position(entry.pose.read(nowMs))
      entry.view.update({ ...entry.sim, position }, dt)
    }
  }
  /** Inspection reads the actual displayed contact geometry, not just simulation positions. */
  positions(): { id: PlayerId; position: { x: number; y: number; z: number } }[] {
    return [...this.entries]
      .filter(([, entry]) => entry.sim !== null)
      .map(([id, entry]) => ({
        id,
        position: {
          x: entry.view.group.position.x,
          y: entry.view.group.position.y + RUNNER.radius,
          z: entry.view.group.position.z,
        },
      }))
  }
  clear(): void {
    for (const [id, entry] of this.entries) this.remove(id, entry)
  }
  private entryFor(actor: { id: PlayerId; name: string; colorIndex: number; npc: boolean }): Entry {
    const entry = this.entries.get(actor.id)
    if (entry?.colorIndex === actor.colorIndex) return entry
    if (entry) this.remove(actor.id, entry)
    return this.add(actor)
  }
  private add(actor: { id: PlayerId; name: string; colorIndex: number; npc: boolean }): Entry {
    const view = new RunnerView(
      RUNNER_COLORS[actor.colorIndex % RUNNER_COLORS.length] ?? "#FF7A5C",
      actor.name,
    )
    this.scene.add(view.group)
    const entry: Entry = {
      view,
      npc: actor.npc,
      colorIndex: actor.colorIndex,
      pose: null,
      sim: null,
      correction: new CorrectionSmoother(),
      respawnSeq: 0,
      tick: -1,
    }
    this.entries.set(actor.id, entry)
    return entry
  }
  private remove(id: PlayerId, entry: Entry): void {
    this.scene.remove(entry.view.group)
    entry.view.dispose()
    this.entries.delete(id)
  }
}
