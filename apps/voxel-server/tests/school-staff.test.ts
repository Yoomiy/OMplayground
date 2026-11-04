import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { RoomControl } from "../../../games/voxel/src/server/control.ts";
import { createSupabaseServerClient } from "../src/supabase-persistence.ts";
import { SupabaseStaff, schoolStaff } from "../src/school-staff.ts";
import { schoolFixture } from "./helpers/school-fixture.ts";
function fixture() {
  const f = schoolFixture(),
    id = randomUUID(),
    command = { kind: "mode", mode: "creative" } as const;
  const state = {
    completed: false,
    current: true,
    dispatch: true,
    result: null as unknown,
    installation: true,
  };
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const client = createSupabaseServerClient(
    {
      SUPABASE_URL: "https://staff.invalid",
      SUPABASE_SECRET_KEY: "sb_secret_fixture",
    },
    async (input, init) => {
      const request = new Request(input, init),
        name = new URL(request.url).pathname.split("/").at(-1)!,
        args = await request.json();
      assert.equal(request.headers.has("Authorization"), false);
      calls.push({ name, args });
      const receipt = {
        command,
        revision: 1,
        ownerEpoch: 1,
        completed: state.completed,
        result: state.result,
        current: state.current,
      };
      const data =
        name === "voxel_staff_status"
          ? { schema: 1, epochFencing: state.installation }
          : name === "voxel_staff_receipt"
            ? state.completed
              ? receipt
              : null
            : name === "voxel_begin_staff"
              ? { ...receipt, dispatch: state.dispatch }
              : ((state.completed = true),
                (state.result = args.p_result),
                { ...receipt, completed: true, result: args.p_result });
      return new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" },
      });
    },
  );
  let status = 0,
    value: unknown;
  const response = {
    writeHead(n: number) {
      status = n;
    },
    end(text: string) {
      value = JSON.parse(text);
    },
  } as unknown as ServerResponse;
  const req = {
    headers: { authorization: "Bearer " + f.token(f.teacher) },
  } as unknown as IncomingMessage;
  let applied = 0;
  const context: RoomControl = {
    lease: {
      room: f.room,
      worldId: randomUUID(),
      owner: randomUUID(),
      epoch: 1,
      sequence: 0,
      checkpoint: null,
      validForMs: 30000,
    },
    savePaused: async () => assert.fail("staff action claimed a save"),
    resume: () => assert.fail("unexpected resume"),
    end: () => assert.fail("unexpected end"),
    staff: async (request) => {
      applied++;
      assert.equal(request.actorId, f.teacher);
      assert.deepEqual(request.command, command);
      return { ok: true, reason: "mode" };
    },
  };
  const commands = new SupabaseStaff(client),
    policy = schoolStaff(f.access, commands);
  return {
    f,
    id,
    command,
    state,
    calls,
    commands,
    policy,
    req,
    response,
    context,
    body: { room: f.room, requestId: id, command },
    get status() {
      return status;
    },
    get value() {
      return value;
    },
    get applied() {
      return applied;
    },
  };
}
test("staff policy rechecks queued role authority and never dispatches browser-supplied actors or coordinates", async () => {
  const f = fixture();
  assert.equal(
    await f.policy(f.req, { ...f.body, actor: randomUUID() }, f.response),
    null,
  );
  assert.equal(f.status, 400);
  assert.equal(
    await f.policy(
      f.req,
      {
        ...f.body,
        command: { kind: "teleport", target: f.f.kid, position: [1, 2, 3] },
      },
      f.response,
    ),
    null,
  );
  const grant = await f.policy(f.req, f.body, f.response);
  assert.ok(grant);
  f.f.profiles.get(f.f.teacher)!.role = "kid";
  f.f.profiles.get(f.f.teacher)!.gender = "boy";
  f.f.profiles.get(f.f.teacher)!.grade = "ג";
  assert.equal(await grant.execute(f.context), null);
  assert.equal(f.status, 403);
  assert.equal(f.applied, 0);
  assert.equal(
    f.calls.some((c) => c.name === "voxel_begin_staff"),
    false,
  );
});
test("staff completion preserves the request identity and reports applied without claiming a checkpoint save", async () => {
  const f = fixture();
  await f.commands.verifyInstallation();
  const grant = await f.policy(f.req, f.body, f.response);
  assert.ok(grant);
  const result = (await grant.execute(f.context)) as Record<string, unknown>;
  assert.equal(result.completed, true);
  assert.equal(result.saved, false);
  assert.equal("dispatch" in result, false);
  assert.equal(f.applied, 1);
  assert.equal(await f.policy(f.req, f.body, f.response), null);
  assert.equal(f.status, 200);
  assert.equal(f.applied, 1);
  assert.equal((f.value as any).requestId, f.id);
  const begin = f.calls.find((c) => c.name === "voxel_begin_staff")!;
  assert.equal(begin.args.p_actor, f.f.teacher);
  assert.equal(begin.args.p_request, f.id);
  assert.equal("p_saved" in begin.args, false);
});
test("unknown dispatch in another owner epoch stays unconfirmed and malformed installation replies fail closed", async () => {
  const f = fixture();
  f.state.installation = false;
  await assert.rejects(
    f.commands.verifyInstallation(),
    /staff_installation_protocol/,
  );
  f.state.dispatch = false;
  f.state.current = false;
  const grant = await f.policy(f.req, f.body, f.response);
  assert.ok(grant);
  const newer = { ...f.context, lease: { ...f.context.lease, epoch: 2 } };
  assert.equal(await grant.execute(newer), null);
  assert.equal(f.applied, 0);
  assert.equal(f.status, 409);
  assert.equal((f.value as any).error, "STAFF_UNCONFIRMED");
  f.state.completed = true;
  f.state.result = { ok: true, reason: "teleport" };
  await assert.rejects(
    f.commands.receipt(f.f.room, f.id, f.f.teacher),
    /staff_protocol/,
  );
});
