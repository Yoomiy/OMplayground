/** Render-only posed inspection. Gameplay reachability is tested separately. */
import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { chromium } from "@playwright/test"
import { getCourse } from "../../src/shared/course-catalog"
import { gateBoxAt, moverBoxAt } from "../../src/shared/obstacles"

const base = process.env.LAB_URL ?? "http://127.0.0.1:19003"
const out = process.env.LAB_EVIDENCE ?? "evidence/docks-render"
await mkdir(out, { recursive: true })
const browser = await chromium.launch({
  executablePath:
    "/home/ubuntu/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux-arm64/chrome-headless-shell",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
})
const errors = [],
  frames = []
const views = [
  { id: "lift-lock", camera: [-10, 8, 8], focus: [0, 2, 15] },
  { id: "harbor-hoppers", camera: [-24, 8, 85], focus: [-12, 1.5, 94] },
  { id: "sky-transfer", camera: [-23, 12, 58], focus: [-4, 0, 72] },
  { id: "pendulum-pier", camera: [11, 7, 85], focus: [0, 1, 95] },
  { id: "shutter-shuttle", camera: [10, 6, 11], focus: [0, 1, 20] },
  { id: "clockwork-crossing", camera: [10, 7, 78], focus: [0, 0, 85] },
  { id: "spiral-summit", camera: [-14, 12, 45], focus: [4, 2, 42.4] },
].filter((view) => !process.env.LAB_COURSES || process.env.LAB_COURSES.split(",").includes(view.id))
try {
  const page = await browser.newPage({
    viewport: { width: 1000, height: 720 },
    deviceScaleFactor: 0.5,
  })
  page.setDefaultTimeout(90_000)
  page.on("pageerror", (error) => errors.push(error.message))
  await page.addInitScript(() => {
    const define = Object.defineProperty
    Object.defineProperty = (target, key, descriptor) => {
      if (target === globalThis && key === "wobbleScene" && descriptor.value?.renderer) {
        const renderer = descriptor.value.renderer
        renderer.setPixelRatio(0.35)
        renderer.shadowMap.enabled = false
        const draw = renderer.render.bind(renderer)
        let last = -3000
        renderer.render = (...args) => {
          if (performance.now() - last < 3000) return
          last = performance.now()
          const posed = globalThis.wobbleDockView
          if (posed) {
            const camera = args[1],
              scene = args[0]
            camera.position.set(...posed.camera)
            camera.lookAt(...posed.focus)
            camera.updateMatrixWorld()
            for (const item of posed.items) {
              const mesh = scene.getObjectByName(item.name)
              if (mesh) mesh.position.set(item.position.x, item.position.y, item.position.z)
            }
          }
          draw(...args)
        }
        Object.defineProperty = define
      }
      return define(target, key, descriptor)
    }
  })
  await page.goto(base, { waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => !!window.wobble)
  await page.addStyleTag({
    content: ".screen,.hud,.countdown,.controls-hint,.race-menu {visibility:hidden !important}",
  })
  // Restore menu visibility just for driving course selection; hide UI for captures.
  for (const view of views) {
    await page.addStyleTag({ content: ".screen {visibility:visible !important}" })
    await page.click(`[data-course="${view.id}"]`)
    await page.click("#play-solo")
    await page.waitForFunction((id) => window.wobble.state().courseId === id, view.id)
    await page.addStyleTag({ content: ".screen {visibility:hidden !important}" })
    const course = getCourse(view.id)
    for (const phase of [0, 0.5, 1]) {
      const items = course.obstacles.flatMap((spec) => {
        if (spec.kind === "mover")
          return [
            {
              name: `mover:${spec.id}`,
              position: moverBoxAt(spec, spec.travelSec * phase - spec.phaseSec).center,
            },
          ]
        if (spec.kind === "gate")
          return [
            {
              name: `gate:${spec.id}`,
              position: gateBoxAt(spec, (phase === 1 ? 1 : spec.openSec + 0.5) - spec.phaseSec)
                .center,
            },
          ]
        return []
      })
      await page.evaluate(
        (data) => {
          globalThis.wobbleDockView = data
        },
        { ...view, items },
      )
      await page.waitForTimeout(3500)
      const count = await page.evaluate(
        (names) => names.filter((name) => !!window.wobbleScene.scene.getObjectByName(name)).length,
        items.map((item) => item.name),
      )
      assert.equal(count, items.length)
      const file = `${view.id}-${phase}.png`
      await page.screenshot({ path: `${out}/${file}` })
      frames.push({ id: view.id, phase, file, items: count })
    }
    await page.evaluate(() => {
      delete globalThis.wobbleDockView
    })
    await page.addStyleTag({ content: ".screen,.race-menu {visibility:visible !important}" })
    await page.click("#race-menu")
    console.log("DOCK_RENDER_PASS", view.id)
  }
  assert.deepEqual(errors, [])
  await writeFile(
    `${out}/summary.json`,
    JSON.stringify(
      {
        base,
        frames,
        errors,
        scope: "render-only endpoint/midpoint inspection; not physics races",
      },
      null,
      2,
    ),
  )
  console.log("DOCK_RENDER_PASS", frames.length, "frames")
} finally {
  await browser.close()
}
