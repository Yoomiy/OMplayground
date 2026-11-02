import assert from "node:assert/strict";
import { test } from "node:test";
import type { IncomingMessage, ServerResponse } from "node:http";
import { schoolAdmission } from "../src/school-admission.ts";
import { schoolFixture } from "./helpers/school-fixture.ts";

test("admission logs denied access and provider failures with the request correlation and no credentials", async () => {
  const f = schoolFixture();
  const events: {
    name: string;
    context: Record<string, string | number | boolean>;
  }[] = [];
  const admit = schoolAdmission(f.access, (name, context) =>
    events.push({ name, context }),
  );
  let status = 0;
  const res = {
    getHeader: () => "request-fixture",
    writeHead(code: number) {
      status = code;
    },
    end() {},
  } as unknown as ServerResponse;
  await admit({ headers: {} } as IncomingMessage, { room: f.room }, res);
  assert.equal(status, 401);
  assert.equal(events[0]!.name, "VOXEL_ADMISSION_REJECTED");
  assert.equal(events[0]!.context.code, "UNAUTHORIZED");
  assert.equal(events[0]!.context.correlationId, "request-fixture");
  f.access.grant = async () => {
    throw new Error("provider-token-private");
  };
  await admit(
    { headers: { authorization: "Bearer fixture-secret" } } as IncomingMessage,
    { room: f.room },
    res,
  );
  assert.equal(status, 503);
  assert.equal(events[1]!.context.code, "SCHOOL_POLICY_UNAVAILABLE");
  assert.equal(events[1]!.context.phase, "school_authorization");
  assert.doesNotMatch(
    JSON.stringify(events),
    /fixture-secret|provider-token-private/,
  );
});
