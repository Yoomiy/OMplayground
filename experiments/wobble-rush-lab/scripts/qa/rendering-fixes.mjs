import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { chromium } from "@playwright/test"

const base = process.env.LAB_URL || "http://127.0.0.1:19003"
const out = process.env.LAB_EVIDENCE || "evidence/balance-rendering"
await mkdir(out, { recursive: true })
const browser = await chromium.launch({
  executablePath:
    "/home/ubuntu/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux-arm64/chrome-headless-shell",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
})
const results = [],
  errors = []
try {
  const page = await browser.newPage({
    viewport: { width: 900, height: 720 },
    deviceScaleFactor: 0.25,
  })
  page.setDefaultTimeout(90000)
  page.on("pageerror", (error) => errors.push(error.message))
  await page.addInitScript(() => {
    const define = Object.defineProperty
    Object.defineProperty = (target, key, descriptor) => {
      if (target === globalThis && key === "wobbleScene" && descriptor.value?.renderer) {
        const renderer = descriptor.value.renderer
        renderer.setPixelRatio(0.25)
        renderer.shadowMap.enabled = false
        const render = renderer.render.bind(renderer)
        globalThis.wobbleQaDraw = render
        let last = -3000
        renderer.render = (...args) => {
          const now = performance.now()
          if (now - last >= 3000) {
            last = now
            render(...args)
          }
        }
        Object.defineProperty = define
      }
      return define(target, key, descriptor)
    }
  })
  await page.goto(base, { waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => !!window.wobble, null, { timeout: 100000 })
  for (const id of ["canopy-switch", "sugar-skyways"]) {
    await page.click(`[data-course="${id}"]`)
    await page.click("#play-solo")
    await page.waitForFunction((expected) => window.wobble.state().courseId === expected, id)
    await page.waitForTimeout(3500)
    const result = await page.evaluate(
      (junctionZ) => {
        const { renderer, scene, camera } = window.wobbleScene
        const decks = []
        const junctions = []
        scene.traverse((object) => {
          if (object.name.startsWith("course-deck:")) decks.push(object)
          if (object.name === "course-junctions") junctions.push(object)
        })
        // Isolate road paint: changing order relative to unrelated objects
        // also changes antialiased silhouettes, which is a different effect.
        const hidden = []
        scene.traverse((object) => {
          if (
            object.isMesh &&
            !object.name.startsWith("course-deck:") &&
            object.name !== "course-junctions"
          ) {
            hidden.push([object, object.visible])
            object.visible = false
          }
        })
        camera.position.set(6, 6, junctionZ - 8)
        camera.lookAt(0, 0, junctionZ)
        camera.updateMatrixWorld()
        const gl = renderer.getContext(),
          width = gl.drawingBufferWidth,
          height = gl.drawingBufferHeight
        const draw = () => {
          window.wobbleQaDraw(scene, camera)
          const pixels = new Uint8Array(width * height * 4)
          gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
          return pixels
        }
        const differences = (a, b) => {
          let count = 0
          for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) count++
          return count
        }
        const orders = decks.map((d) => d.renderOrder),
          layers = decks.map((d) => d.position.y),
          offsets = decks.map((d) => d.material.polygonOffsetUnits)
        const normal = draw()
        decks.forEach((d, i) => {
          d.renderOrder = 100 - i
        })
        const reversed = draw(),
          biasedPixelsChanged = differences(normal, reversed)
        decks.forEach((d, i) => {
          d.material.polygonOffset = false
          d.position.y = 0
          d.renderOrder = orders[i]
        })
        junctions.forEach((j) => {
          j.visible = false
        })
        const unfixed = draw()
        decks.forEach((d, i) => {
          d.renderOrder = 100 - i
        })
        junctions.forEach((j) => {
          j.visible = true
        })
        const unfixedReversed = draw(),
          unbiasedPixelsChanged = differences(unfixed, unfixedReversed)
        decks.forEach((d, i) => {
          d.material.polygonOffset = true
          d.position.y = layers[i]
          d.renderOrder = orders[i]
        })
        const angleSamples = []
        for (const dx of [-1, -0.5, -0.1, 0, 0.1, 0.5, 1]) {
          camera.position.set(6 + dx, 6 + dx * 0.2, junctionZ - 8)
          camera.lookAt(0, 0, junctionZ)
          camera.updateMatrixWorld()
          for (const enabled of [true, false]) {
            junctions.forEach((j) => {
              j.visible = enabled
            })
            decks.forEach((d, i) => {
              d.material.polygonOffset = enabled
              d.position.y = enabled ? layers[i] : 0
            })
            const pixels = draw(),
              i = (Math.floor(height / 2) * width + Math.floor(width / 2)) * 4
            const rgb = [pixels[i], pixels[i + 1], pixels[i + 2]]
            angleSamples.push({ dx, enabled, rgb, hue: rgb[0] > rgb[1] ? "lavender" : "cyan" })
          }
        }
        decks.forEach((d, i) => {
          d.material.polygonOffset = true
          d.position.y = layers[i]
        })
        junctions.forEach((j) => {
          j.visible = true
        })
        for (const [object, visible] of hidden) object.visible = visible
        draw()
        // Use the junction interior; rounded silhouettes have order-dependent
        // multisample coverage even when they do not share a coplanar surface.
        let intersectionMaxDelta = 0,
          intersectionUnbiasedChanges = 0
        for (let y = Math.floor(height / 2) - 4; y < Math.floor(height / 2) + 4; y++)
          for (let x = Math.floor(width / 2) - 4; x < Math.floor(width / 2) + 4; x++)
            for (let channel = 0; channel < 3; channel++) {
              const i = (y * width + x) * 4 + channel
              intersectionMaxDelta = Math.max(
                intersectionMaxDelta,
                Math.abs(normal[i] - reversed[i]),
              )
              if (unfixed[i] !== unfixedReversed[i]) intersectionUnbiasedChanges++
            }
        return {
          decks: decks.length,
          offsets,
          layers,
          depthBits: gl.getParameter(gl.DEPTH_BITS),
          depthEnabled: gl.isEnabled(gl.DEPTH_TEST),
          biasedPixelsChanged,
          maxBiasedDelta: normal.reduce(
            (max, value, index) => Math.max(max, Math.abs(value - reversed[index])),
            0,
          ),
          unbiasedPixelsChanged,
          intersectionMaxDelta,
          intersectionUnbiasedChanges,
          angleSamples,
          fixedColorSpread: Math.max(
            ...[0, 1, 2].map((channel) => {
              const values = angleSamples.filter((s) => s.enabled).map((s) => s.rgb[channel])
              return Math.max(...values) - Math.min(...values)
            }),
          ),
          unfixedColorSpread: Math.max(
            ...[0, 1, 2].map((channel) => {
              const values = angleSamples.filter((s) => !s.enabled).map((s) => s.rgb[channel])
              return Math.max(...values) - Math.min(...values)
            }),
          ),
          nonzeroPixels: normal.reduce((count, value) => count + (value !== 0 ? 1 : 0), 0),
        }
      },
      id === "canopy-switch" ? 32 : 89,
    )
    assert(result.decks > 1)
    assert(result.nonzeroPixels > 1000, "actual rendered pixels were sampled")
    assert.equal(new Set(result.offsets).size, result.decks)
    console.log("INTERSECTION_RENDER_SAMPLE", id, JSON.stringify(result))
    assert.equal(
      result.biasedPixelsChanged,
      0,
      "crossing colour stays stable when draw order reverses",
    )
    assert(
      result.unbiasedPixelsChanged > 0,
      "disabling the fix reproduces competing intersection colours",
    )
    assert(
      result.fixedColorSpread <= 20,
      "intersection colour remains stable apart from normal view-dependent lighting",
    )
    assert(
      result.unfixedColorSpread > result.fixedColorSpread + 8,
      "removing junction paint reproduces visible colour switching",
    )
    results.push({ id, ...result })
    console.log("INTERSECTION_RENDER_PASS", id, JSON.stringify(result))
    await page.screenshot({ path: `${out}/${id}-intersection.png` })
    await page.click("#race-menu")
  }
  assert.deepEqual(errors, [])
  await writeFile(`${out}/summary.json`, JSON.stringify({ base, results, errors }, null, 2))
} finally {
  await browser.close()
}
