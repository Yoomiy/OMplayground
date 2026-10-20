import type { Vec3 } from "../shared/types"

/** Visual offset only: never changes collision state or feeds back into prediction. */
export class CorrectionSmoother {
  private offset = { x: 0, y: 0, z: 0 }
  private decaySec = 0.1

  reset(): void {
    this.offset = { x: 0, y: 0, z: 0 }
  }

  correct(previous: Vec3, current: Vec3, snap = false, contact = false): void {
    const delta = {
      x: previous.x - current.x,
      y: previous.y - current.y,
      z: previous.z - current.z,
    }
    const distance = Math.hypot(delta.x, delta.y, delta.z)
    if (snap || distance > 2.5) {
      this.reset()
      return
    }
    // Ignore numerical noise without discarding an existing correction in flight.
    if (distance < 0.01) return
    this.offset.x += delta.x
    this.offset.y += delta.y
    this.offset.z += delta.z
    const length = Math.hypot(this.offset.x, this.offset.y, this.offset.z)
    if (length > 1.25) {
      const scale = 1.25 / length
      this.offset.x *= scale
      this.offset.y *= scale
      this.offset.z *= scale
    }
    this.decaySec = contact ? 0.04 : distance > 0.5 ? 0.06 : 0.1
  }

  position(sim: Vec3): Vec3 {
    return { x: sim.x + this.offset.x, y: sim.y + this.offset.y, z: sim.z + this.offset.z }
  }

  advance(dt: number): void {
    const decay = Math.exp(-Math.max(0, dt) / this.decaySec)
    this.offset.x *= decay
    this.offset.y *= decay
    this.offset.z *= decay
  }
}
