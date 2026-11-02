import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { SupabaseClient } from "@supabase/supabase-js";
import { schoolSessionApi } from "../src/school-session.ts";
import { schoolFixture } from "./helpers/school-fixture.ts";

test("diagnostics accepts old clients and fixed failure details, rejects arbitrary messages and invalid shapes", async () => {
  const f = schoolFixture();
  const events: {
    name: string;
    context: Record<string, string | number | boolean>;
  }[] = [];
  const handler = schoolSessionApi(
    f.access,
    {} as SupabaseClient,
    (name, context) => events.push({ name, context }),
  )["/api/voxel/diagnostics"]!;
  const base = {
    room: f.room,
    correlationId: randomUUID(),
    operation: "prediction",
    code: "RUNTIME_FAILURE",
    buildId: "a".repeat(64),
  };
  async function send(body: unknown, authorized = true) {
    let status = 200;
    const req = {
      url: "/api/voxel/diagnostics",
      headers: authorized ? { authorization: "Bearer " + f.token(f.kid) } : {},
    } as IncomingMessage;
    const res = {
      writeHead(code: number) {
        status = code;
      },
      end() {},
    } as unknown as ServerResponse;
    const result = await handler(req, body, res);
    return { status, result };
  }
  assert.equal((await send(base)).status, 200);
  assert.equal(
    (
      await send({
        ...base,
        reason: "input_acknowledgement_stalled",
        fatal: true,
      })
    ).status,
    200,
  );
  assert.equal(events[1]!.context.fatal, true);
  assert.equal(events[1]!.context.reason, "input_acknowledgement_stalled");
  for (const body of [
    { ...base, reason: "token=private" },
    { ...base, fatal: "true" },
    { ...base, stack: "private" },
    { ...base, buildId: undefined },
    { ...base, correlationId: "invalid" },
  ])
    assert.equal((await send(body)).status, 400);
  assert.equal((await send(base, false)).status, 401);
  assert.equal(
    events.filter((event) => event.name === "VOXEL_CLIENT_FAILURE").length,
    2,
  );
  assert.doesNotMatch(
    JSON.stringify(events),
    /token=private|fixture_signature/,
  );
});
