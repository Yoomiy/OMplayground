import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import {
  checkHostedRequest,
  hostedCleanupSql,
  HOSTED_STATUS_RPCS,
} from "../tools/hosted-school-scope.ts";
const scope = {
    run: randomUUID(),
    room: randomUUID(),
    teacher: randomUUID(),
    kid: randomUUID(),
  },
  origin = "https://project.supabase.co",
  namespace = "a".repeat(64),
  namespaces = new Set([namespace]),
  key = `v1/${namespace}/${"b".repeat(64)}.json`;
const request = (path: string, method = "POST", base = origin) =>
  new Request(base + path, { method });
const check = (
  path: string,
  args: Record<string, unknown> | undefined,
  method = "POST",
  base = origin,
) =>
  checkHostedRequest(
    request(path, method, base),
    args,
    scope,
    origin,
    namespaces,
  );
test("hosted qualification scope allows its status/room/object requests and refuses global cleanup", () => {
  for (const rpc of HOSTED_STATUS_RPCS)
    assert.equal(check("/rest/v1/rpc/" + rpc, {}), "allow");
  assert.equal(
    check("/rest/v1/rpc/voxel_acquire_room", { p_session: scope.room }),
    "allow",
  );
  assert.equal(
    check("/rest/v1/rpc/voxel_prepare_object", { p_object: { key } }),
    "allow",
  );
  assert.equal(
    check("/rest/v1/rpc/voxel_complete_object", { p_key: key }),
    "allow",
  );
  assert.equal(
    check("/storage/v1/object/voxel-checkpoints/" + key, undefined),
    "allow",
  );
  for (const rpc of [
    "voxel_prune_checkpoints",
    "voxel_claim_garbage",
    "voxel_finish_garbage",
  ])
    assert.equal(check("/rest/v1/rpc/" + rpc, {}), "deny-maintenance");
});
test("hosted qualification scope rejects other sessions, actors, graphs and namespaces", () => {
  assert.throws(() =>
    check("/rest/v1/rpc/unreviewed_function", { p_session: scope.room }),
  );
  for (const args of [
    { p_session: randomUUID() },
    { p_session: scope.room, p_actor: randomUUID() },
    { p_session: scope.room, p_participants: [randomUUID()] },
    {
      p_session: scope.room,
      p_objects: [{ key: key.replace(namespace, "c".repeat(64)) }],
    },
    { p_session: scope.room, p_pointer: { object: { key: "other" } } },
  ])
    assert.throws(() => check("/rest/v1/rpc/voxel_commit_checkpoint", args));
  assert.throws(() =>
    check("/rest/v1/rpc/voxel_prepare_object", {
      p_object: { key: key.replace(namespace, "c".repeat(64)) },
    }),
  );
  assert.throws(() =>
    check(
      "/storage/v1/object/voxel-checkpoints/" +
        key.replace(namespace, "c".repeat(64)),
      undefined,
    ),
  );
  assert.throws(() =>
    check("/storage/v1/object/voxel-checkpoints/" + key, undefined, "DELETE"),
  );
});
test("hosted qualification reads are limited to exact own row IDs and configured provider", () => {
  assert.equal(
    check("/rest/v1/game_sessions?id=eq." + scope.room, undefined, "GET"),
    "allow",
  );
  for (const table of ["kid_profiles", "admin_profiles"])
    for (const id of [scope.teacher, scope.kid])
      assert.equal(
        check(`/rest/v1/${table}?id=eq.${id}`, undefined, "GET"),
        "allow",
      );
  for (const path of [
    "/rest/v1/game_sessions",
    "/rest/v1/kid_profiles",
    "/rest/v1/admin_profiles?id=eq." + randomUUID(),
    "/rest/v1/games",
  ])
    assert.throws(() => check(path, undefined, "GET"));
  assert.throws(() =>
    check("/rest/v1/game_sessions?id=eq." + scope.room, undefined, "POST"),
  );
  assert.throws(() =>
    check("/auth/v1/user", undefined, "GET", "https://another.example"),
  );
  assert.throws(() =>
    check("/rest/v1/rpc/voxel_persistence_status", { p_session: scope.room }),
  );
});
test("cleanup SQL rejects untrusted interpolation before any query is available", () => {
  for (const field of ["run", "room", "teacher", "kid"] as const)
    assert.throws(() =>
      hostedCleanupSql({
        ...scope,
        [field]: "';DELETE FROM public.game_sessions;--",
      }),
    );
});

test("private-session challenge lookup reads only the temporary child's accepted challenge IDs", () => {
  const query = new URLSearchParams({
    select: "id",
    session_id: `eq.${scope.room}`,
    to_kid_id: `eq.${scope.kid}`,
    status: "eq.accepted",
  });
  const path = () => "/rest/v1/game_challenges?" + query;
  assert.equal(check(path(), undefined, "GET"), "allow");
  for (const [field, value] of Object.entries({
    session_id: `eq.${randomUUID()}`,
    to_kid_id: `eq.${randomUUID()}`,
    status: "eq.pending",
    select: "*",
  })) {
    const original = query.get(field)!;
    query.set(field, value);
    assert.throws(() => check(path(), undefined, "GET"));
    query.delete(field);
    assert.throws(() => check(path(), undefined, "GET"));
    query.set(field, original);
  }
  assert.throws(() => check(path(), undefined, "POST"));
});
