import { expect, test } from "bun:test"
import { FrameMetrics } from "../src/client/frame-metrics"
import {
  GRAPHICS_QUALITY,
  graphicsPixelRatio,
  isGraphicsQuality,
} from "../src/shared/graphics-quality"

test("quality budgets bound large and high-DPI displays without upscaling low-DPI screens", () => {
  for (const quality of ["low", "balanced", "high"] as const)
    for (const [width, height, ratio] of [
      [800, 450, 2],
      [1920, 1080, 2],
      [7680, 4320, 3],
      [1, 1, 1],
    ]) {
      const actual = graphicsPixelRatio(quality, width ?? 1, height ?? 1, ratio ?? 1)
      expect(actual).toBeLessThanOrEqual(ratio ?? 1)
      expect(actual).toBeLessThanOrEqual(GRAPHICS_QUALITY[quality].pixelRatio)
      expect(actual * actual * (width ?? 1) * (height ?? 1)).toBeLessThanOrEqual(
        GRAPHICS_QUALITY[quality].maxPixels + 1e-6,
      )
    }
  expect(graphicsPixelRatio("low", 800, 450, 2)).toBe(1)
  expect(graphicsPixelRatio("balanced", 800, 450, 2)).toBe(1.25)
  expect(isGraphicsQuality("ultra")).toBe(false)
})

test("frame samples stay bounded and do not count hidden/menu intervals as gameplay stalls", () => {
  const metrics = new FrameMetrics()
  metrics.record(1, true)
  metrics.record(17, true)
  metrics.record(10000, false)
  metrics.record(20000, true)
  metrics.record(20050, true)
  expect(metrics.snapshot()).toMatchObject({
    samples: 2,
    renderedFrames: 4,
    skippedDraws: 1,
    meanMs: 33,
    p95Ms: 50,
  })
  for (let n = 1; n <= 2000; n++) metrics.record(20050 + n * 16, true)
  expect(metrics.snapshot()).toMatchObject({ samples: 600, p99Ms: 16, meanMs: 16, over50Ms: 0 })
})
