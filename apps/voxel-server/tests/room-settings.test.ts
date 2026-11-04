import assert from "node:assert/strict";
import { test } from "node:test";
import { schoolSessionApi } from "../src/school-session.ts";
import type { SchoolAccess } from "../src/school-access.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
const room = "11111111-1111-1111-1111-111111111111";
function fixture(host = "host", completed = false) {
  const state = { is_open: true, invitation_code: "secret" };
  const filters: Record<string, unknown> = {};
  let patch: { is_open: boolean } | undefined;
  const query = {
    select() {
      return query;
    },
    update(value: typeof patch) {
      patch = value;
      return query;
    },
    eq(k: string, v: unknown) {
      filters[k] = v;
      return query;
    },
    neq(k: string, v: unknown) {
      filters[`not_${k}`] = v;
      return query;
    },
    maybeSingle() {
      return query;
    },
    async retry() {
      if (filters.host_id !== host || (patch && completed))
        return { data: null, error: null };
      if (patch) Object.assign(state, patch);
      return { data: state, error: null };
    },
  };
  const access = {
    identity: async () => ({ subject: { id: "host" } }),
    inspect: async () => ({ expiresAt: Date.now() + 5000 }),
  } as unknown as SchoolAccess;
  const api = schoolSessionApi(
    access,
    { from: () => query } as unknown as SupabaseClient,
    () => {},
  );
  return {
    state,
    filters,
    async call(body: unknown, token = "Bearer token") {
      let status = 200,
        error = "";
      const result = await api["/api/voxel/room-settings"](
        { headers: { authorization: token } } as never,
        body,
        {
          writeHead(code: number) {
            status = code;
          },
          end(value: string) {
            error = JSON.parse(value).error;
          },
        } as never,
        {} as never,
      );
      return { result, status, error };
    },
  };
}
test("host reads and updates privacy without rotating the invitation", async () => {
  const f = fixture();
  assert.deepEqual((await f.call({ room })).result, {
    isOpen: true,
    invitationCode: "secret",
  });
  assert.deepEqual((await f.call({ room, isOpen: false })).result, {
    isOpen: false,
    invitationCode: "secret",
  });
  assert.equal(f.filters.not_status, "completed");
});
test("nonhosts cannot read invitation secrets or change privacy", async () => {
  for (const body of [{ room }, { room, isOpen: false }])
    assert.equal((await fixture("other").call(body)).status, 403);
});
test("completed sessions reject updates; malformed and unauthenticated requests fail", async () => {
  assert.equal(
    (await fixture("host", true).call({ room, isOpen: false })).status,
    403,
  );
  assert.equal((await fixture().call({ room, isOpen: "false" })).status, 400);
  assert.equal((await fixture().call({ room, unexpected: true })).status, 400);
  assert.equal((await fixture().call({ room }, "")).status, 401);
});
