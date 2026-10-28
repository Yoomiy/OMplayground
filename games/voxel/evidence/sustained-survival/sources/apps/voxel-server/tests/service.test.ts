import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, cp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadServerRelease } from "../src/release.ts";
import { serviceConfig, startVoxelService } from "../src/service.ts";
const logger = { info: () => {}, error: () => {} };
test("production listener rejects wildcard, path, insecure and credential origins and requires a concrete port", () => {
  assert.deepEqual(
    serviceConfig({
      NODE_ENV: "production",
      PORT: "3001",
      VOXEL_ALLOWED_ORIGINS: "https://school.example",
    }),
    { port: 3001, host: "0.0.0.0", origins: ["https://school.example"] },
  );
  for (const origin of [
    "*",
    "http://school.example",
    "https://school.example/path",
    "https://u:p@school.example",
    "https://school.example,",
  ])
    assert.throws(() =>
      serviceConfig({ NODE_ENV: "production", VOXEL_ALLOWED_ORIGINS: origin }),
    );
  assert.throws(() =>
    serviceConfig({
      NODE_ENV: "production",
      VOXEL_ALLOWED_ORIGINS: "https://school.example",
      PORT: "0",
    }),
  );
});
test("release inventory corruption is rejected before importing executable gateway code", async () => {
  const runtime = await loadServerRelease();
  assert.equal(typeof runtime.createGateway, "function");
  const dir = await mkdtemp(join(tmpdir(), "voxel-service-release-")),
    root = pathToFileURL(dir + "/");
  try {
    await cp(
      new URL("../../../games/voxel/artifacts/", import.meta.url),
      new URL("artifacts/", root),
      { recursive: true },
    );
    await cp(
      new URL("../../../games/voxel/dist-server/", import.meta.url),
      new URL("dist-server/", root),
      { recursive: true },
    );
    await writeFile(
      new URL("dist-server/gateway.js", root),
      "globalThis.voxelUnverifiedCodeExecuted=true;",
    );
    await assert.rejects(loadServerRelease(root), /release mismatch/);
    assert.equal((globalThis as any).voxelUnverifiedCodeExecuted, undefined);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("startup verifies every schema and fails before listening when controls are absent", async () => {
  const names: string[] = [];
  await assert.rejects(
    startVoxelService({
      env: {
        NODE_ENV: "test",
        PORT: "0",
        VOXEL_HOST: "127.0.0.1",
        VOXEL_ALLOWED_ORIGINS: "https://school.example",
        SUPABASE_URL: "https://service-fixture.invalid",
        SUPABASE_SECRET_KEY: "sb_secret_fixture",
      },
      logger,
      request: async (input, init) => {
        const name = new URL(new Request(input, init).url).pathname
          .split("/")
          .at(-1)!;
        names.push(name);
        const data =
          name === "voxel_persistence_status"
            ? { schema: 1, privateBucket: true }
            : name === "voxel_session_projection_status"
              ? { schema: 1, authoritativeWrites: true }
              : name === "voxel_staff_status"
                ? { schema: 1, epochFencing: true }
                : name === "voxel_chat_status"
                  ? { schema: 1, persistedModeration: true }
                  : [
                        "voxel_roster_status",
                        "voxel_moderation_status",
                        "voxel_media_status",
                      ].includes(name)
                    ? { schema: 1, revisionFencing: true }
                    : { code: "PGRST202", message: "private provider message" };
        return new Response(JSON.stringify(data), {
          status: name === "voxel_controls_status" ? 404 : 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    }),
    /PGRST202/,
  );
  assert.deepEqual(
    names.sort(),
    [
      "voxel_controls_status",
      "voxel_persistence_status",
      "voxel_session_projection_status",
      "voxel_roster_status",
      "voxel_staff_status",
      "voxel_moderation_status",
      "voxel_chat_status",
      "voxel_media_status",
    ].sort(),
  );
});
