import assert from "node:assert/strict";
import { test } from "node:test";
import { schoolFixture } from "./helpers/school-fixture.ts";
import { AccessDenied } from "../src/school-access.ts";
test("read-only session inspection follows live school scope and allows completed roster/staff without granting admission", async () => {
  const f = schoolFixture();
  assert.ok(
    (await f.access.inspect(f.token(f.teacher), { room: f.room })).expiresAt >
      f.now,
  );
  f.state.session.status = "completed";
  await f.access.inspect(f.token(), { room: f.room });
  await f.access.inspect(f.token(f.teacher), { room: f.room });
  await f.access.inspect(f.token(f.admin), { room: f.room });
  await assert.rejects(
    f.access.inspect(f.token(f.guest), { room: f.room }),
    (e: unknown) => e instanceof AccessDenied && e.code === "FORBIDDEN",
  );
  await assert.rejects(
    f.access.grant(f.token(), { room: f.room }),
    (e: unknown) => e instanceof AccessDenied && e.code === "SESSION_ENDED",
  );
  f.profiles.get(f.teacher)!.is_active = false;
  await assert.rejects(f.access.inspect(f.token(f.teacher), { room: f.room }));
});
