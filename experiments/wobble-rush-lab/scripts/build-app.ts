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
  "bun.lock",
  "package.json",
  "scripts/build-app.ts",
  "../../packages/observability/src/logger.ts",
  "../../packages/observability/src/error.ts",
  "../../packages/observability/src/processLifecycle.ts",
  "../../apps/game-server/src/gameVoiceToken.ts",
  "../../packages/game-logic/src/recessSchedule.ts",
  "../../package-lock.json",
])
  await include(path)
const release = `wobble-app-${hash.digest("hex").slice(0, 16)}`
await rm(".app-stage", { recursive: true, force: true })
await mkdir(".app-stage/client/assets", { recursive: true })
const define = { WOBBLE_BUILD: JSON.stringify(release) }
const client = await Bun.build({
  entrypoints: ["src/client/app-main.ts"],
  outdir: ".app-stage/client/assets",
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
  outdir: ".app-stage",
  target: "node",
  format: "esm",
  naming: "server.mjs",
  sourcemap: "external",
  define,
  external: ["ws", "pino", "livekit-server-sdk"],
})
if (!host.success) throw new Error(host.logs.map(String).join("\n"))
const css = await Promise.all(
  ["base", "lobby", "hud", "finish", "app"].map((part) =>
    readFile(`src/client/styles/${part}.css`, "utf8"),
  ),
)
await writeFile(".app-stage/client/assets/style.css", css.join("\n"))
await cp("src/client/index.html", ".app-stage/client/index.html")
await cp("LICENSE", ".app-stage/client/LICENSE")
await writeFile(".app-stage/build.json", JSON.stringify({ release, protocol: 7, platform: 1 }))
await rm("app-dist", { recursive: true, force: true })
await cp(".app-stage", "app-dist", { recursive: true })
await rm(".app-stage", { recursive: true, force: true })
console.log(
  `Built matching Wobble app client/server: ${release}. Restart the Wobble service to load it.`,
)
