import { expect, test } from "bun:test"
import { FrameLoop } from "../src/client/frame-loop"
import { FIXED_STEP_SEC, MAX_STEPS_PER_FRAME } from "../src/shared/constants"

function withFrames(run: (frame: (now: number) => void) => void): void {
  const raf = Object.getOwnPropertyDescriptor(globalThis, "requestAnimationFrame")
  const cancel = Object.getOwnPropertyDescriptor(globalThis, "cancelAnimationFrame")
  const callbacks: FrameRequestCallback[] = []
  globalThis.requestAnimationFrame = (callback) => callbacks.push(callback)
  globalThis.cancelAnimationFrame = () => {}
  try {
    run((now) => {
      const callback = callbacks.shift()
      if (callback === undefined) throw new Error("No frame scheduled")
      callback(now)
    })
  } finally {
    if (raf) Object.defineProperty(globalThis, "requestAnimationFrame", raf)
    else Reflect.deleteProperty(globalThis, "requestAnimationFrame")
    if (cancel) Object.defineProperty(globalThis, "cancelAnimationFrame", cancel)
    else Reflect.deleteProperty(globalThis, "cancelAnimationFrame")
  }
}

test("a stale first animation timestamp cannot delay input/physics after slow boot", () => {
  withFrames((frame) => {
    let steps = 0
    const elapsed: number[] = []
    const loop = new FrameLoop(
      () => steps++,
      (dt) => elapsed.push(dt),
      () => 20_000,
    )
    loop.start()
    frame(0)
    expect(steps).toBe(0)
    expect(elapsed).toEqual([0])
    frame(1000 / 60 + 0.001)
    expect(steps).toBe(1)
    frame(2000 / 60 + 0.001)
    expect(steps).toBe(2)
    loop.stop()
  })
})

test("long stalls retain the existing fixed-step catch-up budget", () => {
  withFrames((frame) => {
    const steps: number[] = []
    const loop = new FrameLoop(
      (dt) => steps.push(dt),
      () => {},
      () => 0,
    )
    loop.start()
    frame(2000)
    expect(steps).toHaveLength(MAX_STEPS_PER_FRAME)
    expect(steps.every((dt) => dt === FIXED_STEP_SEC)).toBe(true)
    frame(2000 + 1000 / 60 + 0.001)
    expect(steps).toHaveLength(MAX_STEPS_PER_FRAME + 1)
    loop.stop()
  })
})
