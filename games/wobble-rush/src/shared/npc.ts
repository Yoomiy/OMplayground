/**
 * Deterministic NPC racers for Wobble Rush 3D.
 *
 * Decisions use explicit seed, course, time and simulation state. Online NPCs
 * run on the authoritative host; solo NPCs run locally. No `Math.random`, no
 * `Date.now`, no hidden state beyond the fields on `NpcRacer`.
 */

import { NPC, RUNNER } from "./constants"
import { gateOpenAt, moverBoxAt } from "./obstacles"
import { hashString, mulberry32, type Rng, randomRange } from "./rng"
import {
  asPlayerId,
  type CourseDefinition,
  NEUTRAL_INPUT,
  type PlayerId,
  type PlayerInput,
  type RunnerSim,
  type Vec3,
  type WorldSnapshot,
} from "./types"

/** Original playful racer names (not Fall Guys names). */
export const NPC_NAMES: readonly string[] = [
  "Bolt Biscuit",
  "Wobbly Wendy",
  "Turbo Tofu",
  "Captain Crumble",
  "Zigzag Zelda",
  "Pickle Rocket",
  "Noodle Knight",
  "Blimp Betty",
  "Socks McGee",
  "Fumblebee",
]

export type NpcRacer = {
  readonly id: PlayerId
  readonly name: string
  readonly colorIndex: number
  /** 0.82..1.0 multiplier on run speed; makes the pack spread out. */
  readonly skill: number
  waypointIndex: number
  reactionTimer: number
  wobblePhase: number
  finishedAtMs: number | null
  /** Committed departure from a mover; do not steer back when it leaves. */
  rideExitIndex?: number
}

/**
 * `reactionTimer` encodes the jump state machine so no extra fields are
 * needed (the type above is the multiplayer-serialisable contract):
 *   0               — idle, no hazard detected
 *   > 0             — hazard detected, counting down the reaction delay
 *   REACTION_READY  — delay elapsed; fire on the next `npcInput` tick
 *   JUMP_LATCHED    — already fired for this continuous hazard (rising edge)
 * Clearing the hazard resets the timer to 0, cancelling a pending jump and
 * re-arming the latch.
 */
const REACTION_READY = -0.5
const JUMP_LATCHED = -1

/** Waypoint must be at least this much higher than the NPC to trigger a jump. */
const ELEVATED_JUMP_DELTA = 0.6
/** Depth below the NPC's feet at which the ground probe samples the world. */
const GAP_PROBE_DROP = 1.2
/** Remaining distance to the final waypoint that triggers a finish-line lunge. */
const DIVE_DISTANCE = 6
/** Fraction of the NPC's top speed required before it will dive. */
const DIVE_SPEED_FRACTION = 0.85

/** Fisher–Yates shuffle driven by the seeded RNG (deterministic). */
const shuffle = (items: readonly string[], rng: Rng): string[] => {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const a = result[i]
    const b = result[j]
    if (a !== undefined && b !== undefined) {
      result[i] = b
      result[j] = a
    }
  }
  return result
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

/** Stable lane choice is shared by steering, progress and checkpoint recovery. */
export function npcWaypoints(npc: NpcRacer, course: CourseDefinition): readonly Vec3[] {
  const routes = course.routes
  return routes?.[npc.colorIndex % routes.length]?.waypoints ?? course.waypoints
}

/**
 * Build `count` racers deterministically from `seed` (mixed with the course
 * id so different courses field different packs from the same seed). Names
 * are drawn from a seeded shuffle of `NPC_NAMES` without repetition; when
 * `count` exceeds the pool, later cycles get a numeric suffix.
 */
export function createNpcRacers(course: CourseDefinition, seed: number, count: number): NpcRacer[] {
  const rng = mulberry32((seed ^ hashString(course.id)) >>> 0)
  const names = shuffle(NPC_NAMES, rng)
  const racers: NpcRacer[] = []
  for (let i = 0; i < count; i++) {
    const cycle = Math.floor(i / names.length)
    const base = names[i % names.length] ?? `Racer ${i + 1}`
    racers.push({
      id: asPlayerId(`npc-${i}`),
      name: cycle === 0 ? base : `${base} ${cycle + 1}`,
      colorIndex: i,
      skill: randomRange(rng, NPC.minSkill, NPC.maxSkill),
      waypointIndex: 0,
      reactionTimer: 0,
      wobblePhase: randomRange(rng, 0, Math.PI * 2),
      finishedAtMs: null,
    })
  }
  return racers
}

/** True when the current target warrants a jump (ledge above, or gap ahead). */
const detectJumpCondition = (
  sim: RunnerSim,
  target: Vec3,
  dist: number,
  dirX: number,
  dirZ: number,
  world: WorldSnapshot,
): boolean => {
  if (target.y - sim.position.y > ELEVATED_JUMP_DELTA && dist <= NPC.jumpLookAhead) {
    return true
  }
  if (dist <= 1e-6) {
    return false
  }
  // Look ahead for a hole: `hasFallen` only reports "already fell", so ask the
  // world what supports the column the runner is about to enter.
  //
  // The probe distance is speed-derived on purpose. A fixed look-ahead makes a
  // fast runner jump far too early and land inside the gap it was avoiding; this
  // keeps take-off just short of the ledge whatever the runner's speed.
  const speed = Math.hypot(sim.velocity.x, sim.velocity.z)
  const lookAhead = Math.min(NPC.jumpLookAhead, speed * (NPC.reactionSec + 0.06) + 0.5)
  const aheadX = sim.position.x + dirX * lookAhead
  const aheadZ = sim.position.z + dirZ * lookAhead
  const obstacleTop = world.supportHeightAt(aheadX, aheadZ, sim.position.y + 1.7)
  if (obstacleTop !== null && obstacleTop > sim.position.y + 0.2) return true
  const support = world.supportHeightAt(aheadX, aheadZ, sim.position.y)
  return support === null || sim.position.y - support > GAP_PROBE_DROP
}

/**
 * Compute this tick's input for one NPC. Steering is expressed in world
 * space: `cameraYaw` is fixed at 0 and forward/strafe carry the normalised
 * XZ direction towards the target waypoint, scaled by `skill`.
 */
export function npcInput(
  npc: NpcRacer,
  sim: RunnerSim,
  course: CourseDefinition,
  world: WorldSnapshot,
  timeSec: number,
): PlayerInput {
  const waypoints = npcWaypoints(npc, course)
  const lastIndex = waypoints.length - 1
  const targetIndex = clamp(npc.waypointIndex, 0, Math.max(lastIndex, 0))
  const target = waypoints[targetIndex]
  if (target === undefined) {
    return NEUTRAL_INPUT
  }

  const ride = course.routes?.[npc.colorIndex % (course.routes?.length ?? 1)]?.rides?.find(
    (entry) => targetIndex === entry.waypointIndex - 1 || targetIndex === entry.waypointIndex,
  )
  if (ride !== undefined) {
    const mover = course.obstacles.find((entry) => entry.id === ride.moverId)
    const exit = waypoints[ride.waypointIndex]
    if (mover?.kind === "mover" && exit !== undefined) {
      const box = moverBoxAt(mover, timeSec)
      const top = box.center.y + box.halfExtents.y
      const aboard =
        Math.abs(sim.position.y - RUNNER.radius - top) < 0.7 &&
        Math.abs(sim.position.x - box.center.x) < box.halfExtents.x + 0.1 &&
        Math.abs(sim.position.z - box.center.z) < box.halfExtents.z + 0.1
      if (aboard) npc.waypointIndex = ride.waypointIndex
      const atExit =
        Math.abs(sim.position.y - RUNNER.radius - exit.y) < 0.7 &&
        Math.hypot(sim.position.x - exit.x, sim.position.z - exit.z) < 2.6
      if (atExit) delete npc.rideExitIndex
      if (!atExit) {
        const gate = course.obstacles.find((entry) => entry.id === ride.gateId)
        const end =
          Math.hypot(
            mover.from.x - exit.x,
            mover.from.y + mover.halfExtents.y - exit.y,
            mover.from.z - exit.z,
          ) <
          Math.hypot(
            mover.to.x - exit.x,
            mover.to.y + mover.halfExtents.y - exit.y,
            mover.to.z - exit.z,
          )
            ? mover.from
            : mover.to
        const mayExit =
          aboard &&
          Math.abs(top - exit.y) < 0.45 &&
          Math.hypot(box.center.x - end.x, box.center.z - end.z) < 0.9 &&
          (gate?.kind !== "gate" || gateOpenAt(gate, timeSec) > 0.9)
        if (mayExit) npc.rideExitIndex = ride.waypointIndex
        const exiting = npc.rideExitIndex === ride.waypointIndex
        const boardable =
          Math.abs(top - (mover.from.y + mover.halfExtents.y)) < 0.5 &&
          Math.hypot(box.center.x - mover.from.x, box.center.z - mover.from.z) < 1.2
        const aim = exiting ? exit : aboard || boardable ? box.center : ride.wait
        const dx = aim.x - sim.position.x,
          dz = aim.z - sim.position.z
        const distance = Math.hypot(dx, dz)
        const speed = Math.min(npc.skill, (distance * 2) / RUNNER.runSpeed)
        const needsJump =
          exiting &&
          distance > 2.2 &&
          sim.grounded &&
          world.supportHeightAt(
            sim.position.x + (dx / distance) * 1.2,
            sim.position.z + (dz / distance) * 1.2,
            sim.position.y,
          ) === null
        return {
          forward: distance > 0.05 ? (dz / distance) * speed : 0,
          strafe: distance > 0.05 ? (-dx / distance) * speed : 0,
          jumpHeld: needsJump || sim.jumpRising,
          jumpPressed: needsJump,
          divePressed: false,
          cameraYaw: 0,
        }
      }
    }
  }

  const dx = target.x - sim.position.x
  const dz = target.z - sim.position.z
  const dist = Math.hypot(dx, dz)
  const dirX = dist > 1e-6 ? dx / dist : 0
  const dirZ = dist > 1e-6 ? dz / dist : 0

  // NPCs steer in world space with cameraYaw fixed at 0, where the right-hand
  // axis is -X. Negating dirX expresses the world direction in the same
  // camera-relative strafe channel a human's D key uses.
  let forward = dirZ * npc.skill
  let strafe = -dirX * npc.skill
  strafe +=
    Math.sin(timeSec * 2 * Math.PI * NPC.wobbleHz + npc.wobblePhase) *
    (course.navigation?.wobbleAmplitude ?? NPC.wobbleAmplitude)

  // Jump: rising-edge only, gated by the reaction-delay state machine.
  // Jump off a strong reverse/sideways belt rather than running in place.
  const alongFlow = sim.carry.x * dirX + sim.carry.z * dirZ
  const crossFlow = Math.abs(sim.carry.x * dirZ - sim.carry.z * dirX)
  const fightingBelt =
    sim.grounded && (alongFlow < -RUNNER.runSpeed * 0.7 || crossFlow > RUNNER.runSpeed * 0.7)
  const jumpCondition = fightingBelt || detectJumpCondition(sim, target, dist, dirX, dirZ, world)
  let jumpPressed = false
  if (jumpCondition) {
    if (npc.reactionTimer === 0) {
      npc.reactionTimer = NPC.reactionSec
    } else if (npc.reactionTimer === REACTION_READY) {
      jumpPressed = true
      npc.reactionTimer = JUMP_LATCHED
    }
  } else if (npc.reactionTimer !== 0) {
    npc.reactionTimer = 0
  }
  // The arrow paint is an immediate cue: waiting out the generic gap reaction
  // would let a strong belt pull the pilot off its lip before it can jump.
  if (fightingBelt && sim.grounded && !sim.jumpRising) {
    jumpPressed = true
    npc.reactionTimer = JUMP_LATCHED
  }
  // A spinner can repeatedly knock a pilot away from its next waypoint
  // without ever dropping it off the road. After recovering, jump clear of
  // that same nearby arm rather than retrying the identical ground approach.
  const struck = course.obstacles.find((obstacle) => obstacle.id === sim.lastContactId)
  const recoveringFromSweeper =
    struck?.kind === "sweeper" &&
    Math.abs(sim.position.y - struck.pivot.y) < RUNNER.height &&
    Math.hypot(sim.position.x - struck.pivot.x, sim.position.z - struck.pivot.z) <
      (struck.centered === true ? struck.armLength / 2 : struck.armLength) + RUNNER.radius
  if (recoveringFromSweeper && sim.grounded && sim.stumbleTimer <= 0 && !sim.jumpRising) {
    jumpPressed = true
    npc.reactionTimer = JUMP_LATCHED
  }
  // Keep the key held for the whole rise so the jump reaches full height.
  const jumpHeld = jumpPressed || sim.jumpRising

  // Dive: finish-line lunge when grounded and moving near top speed.
  const finalWaypoint = waypoints[lastIndex]
  let divePressed = false
  if (finalWaypoint !== undefined && sim.grounded && sim.diveTimer <= 0 && sim.diveCooldown <= 0) {
    const finalDist = Math.hypot(finalWaypoint.x - sim.position.x, finalWaypoint.z - sim.position.z)
    const speed = Math.hypot(sim.velocity.x, sim.velocity.z)
    if (finalDist < DIVE_DISTANCE && speed >= RUNNER.runSpeed * npc.skill * DIVE_SPEED_FRACTION) {
      divePressed = true
    }
  }

  forward = clamp(Number.isFinite(forward) ? forward : 0, -1, 1)
  strafe = clamp(Number.isFinite(strafe) ? strafe : 0, -1, 1)

  return { forward, strafe, jumpHeld, jumpPressed, divePressed, cameraYaw: 0 }
}

/**
 * Advance waypoint progress and tick the reaction timer. Pure function of
 * its arguments: advances `waypointIndex` (never backwards, clamped at the
 * last waypoint) while the NPC is inside `NPC.waypointRadius` of its target.
 */
export function rewindNpcAfterRespawn(
  npc: NpcRacer,
  sim: RunnerSim,
  course: CourseDefinition,
): void {
  delete npc.rideExitIndex
  const checkpoint = course.checkpoints.find((cp) => cp.index === sim.checkpoint)
  const exact =
    course.routes?.[npc.colorIndex % course.routes.length]?.checkpointWaypoints?.[sim.checkpoint]
  if (exact !== undefined) {
    npc.waypointIndex = exact
    npc.reactionTimer = 0
    return
  }
  const z = checkpoint?.respawn.z ?? course.spawn.z
  const next = npcWaypoints(npc, course).findIndex((point) => point.z >= z - 0.1)
  npc.waypointIndex = Math.max(0, next)
  npc.reactionTimer = 0
}

export function updateNpcProgress(
  npc: NpcRacer,
  sim: RunnerSim,
  course: CourseDefinition,
  dt: number,
): void {
  if (npc.reactionTimer > 0) {
    npc.reactionTimer -= dt
    if (npc.reactionTimer <= 0) {
      npc.reactionTimer = REACTION_READY
    }
  }

  const waypoints = npcWaypoints(npc, course)
  const lastIndex = waypoints.length - 1
  if (lastIndex < 0) {
    return
  }
  npc.waypointIndex = clamp(npc.waypointIndex, 0, lastIndex)
  while (npc.waypointIndex < lastIndex) {
    const target = waypoints[npc.waypointIndex]
    if (target === undefined) {
      break
    }
    const dist = Math.hypot(target.x - sim.position.x, target.z - sim.position.z)
    if (
      dist >= (course.navigation?.waypointRadius ?? NPC.waypointRadius) ||
      (course.routes?.[npc.colorIndex % (course.routes?.length ?? 1)]?.rides?.some(
        (ride) => ride.waypointIndex === npc.waypointIndex,
      ) === true &&
        Math.abs(target.y + RUNNER.radius - sim.position.y) > 1.8)
    ) {
      break
    }
    npc.waypointIndex += 1
  }
}
