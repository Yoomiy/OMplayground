import { expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

test("normal logs contain lifecycle events; correction reports are opt-in debug diagnostics", () => {
  const script = `import { platformLog } from './src/platform/logging.ts';
platformLog('debug', 'WOBBLE_CLIENT_NETWORK', { reason: 'correction' });
platformLog('info', 'WOBBLE_GAME_COMPLETED', { sessionId: 'fixture', saved: true });`
  for (const level of ["info", "debug"]) {
    const result = spawnSync(process.execPath, ["--eval", script], {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      env: { ...process.env, NODE_ENV: "production", LOG_LEVEL: level },
      encoding: "utf8",
    })
    expect(result.status).toBe(0)
    const logs = result.stdout
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
    expect(logs.some((log) => log.context.event === "WOBBLE_GAME_COMPLETED")).toBe(true)
    expect(logs.some((log) => log.context.event === "WOBBLE_CLIENT_NETWORK")).toBe(
      level === "debug",
    )
    expect(logs.every((log) => log.context.status === "success")).toBe(true)
  }
})
