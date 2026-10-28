import assert from "node:assert/strict";
import { test, after } from "node:test";
import { PostgresTestDatabase } from "../helpers/postgres.ts";
import { supabaseWire } from "../helpers/supabase-wire.ts";
import { startVoxelService } from "../../src/service.ts";
const db = new PostgresTestDatabase();
db.installSessionControls();
after(() => db.close());
test("production composition verifies real schemas, serves authenticated APIs without a prototype launcher and drains idempotently", async () => {
  const wire = await supabaseWire(db),
    logs: unknown[] = [];
  const service = await startVoxelService({
    env: {
      NODE_ENV: "test",
      PORT: "0",
      VOXEL_HOST: "127.0.0.1",
      VOXEL_ALLOWED_ORIGINS: "https://school.example",
      SUPABASE_URL: wire.origin,
      SUPABASE_SECRET_KEY: wire.secret,
      LIVEKIT_URL: "wss://media.invalid",
      LIVEKIT_API_KEY: "media_test",
      LIVEKIT_API_SECRET: "media_test_secret_at_least_32_characters",
    },
    logger: {
      info: (value: unknown) => logs.push(value),
      error: (value: unknown) => logs.push(value),
    },
  });
  try {
    const address = service.gateway.address;
    assert.ok(address && typeof address === "object");
    const origin = `http://127.0.0.1:${address.port}`;
    assert.equal((await fetch(origin + "/health")).status, 200);
    assert.equal((await fetch(origin + "/ready")).status, 200);
    assert.equal((await fetch(origin + "/")).status, 404);
    assert.equal(
      (
        await fetch(
          origin + "/voxel-media/rtc/v1/validate?access_token=invalid",
        )
      ).status,
      401,
    );
    const adminStats = await fetch(origin + "/api/voxel/admin-stats", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://school.example",
      },
      body: "{}",
    });
    assert.equal(adminStats.status, 401);
    assert.deepEqual(await adminStats.json(), { error: "UNAUTHORIZED" });
    assert.equal(
      adminStats.headers.get("Access-Control-Allow-Origin"),
      "https://school.example",
    );
    const r = await fetch(origin + "/api/voxel/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room: "00000000-0000-4000-8000-000000000001",
        requestId: "00000000-0000-4000-8000-000000000002",
        action: "pause",
      }),
    });
    assert.equal(r.status, 401);
    assert.equal(service.gateway.rooms.size, 0);
    const closing = service.close();
    assert.equal(service.close(), closing);
    await closing;
    assert.doesNotMatch(JSON.stringify(logs), /sb_secret_|private provider/);
  } finally {
    await service.close();
    await wire.close();
  }
});
