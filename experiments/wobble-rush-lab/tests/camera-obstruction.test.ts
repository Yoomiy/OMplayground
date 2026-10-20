import { expect, test } from "bun:test"
import * as THREE from "three"
import { createOrbit } from "../src/client/camera-math"
import { clearCameraFraction } from "../src/client/camera-obstruction"
import { CameraRig } from "../src/client/camera-rig"
import { box } from "../src/shared/course-builders"
import { getCourse } from "../src/shared/course-catalog"
import { vec3 } from "../src/shared/types"

test("camera segment hits rotated cover but ignores its empty mirrored footprint", () => {
  for (const yaw of [0.6, -0.6, 1.2, -1.2]) {
    const cover = box(vec3(0, 2, 0), vec3(0.5, 0.2, 5), yaw)
    const x = Math.sin(yaw) * 4,
      z = Math.cos(yaw) * 4
    expect(clearCameraFraction(vec3(x, 0, z), vec3(x, 4, z), [cover])).toBeLessThan(0.5)
    expect(clearCameraFraction(vec3(-x, 0, z), vec3(-x, 4, z), [cover])).toBe(1)
  }
})

test("nearest cover wins independent of collider order; cover beyond the camera is ignored", () => {
  const near = box(vec3(0, 0, 3), vec3(2, 2, 0.2)),
    far = box(vec3(0, 0, 6), vec3(2, 2, 0.2))
  const start = vec3(0, 0, 0),
    end = vec3(0, 0, 8)
  expect(clearCameraFraction(start, end, [near, far])).toBe(
    clearCameraFraction(start, end, [far, near]),
  )
  expect(clearCameraFraction(start, end, [near])).toBeLessThan(0.4)
  expect(clearCameraFraction(start, vec3(0, 0, 2), [near])).toBe(1)
})

test("camera lowers under the actual cloud bridge at full distance, then recovers its height", () => {
  const camera = new THREE.PerspectiveCamera(62, 1.5, 0.1, 400),
    rig = new CameraRig(camera)
  rig.setCourse(getCourse("cloudline-fork"))
  const covered = vec3(0, 0.45, 28),
    orbit = createOrbit(0)
  rig.snapTo(covered, 0)
  for (let i = 0; i < 60; i++) rig.update({ ...covered }, vec3(0, 0, 0), orbit, 1 / 60, false)
  const short = camera.position.distanceTo(new THREE.Vector3(covered.x, covered.y + 1, covered.z))
  expect(short).toBeGreaterThan(7)
  expect(camera.position.y).toBeLessThan(2.6)
  const open = vec3(0, 0.45, -4)
  for (let i = 0; i < 120; i++) rig.update({ ...open }, vec3(0, 0, 0), orbit, 1 / 60, false)
  expect(camera.position.distanceTo(new THREE.Vector3(open.x, open.y + 1, open.z))).toBeGreaterThan(
    7,
  )
  expect(camera.position.y).toBeGreaterThan(3.5)
})
