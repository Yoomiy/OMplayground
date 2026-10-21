import { expect, test } from "bun:test"
import { FrameLoop } from "../src/client/frame-loop"

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

test("a stale first animation timestamp cannot put the renderer clock in debt", () => {
  withFrames((frame) => {
    const elapsed: number[] = []
    const loop = new FrameLoop(
      (dt) => elapsed.push(dt),
      () => 20_000,
    )
    loop.start()
    frame(0)
    expect(elapsed).toEqual([0])
    frame(1000 / 60)
    expect(elapsed[1]).toBeCloseTo(1 / 60)
    loop.stop()
  })
})

test("a long rendering stall is clamped independently of fixed-rate input", () => {
  withFrames((frame) => {
    const elapsed: number[] = []
    const loop = new FrameLoop(
      (dt) => elapsed.push(dt),
      () => 0,
    )
    loop.start()
    frame(2000)
    expect(elapsed).toEqual([0.25])
    frame(2000 + 1000 / 60)
    expect(elapsed[1]).toBeCloseTo(1 / 60)
    loop.stop()
  })
})
