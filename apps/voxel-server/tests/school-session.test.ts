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
  const metrics = {
    epoch: 3,
    sequence: 120,
    ack: 2,
    inputSeconds: 2,
    ackAgeMs: 2100,
    snapshotAgeMs: 10,
    bufferedBytes: 0,
  };
  assert.equal(
    (
      await send({
        ...base,
        code: "INPUT_BACKPRESSURE",
        fatal: false,
        reason: "input_acknowledgement_stalled",
        metrics,
      })
    ).status,
    200,
  );
  assert.equal(events[2]!.context.ack, 2);
  for (const invalid of [
    { token: 123 },
    { ack: -1 },
    { epoch: NaN },
    { url: "private" },
  ])
    assert.equal((await send({ ...base, metrics: invalid })).status, 400);
  const reads = f.requests.length,
    count = events.length;
  f.state.outage = "kid_profiles";
  assert.equal(
    (await send({ ...base, operation: "pointer_lock" })).status,
    200,
  );
  assert.equal(f.requests.length, reads);
  assert.equal(events.length, count);
  f.state.outage = "";
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
    3,
  );
  assert.doesNotMatch(
    JSON.stringify(events),
    /token=private|fixture_signature/,
  );
});

test("session projection tolerates read latency beyond a mutation proof but reports its own read deadline", async (t) => {
  const f = schoolFixture();
  t.mock.method(Date, "now", () => f.now);
  f.state.onRequest = () => f.setNow(f.now + 1000);
  let extra = 2000,
    status = 200;
  const events: {
    name: string;
    context: Record<string, string | number | boolean>;
  }[] = [];
  const query = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    abortSignal() {
      return this;
    },
    maybeSingle() {
      return this;
    },
    async retry() {
      f.setNow(f.now + extra);
      return { data: { id: f.room }, error: null };
    },
  };
  const handler = schoolSessionApi(
    f.access,
    { from: () => query } as unknown as SupabaseClient,
    (name, context) => events.push({ name, context }),
  )["/api/voxel/session"]!;
  const req = {
    url: "/api/voxel/session",
    headers: { authorization: "Bearer " + f.token() },
  } as IncomingMessage;
  const res = {
    writeHead(code: number) {
      status = code;
    },
    end() {},
  } as unknown as ServerResponse;
  const before = f.now;
  assert.deepEqual(await handler(req, { room: f.room }, res), { id: f.room });
  assert.ok(f.now - before > 5000);
  assert.equal(status, 200);
  extra = 6000;
  await handler(req, { room: f.room }, res);
  assert.equal(status, 503);
  assert.equal(events.at(-1)!.context.failureReason, "read_deadline");
  assert.equal(events.at(-1)!.context.policyPhase, "session_projection");
});
