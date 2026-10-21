/** Real WebGL preset/resource smoke; SwiftShader timings are deliberately not FPS evidence. */
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { once } from "node:events"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { createServer } from "node:http"
import { chromium } from "@playwright/test"

await mkdir(".run", { recursive: true })
await mkdir(".run/graphics", { recursive: true })
await writeFile(
  ".run/graphics-probe.ts",
  `
import {createSceneKit} from '../src/client/scene-kit';
import {CourseView} from '../src/client/course-view';
import {playableCourse} from '../src/shared/course-catalog';
const kit=createSceneKit(document.querySelector('canvas'), 'low');
const course=playableCourse('sunrise-scramble');
const view=new CourseView(course); kit.scene.add(view.group); view.update(5,false);
kit.camera.position.set(0,7,-12);kit.camera.lookAt(0,0,12);
window.probe={draw(quality){kit.setGraphicsQuality(quality);kit.resize();kit.render();
const gl=kit.renderer.getContext();
return {quality:kit.graphicsQuality,pixelRatio:kit.renderer.getPixelRatio(),width:gl.drawingBufferWidth,height:gl.drawingBufferHeight,
shadows:kit.renderer.shadowMap.enabled,shadowSize:kit.sun.shadow.map?.width??0,
textures:kit.renderer.info.memory.textures,geometries:kit.renderer.info.memory.geometries,calls:kit.renderer.info.render.calls,glError:gl.getError()};},dispose(){view.dispose();kit.dispose();}};
`,
)
execFileSync(
  process.env.WOBBLE_BUN ?? "bun",
  ["build", ".run/graphics-probe.ts", "--target=browser", "--outfile=.run/graphics-probe.js"],
  { stdio: "ignore" },
)
const bundle = await readFile(".run/graphics-probe.js")
const server = createServer((request, response) => {
  response.setHeader("Content-Type", request.url === "/probe.js" ? "text/javascript" : "text/html")
  response.end(
    request.url === "/probe.js"
      ? bundle
      : '<!doctype html><html><body style="margin:0"><canvas></canvas><script type="module" src="/probe.js"></script></body></html>',
  )
})
server.listen(0, "127.0.0.1")
await once(server, "listening")
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
try {
  browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
  })
  const page = await browser.newPage({
    viewport: { width: 480, height: 270 },
    deviceScaleFactor: 2,
  })
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto(`http://127.0.0.1:${(server.address() as { port: number }).port}`)
  await page.waitForFunction(() => "probe" in window, null, { timeout: 60_000 })
  const draw = (quality: string) =>
    page.evaluate(
      (quality) =>
        (
          window as unknown as {
            probe: {
              draw(q: string): {
                quality: string
                pixelRatio: number
                width: number
                height: number
                shadows: boolean
                shadowSize: number
                textures: number
                geometries: number
                calls: number
                glError: number
              }
            }
          }
        ).probe.draw(quality),
      quality,
    )
  const low = await draw("low"),
    high = await draw("high"),
    balanced = await draw("balanced")
  assert.equal(low.width, 480)
  assert.equal(low.shadows, false)
  assert.equal(low.shadowSize, 0)
  assert.equal(balanced.width, 600)
  assert.equal(balanced.shadowSize, 1024)
  assert.equal(high.width, 960)
  assert.equal(high.shadowSize, 2048)
  for (let cycle = 0; cycle < 3; cycle++) {
    const nextLow = await draw("low"),
      nextHigh = await draw("high")
    assert.equal(nextLow.textures, low.textures, "shadow targets released on low")
    assert.equal(nextHigh.textures, high.textures, "shadow targets do not accumulate")
    assert.equal(nextHigh.geometries, high.geometries)
    assert.ok(nextHigh.calls > 0)
    assert.equal(nextHigh.glError, 0)
  }
  await page.setViewportSize({ width: 640, height: 360 })
  const resized = await draw("balanced")
  assert.equal(resized.width, 800)
  assert.equal(resized.height, 450)
  assert.equal(resized.shadowSize, 1024)
  await page.screenshot({ path: ".run/graphics/graphics-balanced.png" })
  await page.evaluate(() => (window as unknown as { probe: { dispose(): void } }).probe.dispose())
  assert.deepEqual(errors, [])
  const report = {
    realWebGL: true,
    softwareRenderer: true,
    physicalFpsCertified: false,
    course: "sunrise-scramble",
    low,
    balanced,
    high,
    resized,
    repeatSwitches: "PASS",
    browserErrors: errors,
  }
  await writeFile(".run/graphics/graphics-smoke.json", JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} finally {
  await browser?.close()
  await new Promise<void>((done) => server.close(() => done()))
}
