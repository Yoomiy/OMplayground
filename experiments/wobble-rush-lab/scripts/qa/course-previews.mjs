import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { chromium } from "@playwright/test"

const base = process.env.LAB_URL || "http://127.0.0.1:19003"
const out = process.env.LAB_EVIDENCE || "evidence/routes-previews"
await mkdir(out, { recursive: true })
const browser = await chromium.launch({
  executablePath:
    "/home/ubuntu/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux-arm64/chrome-headless-shell",
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
})
const errors = [],
  previewed = []
try {
  const page = await browser.newPage({
    viewport: { width: 900, height: 720 },
    deviceScaleFactor: 0.25,
  })
  page.on("pageerror", (error) => errors.push(error.message))
  await page.addInitScript((overview) => {
    const define = Object.defineProperty
    Object.defineProperty = (target, key, descriptor) => {
      if (target === globalThis && key === "wobbleScene" && descriptor.value?.renderer) {
        const renderer = descriptor.value.renderer
        renderer.setPixelRatio(0.25)
        renderer.shadowMap.enabled = false
        const render = renderer.render.bind(renderer)
        let lastDraw = -3000
        renderer.render = (...args) => {
          const now = performance.now()
          if (now - lastDraw < 3000) return
          lastDraw = now
          if (overview) {
            const camera = args[1]
            camera.position.set(22, 145, 58)
            camera.lookAt(0, 0, 64)
            camera.updateMatrixWorld()
          }
          render(...args)
        }
        Object.defineProperty = define
      }
      return define(target, key, descriptor)
    }
  }, process.env.LAB_LAYOUT === "overview")
  await page.goto(base, { waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => !!window.wobble, null, { timeout: 100000 })
  const ids = await page
    .locator(".course-card")
    .evaluateAll((cards) => cards.map((card) => card.dataset.course))
  assert.equal(ids.length, 23)
  await page.screenshot({ path: `${out}/menu.png`, timeout: 90000 })
  const selection = process.env.LAB_COURSES?.split(",")
  for (const id of ids.filter((id) => selection === undefined || selection.includes(id))) {
    await page.click(`[data-course="${id}"]`, { timeout: 90000 })
    await page.click("#play-solo", { timeout: 90000 })
    await page.waitForFunction((expected) => window.wobble.state().courseId === expected, id)
    await page.waitForTimeout(3500)
    const triangles = await page.evaluate(() => window.wobbleScene.renderer.info.render.triangles)
    assert(triangles > 0, `${id} renders geometry`)
    await page.screenshot({ path: `${out}/${id}.png`, timeout: 90000 })
    assert.equal(await page.locator("#boot-error").count(), 0)
    previewed.push({ id, triangles })
    console.log("COURSE_RENDER_PASS", id, triangles)
    await page.click("#race-menu", { timeout: 90000 })
    await page.waitForSelector('[data-screen="start"]:not([hidden])')
  }
  assert.deepEqual(errors, [])
  await writeFile(`${out}/summary.json`, JSON.stringify({ base, previewed, errors }, null, 2))
  console.log(`COURSES_RENDER_PASS ${previewed.length}/${ids.length}`)
} finally {
  await browser.close()
}
