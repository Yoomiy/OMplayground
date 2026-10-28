import assert from "node:assert/strict";
import { test } from "node:test";
import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { schoolFixture } from "./helpers/school-fixture.ts";
import { SupabaseControls, schoolControl } from "../src/school-control.ts";
import { createSupabaseServerClient } from "../src/supabase-persistence.ts";
import type { RoomControl } from "../../../games/voxel/src/server/control.ts";
function fixture() {
  const f = schoolFixture(),
    calls: string[] = [],
    id = randomUUID(),
    state = { old: null as unknown };
  const accepted = {
    action: "pause",
    completed: false,
    savedSequence: null,
    revision: 1,
    current: true,
  };
  const store = new SupabaseControls(
    createSupabaseServerClient(
      {
        SUPABASE_URL: "https://control.invalid",
        SUPABASE_SECRET_KEY: "sb_secret_fixture",
      },
      async (input, init) => {
        const r = new Request(input, init),
          name = new URL(r.url).pathname.split("/").at(-1)!;
        calls.push(name);
        assert.equal(r.headers.has("Authorization"), false);
        const data =
          name === "voxel_control_receipt"
            ? state.old
            : name === "voxel_begin_control"
              ? accepted
              : { ...accepted, completed: true, savedSequence: 3 };
        return new Response(JSON.stringify(data), {
          headers: { "Content-Type": "application/json" },
        });
      },
    ),
  );
  let status = 0,
    value: unknown = null;
  const responseState = {
    writableEnded: false,
    writeHead(code: number) {
      status = code;
    },
    end(raw: string) {
      value = JSON.parse(raw);
      responseState.writableEnded = true;
    },
  };
  const response = responseState as unknown as ServerResponse;
  const request = {
    headers: { authorization: "Bearer " + f.token(f.teacher) },
  } as unknown as IncomingMessage;
  const input = { room: f.room, requestId: id, action: "pause" },
    policy = schoolControl(f.access, store);
  const context: RoomControl = {
    lease: {
      room: f.room,
      worldId: randomUUID(),
      owner: randomUUID(),
      epoch: 1,
      sequence: 0,
      validForMs: 30000,
      checkpoint: null,
    },
    staff: async () => assert.fail("unexpected staff action"),
    savePaused: async () => {
      throw new Error("injected unavailable storage");
    },
    resume: () => assert.fail("unexpected resume"),
    end: () => assert.fail("unexpected end"),
  };
  return {
    f,
    calls,
    state,
    response,
    request,
    input,
    policy,
    context,
    get status() {
      return status;
    },
    get value() {
      return value;
    },
  };
}
test("control rejects extra intent fields before identity or allocation", async () => {
  const h = fixture();
  assert.equal(
    await h.policy(h.request, { ...h.input, ownerEpoch: 99 }, h.response),
    null,
  );
  assert.equal(h.status, 400);
  assert.equal(h.f.requests.length, 0);
  assert.equal(h.calls.length, 0);
});
test("queued control repeats fresh authority and a revoked teacher cannot execute its earlier grant", async () => {
  const h = fixture(),
    grant = await h.policy(h.request, h.input, h.response);
  assert.ok(grant);
  h.f.profiles.get(h.f.teacher)!.is_active = false;
  await grant.execute(h.context);
  assert.equal(h.status, 403);
  assert.deepEqual(h.calls, ["voxel_control_receipt"]);
});
test("pause save failure has no completion receipt and a prior committed receipt replays without reading the ended session", async () => {
  const h = fixture(),
    grant = await h.policy(h.request, h.input, h.response);
  assert.ok(grant);
  await grant.execute(h.context);
  assert.equal(h.status, 503);
  assert.deepEqual(h.value, { error: "CONTROL_UNAVAILABLE", saved: false });
  assert.equal(h.calls.includes("voxel_finish_control"), false);
  const replay = fixture();
  replay.state.old = {
    action: "pause",
    completed: true,
    savedSequence: 17,
    revision: 1,
    current: false,
  };
  replay.f.state.session.status = "completed";
  assert.equal(
    await replay.policy(replay.request, replay.input, replay.response),
    null,
  );
  assert.equal(replay.status, 200);
  assert.equal((replay.value as { saved: boolean }).saved, true);
  assert.equal(
    replay.f.requests.some((r) => r.path === "game_sessions"),
    false,
  );
});
