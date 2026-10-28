import assert from "node:assert/strict";
import { loadServerRelease } from "../src/release.ts";
import { test } from "node:test";
import { schoolOperationsApi } from "../src/school-operations.ts";
import { schoolFixture } from "./helpers/school-fixture.ts";

test("operations require fresh admin identity and expose only a read-only snapshot", async () => {
  const f = schoolFixture();
  f.setNow(Date.now());
  let reads = 0;
  const snapshot = {
    service: "voxel-server" as const,
    activeConnections: 3,
    activeRoomsCount: 1,
    mediaConnections: 2,
    rooms: [
      { sessionId: f.room, gameType: "voxel" as const, connectionCount: 2 },
    ],
  };
  const runtime = await loadServerRelease();
  const gateway = await runtime.createGateway({
    build: runtime.build,
    content: runtime.content,
    allowedOrigins: ["https://school.example"],
    admit: async () => {
      throw new Error("operations must not admit players");
    },
    api: schoolOperationsApi(f.access, () => {
      reads++;
      return snapshot;
    }),
  });
  try {
    const address = gateway.address;
    assert.ok(address && typeof address === "object");
    const url = `http://127.0.0.1:${address.port}/api/voxel/admin-stats`;
    assert.equal((await fetch(url)).status, 404);
    const preflight = await fetch(url, {
      method: "OPTIONS",
      headers: {
        Origin: "https://school.example",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,content-type",
      },
    });
    assert.equal(preflight.status, 204);
    assert.equal(
      preflight.headers.get("Access-Control-Allow-Origin"),
      "https://school.example",
    );
    assert.equal(
      (
        await fetch(url, {
          method: "POST",
          headers: {
            Origin: "https://outsider.example",
            "Content-Type": "application/json",
          },
          body: "{}",
        })
      ).status,
      403,
    );
    const request = (token?: string, body: unknown = {}) =>
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://school.example",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
    assert.equal((await request()).status, 401);
    for (const id of [f.kid, f.teacher])
      assert.equal((await request(f.token(id))).status, 403);
    assert.equal(reads, 0);
    const adminToken = f.token(f.admin);
    const response = await request(adminToken);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await response.json(), snapshot);
    assert.equal(reads, 1);
    f.admins.delete(f.admin);
    assert.equal((await request(adminToken)).status, 403);
    assert.equal(reads, 1);
    f.admins.add(f.admin);
    f.state.outage = "admin_profiles";
    const unavailable = await request(adminToken);
    assert.equal(unavailable.status, 503);
    assert.deepEqual(await unavailable.json(), { error: "STATS_UNAVAILABLE" });
    f.state.outage = "";
    for (const invalid of [[], null, { room: f.room }])
      assert.equal((await request(adminToken, invalid)).status, 400);
    assert.equal(reads, 1);
    assert.ok(
      f.requests.every((r) =>
        ["user", "kid_profiles", "admin_profiles"].includes(r.path),
      ),
    );
    assert.equal(gateway.rooms.size, 0);
    assert.equal(gateway.sockets.clients.size, 0);
  } finally {
    await gateway.close();
  }
});
