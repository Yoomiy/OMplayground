/**
 * `window.wobble` — the inspection surface automated QA drives.
 *
 * `autopilot` hands the local runner to the same NPC brain the AI racers use, so a
 * recorded QA run still exercises the real simulation: physics, obstacles, checkpoints
 * and the finish trigger all apply. Nothing here teleports, disables collision or skips
 * any part of the course.
 */

export type WobbleSnapshot = {
  readonly phase: string
  readonly courseId?: string
  readonly session?: import("../shared/session").RoomSession
  readonly raceMs: number
  /** Time obstacles and NPCs are sampled at; shared across a party. */
  readonly worldTimeSec: number
  readonly renderWorldTimeSec?: number
  readonly renderAtMs?: number
  readonly checkpoint: number
  readonly position: { readonly x: number; readonly y: number; readonly z: number }
  readonly renderPosition?: { readonly x: number; readonly y: number; readonly z: number }
  readonly predictedActors?: readonly {
    id: string
    npc: boolean
    position: { x: number; y: number; z: number }
    velocity: { x: number; y: number; z: number }
    contact: string | null
    respawnSeq: number
  }[]
  readonly remotePositions?: readonly {
    id: string
    position: { x: number; y: number; z: number }
  }[]
  readonly remotes: number
  readonly npcs: number
  readonly npcProgress: readonly number[]
  /** Forward position of each remote runner, for verifying the relay. */
  readonly remoteProgress: readonly number[]
  readonly selfId?: string | null
  readonly room: string | null
  readonly serverTick?: number
  readonly spectatorBufferedFrames?: number
  readonly predictionTick?: number
  readonly pendingInputs?: number
  readonly predictionHistory?: number
  readonly predictionFrozen?: boolean
  readonly frameAgeMs?: number
  readonly correctionM?: number
  readonly rttMs?: number
}

export type WobbleDebugApi = {
  performance?(): {
    frames: ReturnType<import("./frame-metrics").FrameMetrics["snapshot"]>
    graphics: {
      quality: import("../shared/graphics-quality").GraphicsQuality
      pixelRatio: number
      width: number
      height: number
      shadows: boolean
      shadowSize: number
    }
    renderer: { drawCalls: number; triangles: number; geometries: number; textures: number }
  }
  state(): WobbleSnapshot
  autopilot(enabled: boolean, routeIndex?: number): void
}

export function installDebugApi(api: WobbleDebugApi): () => void {
  Object.defineProperty(globalThis, "wobble", { value: api, configurable: true })
  return () => {
    if (Object.getOwnPropertyDescriptor(globalThis, "wobble")?.value === api)
      Reflect.deleteProperty(globalThis, "wobble")
  }
}
