import { expect, test } from "bun:test"
import * as THREE from "three"
import { RemoteRunners } from "../src/client/remote-runners"
import { AuthoritativeRace } from "../src/shared/authoritative-race"
import { playableCourse } from "../src/shared/course-catalog"
import { RUNNER_COLORS } from "../src/shared/course-palette"
import { createRoom, reduceRoom } from "../src/shared/room-reducers"
import { asPlayerId, asRoomCode } from "../src/shared/types"

test("human roster refresh preserves NPC views; authority still removes vanished NPCs", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "document")
  // Only name-tag rasterization needs a DOM; meshes use real Three objects.
  const noop = () => {}
  const context = {
    beginPath: noop,
    moveTo: noop,
    arcTo: noop,
    closePath: noop,
    fill: noop,
    fillText: noop,
  }
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { createElement: () => ({ getContext: () => context }) },
  })
  const scene = new THREE.Scene()
  const remotes = new RemoteRunners(scene)
  try {
    const host = asPlayerId("host")
    const guest = asPlayerId("guest")
    let room = createRoom(asRoomCode("TEST"), 7)
    for (const id of [host, guest])
      room = reduceRoom(room, { kind: "join", id, name: id, colorIndex: 0 }, 0).state
    const race = new AuthoritativeRace(
      "test-race",
      playableCourse("sunrise-scramble"),
      room.players,
      7,
    )
    const frame = race.frame("racing", 0)
    remotes.syncPredicted(frame.actors, host, frame.tick, 0)
    const originalViews = [...scene.children]
    expect(remotes.count).toBe(1)
    expect(remotes.npcCount).toBe(2)
    remotes.sync(room, host)
    expect(scene.children).toEqual(originalViews)
    expect(remotes.npcCount).toBe(2)
    room = {
      ...room,
      players: room.players.map((player) =>
        player.id === guest ? { ...player, colorIndex: 6 } : player,
      ),
    }
    remotes.sync(room, host)
    expect(remotes.npcCount).toBe(2)
    expect(originalViews.slice(1).every((view) => scene.children.includes(view))).toBe(true)
    const changedView = scene.children.find((view) => !originalViews.includes(view))
    expect(changedView).toBeDefined()
    const colors: string[] = []
    changedView?.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        for (const material of Array.isArray(object.material) ? object.material : [object.material])
          if ("color" in material && material.color instanceof THREE.Color)
            colors.push(`#${material.color.getHexString()}`.toUpperCase())
      }
    })
    expect(colors).toContain(RUNNER_COLORS[6])
    room = reduceRoom(room, { kind: "leave", id: guest }, 1).state
    remotes.sync(room, host)
    expect(remotes.count).toBe(0)
    expect(remotes.npcCount).toBe(2)
    remotes.syncPredicted(
      frame.actors.filter((actor) => actor.id === host),
      host,
      frame.tick,
      50,
    )
    expect(remotes.npcCount).toBe(0)
    expect(scene.children).toHaveLength(0)
  } finally {
    remotes.clear()
    if (descriptor) Object.defineProperty(globalThis, "document", descriptor)
    else Reflect.deleteProperty(globalThis, "document")
  }
})
