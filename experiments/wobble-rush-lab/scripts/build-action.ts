const result = await Bun.build({
  entrypoints: ["src/action/main.ts"],
  outdir: "action-dist",
  target: "node",
  format: "esm",
  external: ["ws", "pino"],
  sourcemap: "external",
  naming: "main.mjs",
})
if (!result.success) {
  console.error(result.logs)
  process.exit(1)
}
console.log("built authoritative Node host → action-dist/main.mjs")
