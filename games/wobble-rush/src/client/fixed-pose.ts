import { FIXED_STEP_SEC } from "../shared/constants"
import type { Vec3 } from "../shared/types"

/** One physics step of display interpolation, independent of RAF/timer phase. */
export class FixedPose {
  private older: { x: number; y: number; z: number }
  private previous: { x: number; y: number; z: number }
  private current: { x: number; y: number; z: number }
  private atMs = -Infinity
  constructor(position: Vec3) {
    this.older = { ...position }
    this.previous = { ...position }
    this.current = { ...position }
  }
  reset(position: Vec3): void {
    this.older = { ...position }
    this.previous = { ...position }
    this.current = { ...position }
    this.atMs = -Infinity
  }
  push(previous: Vec3, current: Vec3, nowMs: number): void {
    this.older = { ...this.previous }
    this.previous = { ...previous }
    this.current = { ...current }
    this.atMs = nowMs
  }
  translate(delta: Vec3): void {
    for (const position of [this.older, this.previous, this.current]) {
      position.x += delta.x
      position.y += delta.y
      position.z += delta.z
    }
  }
  read(nowMs: number): Vec3 {
    const phase = (nowMs - this.atMs) / (FIXED_STEP_SEC * 1000)
    // RAF's compositor timestamp can predate a timer that already stepped the
    // simulation. Use the older segment instead of snapping its alpha to zero.
    const previous = phase < 0 ? this.older : this.previous
    const current = phase < 0 ? this.previous : this.current
    const alpha = Math.max(0, Math.min(1, phase < 0 ? phase + 1 : phase))
    return {
      x: previous.x + (current.x - previous.x) * alpha,
      y: previous.y + (current.y - previous.y) * alpha,
      z: previous.z + (current.z - previous.z) * alpha,
    }
  }
}
