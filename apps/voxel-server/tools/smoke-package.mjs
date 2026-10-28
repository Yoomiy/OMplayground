import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createServer as createProbe } from "node:net";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import { resolve, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";

/** All providers are local fixtures. No school credentials or real SFU are used. */
export async function smokePackage(root) {
  const schemas = {
    voxel_persistence_status: { schema: 1, privateBucket: true },
    voxel_session_projection_status: { schema: 1, authoritativeWrites: true },
    voxel_controls_status: { schema: 1 },
    voxel_roster_status: { schema: 1, revisionFencing: true },
    voxel_staff_status: { schema: 1, epochFencing: true },
    voxel_moderation_status: { schema: 1, revisionFencing: true },
    voxel_chat_status: { schema: 1, persistedModeration: true },
    voxel_media_status: { schema: 1, revisionFencing: true },
  };
  const requests = [],
    denied = [];
  const fixture = createServer((req, res) => {
    const name = req.url?.replace("/rest/v1/rpc/", "");
    if (req.method !== "POST" || !Object.hasOwn(schemas, name)) {
      denied.push({ method: req.method, path: req.url });
      res.writeHead(403);
      res.end("{}");
      return;
    }
    requests.push(name);
    req.resume();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(schemas[name]));
  });
  let child,
    output = "",
    exit,
    stopTimer;
  try {
    await new Promise((yes, no) => {
      fixture.once("error", no);
      fixture.listen(0, "127.0.0.1", yes);
    });
    const probe = createProbe();
    await new Promise((yes, no) => {
      probe.once("error", no);
      probe.listen(0, "127.0.0.1", yes);
    });
    const port = probe.address().port;
    await new Promise((yes) => probe.close(yes));
    child = spawn(process.execPath, ["apps/voxel-server/src/index.ts"], {
      cwd: root,
      env: {
        PATH: process.env.PATH,
        NODE_ENV: "production",
        PORT: String(port),
        VOXEL_HOST: "127.0.0.1",
        VOXEL_ALLOWED_ORIGINS: "https://school.invalid",
        SUPABASE_URL: `http://127.0.0.1:${fixture.address().port}`,
        SUPABASE_SECRET_KEY: "sb_secret_package_fixture",
        LIVEKIT_URL: "wss://media.invalid",
        LIVEKIT_API_KEY: "package_fixture",
        LIVEKIT_API_SECRET: "package_fixture_secret_at_least_32_characters",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (data) => {
      output += data;
    });
    child.stderr.on("data", (data) => {
      output += data;
    });
    exit = once(child, "exit");
    const origin = `http://127.0.0.1:${port}`;
    const deadline = Date.now() + 15000;
    let ready = false;
    while (
      Date.now() < deadline &&
      child.exitCode === null &&
      !child.signalCode
    ) {
      try {
        const response = await fetch(origin + "/ready", {
          signal: AbortSignal.timeout(500),
        });
        ready =
          response.status === 200 && (await response.json()).ready === true;
      } catch {}
      if (ready) break;
      await delay(50);
    }
    assert(
      ready,
      "Packaged service did not become ready: " + output.slice(-4000),
    );
    assert.equal((await fetch(origin + "/health")).status, 200);
    assert.equal((await fetch(origin + "/")).status, 404);
    assert.equal(
      (await fetch(origin + "/voxel-media/rtc/v1/validate?ticket=invalid"))
        .status,
      401,
    );
    const admin = await fetch(origin + "/api/voxel/admin-stats", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://school.invalid",
      },
      body: "{}",
    });
    assert.equal(admin.status, 401);
    assert.equal(
      admin.headers.get("Access-Control-Allow-Origin"),
      "https://school.invalid",
    );
    const health = spawn(process.execPath, ["healthcheck.mjs"], {
      cwd: root,
      env: { PATH: process.env.PATH, PORT: String(port) },
      stdio: "pipe",
    });
    assert.deepEqual(await once(health, "exit"), [0, null]);
    assert.deepEqual(requests.sort(), Object.keys(schemas).sort());
    assert.deepEqual(denied, []);
    child.kill("SIGTERM");
    stopTimer = setTimeout(() => child.kill("SIGKILL"), 10000);
    assert.deepEqual(
      await exit,
      [0, null],
      "Packaged process must drain on SIGTERM",
    );
    clearTimeout(stopTimer);
    assert.match(output, /SERVICE_SHUTDOWN_COMPLETED/);
    assert.doesNotMatch(output, /sb_secret_|package_fixture_secret/);
    assert.throws(
      () => process.kill(child.pid, 0),
      (error) => error.code === "ESRCH",
    );
    const build = JSON.parse(
      await readFile(join(root, "runtime-package.json"), "utf8"),
    );
    return {
      result: "PASS",
      buildId: build.buildId,
      schemaChecks: requests.length,
      health: 200,
      ready: 200,
      prototype: 404,
      unauthorizedAdmin: 401,
      voiceWorkerStarted: true,
      gracefulExit: 0,
      provider: "local HTTP fixture",
      hosted: false,
      sfuQualified: false,
      container: process.argv[1] === "-",
      uid: process.getuid?.() ?? null,
    };
  } finally {
    clearTimeout(stopTimer);
    if (child && child.exitCode === null && !child.signalCode) {
      child.kill("SIGKILL");
      await exit;
    }
    fixture.closeAllConnections();
    await new Promise((yes) => fixture.close(yes));
  }
}

if (
  process.argv[1] === "-" ||
  (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
) {
  if (process.argv[2] === "--container") {
    const image = process.argv[3];
    assert(
      image && !image.startsWith("-"),
      "Provide the locally built image name",
    );
    const docker = spawn(
      "docker",
      [
        "run",
        "--rm",
        "--read-only",
        "--tmpfs",
        "/tmp:rw,noexec,nosuid,size=16m",
        "-i",
        "--entrypoint",
        "node",
        image,
        "--input-type=module",
        "-",
        "/app",
      ],
      { stdio: ["pipe", "inherit", "inherit"] },
    );
    docker.stdin.end(await readFile(new URL(import.meta.url)));
    const [code, signal] = await once(docker, "exit");
    assert.equal(signal, null);
    process.exitCode = code ?? 1;
  } else {
    const root = resolve(process.argv[2] || "apps/voxel-server/dist/runtime");
    console.log(JSON.stringify(await smokePackage(root), null, 2));
  }
}
