import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "../src/supabase-persistence.ts";
import { SupabaseSessions } from "../src/supabase-sessions.ts";
const lease = {
  room: randomUUID(),
  worldId: randomUUID(),
  owner: randomUUID(),
  epoch: 4,
  sequence: 2,
  checkpoint: null,
  validForMs: 30000,
};
function fixture() {
  let now = 10000;
  const state = {
      value: true as unknown,
      fail: false,
      onRequest: null as (() => void) | null,
    },
    calls: { name: string; args: Record<string, unknown> }[] = [];
  const client = createSupabaseServerClient(
    {
      SUPABASE_URL: "https://projection.invalid",
      SUPABASE_SECRET_KEY: "sb_secret_fixture",
    },
    async (input, init) => {
      const request = new Request(input, init);
      assert.equal(request.headers.has("Authorization"), false);
      calls.push({
        name: new URL(request.url).pathname.split("/").at(-1)!,
        args: (await request.json()) as Record<string, unknown>,
      });
      state.onRequest?.();
      return new Response(
        JSON.stringify(
          state.fail
            ? { code: "42501", message: "private secret-provider-message" }
            : state.value,
        ),
        {
          status: state.fail ? 403 : 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    },
  );
  return {
    state,
    calls,
    sessions: new SupabaseSessions(client, () => now),
    setNow: (n: number) => (now = n),
  };
}
test("session SDK sends fenced identities, deduplicates presence and excludes observers from membership writes", async () => {
  const f = fixture(),
    id = randomUUID();
  await f.sessions.initialize(lease);
  await f.sessions.accept(
    lease,
    {
      id,
      role: "observer",
      capabilities: {
        build: false,
        observe: true,
        combat: false,
        explosives: false,
        fly: true,
      },
    },
    { expiresAt: 14500, membershipRevision: 0 },
  );
  assert.equal(f.calls.length, 1);
  assert.equal(
    await f.sessions.project(lease, 9, {
      state: "playing",
      participants: [id, id],
    }),
    true,
  );
  assert.deepEqual(f.calls[1], {
    name: "voxel_project_session",
    args: {
      p_session: lease.room,
      p_world: lease.worldId,
      p_owner: lease.owner,
      p_epoch: 4,
      p_sequence: 9,
      p_state: "playing",
      p_participants: [id],
    },
  });
  await assert.rejects(
    f.sessions.project(lease, 0, { state: "paused", participants: [] }),
  );
  await assert.rejects(
    f.sessions.project(lease, 10, {
      state: "paused",
      participants: ["forged"],
    }),
  );
  assert.equal(f.calls.length, 2);
});
test("session SDK rejects malformed installation/policy replies and request-start deadlines never extend during IO", async () => {
  const f = fixture();
  f.state.value = { schema: 1, authoritativeWrites: true };
  await f.sessions.verifyInstallation();
  f.state.value = { schema: 1, authoritativeWrites: false };
  await assert.rejects(
    f.sessions.verifyInstallation(),
    /session_installation_protocol/,
  );
  f.state.value = { state: "playing" };
  assert.deepEqual(await f.sessions.roomPolicy(lease.room), {
    state: "playing",
    expiresAt: 15000,
  });
  f.state.value = { state: "playing", trusted: true };
  await assert.rejects(
    f.sessions.roomPolicy(lease.room),
    /session_policy_protocol/,
  );
  f.state.value = { state: "paused" };
  f.state.onRequest = () => f.setNow(15000);
  await assert.rejects(
    f.sessions.roomPolicy(lease.room),
    /session_policy_protocol/,
  );
});
test("session SDK treats explicit fencing as false and provider failures expose only a machine code", async () => {
  const f = fixture();
  f.state.value = false;
  assert.equal(
    await f.sessions.project(lease, 1, { state: "paused", participants: [] }),
    false,
  );
  await assert.rejects(f.sessions.initialize(lease), /session_initialize/);
  f.state.fail = true;
  await assert.rejects(f.sessions.roomPolicy(lease.room), (error: Error) => {
    assert.match(error.message, /42501/);
    assert.doesNotMatch(error.message, /private|secret-provider/);
    return true;
  });
});
