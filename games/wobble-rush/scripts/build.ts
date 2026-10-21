import { createHash } from "node:crypto"
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"

const hash = createHash("sha256")
async function include(path: string): Promise<void> {
  const entries = await readdir(path, { withFileTypes: true }).catch(() => null)
  if (entries)
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, "en")))
      await include(`${path}/${entry.name}`)
  else {
    hash.update(path)
    hash.update(await readFile(path))
  }
}
for (const path of [
  "src",
  "package-lock.json",
  "package.json",
  "scripts/build.ts",
  "../../packages/observability/src/logger.ts",
  "../../packages/observability/src/error.ts",
  "../../packages/observability/src/processLifecycle.ts",
  "../../apps/game-server/src/gameVoiceToken.ts",
  "../../packages/game-logic/src/recessSchedule.ts",
])
  await include(path)
const release = `wobble-app-${hash.digest("hex").slice(0, 16)}`
await rm(".build-stage", { recursive: true, force: true })
await mkdir(".build-stage/client/assets", { recursive: true })
const define = { WOBBLE_BUILD: JSON.stringify(release) }
const client = await Bun.build({
  entrypoints: ["src/client/app-main.ts"],
  outdir: ".build-stage/client/assets",
  target: "browser",
  format: "esm",
  minify: true,
  naming: "main.js",
  sourcemap: "external",
  define,
})
if (!client.success) throw new Error(client.logs.map(String).join("\n"))
const host = await Bun.build({
  entrypoints: ["src/platform/main.ts"],
  outdir: ".build-stage",
  target: "node",
  // Logging must follow the deployed process, rather than the build environment.
  define: { ...define, "process.env.NODE_ENV": "process.env.NODE_ENV" },
  format: "esm",
  naming: "server.mjs",
  sourcemap: "external",
  external: ["ws", "pino", "livekit-server-sdk"],
})
if (!host.success) throw new Error(host.logs.map(String).join("\n"))
const css = await Promise.all(
  ["base", "hud"].map((part) => readFile(`src/client/styles/${part}.css`, "utf8")),
)
await writeFile(".build-stage/client/assets/style.css", css.join("\n"))
await cp("src/client/index.html", ".build-stage/client/index.html")
await cp("LICENSE", ".build-stage/client/LICENSE")
await writeFile(".build-stage/build.json", JSON.stringify({ release, protocol: 7, platform: 1 }))
await rm("dist", { recursive: true, force: true })
await cp(".build-stage", "dist", { recursive: true })
await rm(".build-stage", { recursive: true, force: true })
console.log(
  `Built matching Wobble app client/server: ${release}. Restart the Wobble service to load it.`,
)
