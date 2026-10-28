import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID, createHash } from "node:crypto";
import { PostgresTestDatabase, literal } from "../helpers/postgres.ts";
import type {
  RoomLease,
  StoredObject,
  CheckpointPointer,
} from "../../../../games/voxel/src/server/checkpoint-storage.ts";
const db = new PostgresTestDatabase();
after(() => db.close());
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
function acquire(
  room: string = db.session(),
  owner: string = randomUUID(),
): RoomLease {
  return db.rpc("voxel_acquire_room", { p_session: room, p_owner: owner });
}
const ownership = (lease: RoomLease) => ({
  p_session: lease.room,
  p_world: lease.worldId,
  p_owner: lease.owner,
  p_epoch: lease.epoch,
});
function object(lease: RoomLease, data: string): StoredObject {
  const sha256 = hash(data);
  return {
    key: `v1/${hash(lease.worldId)}/${sha256}.json`,
    sha256,
    bytes: Buffer.byteLength(data),
  };
}
function ready(lease: RoomLease, data: string): StoredObject {
  const ref = object(lease, data),
    prepared = db.rpc("voxel_prepare_object", { p_object: ref });
  assert.equal(
    db.rpc("voxel_complete_object", {
      p_key: ref.key,
      p_token: prepared.token,
    }),
    true,
  );
  return ref;
}
const pointer = (
  lease: RoomLease,
  sequence: number,
  ref: StoredObject,
): CheckpointPointer => ({ ownerEpoch: lease.epoch, sequence, object: ref });
const argsForCommit = (
  lease: RoomLease,
  previous: number,
  value: CheckpointPointer,
  objects: readonly StoredObject[],
) => ({
  ...ownership(lease),
  p_previous: previous,
  p_pointer: value,
  p_objects: objects,
});
const commit = (
  lease: RoomLease,
  previous: number,
  value: CheckpointPointer,
  objects: readonly StoredObject[],
) =>
  db.rpc(
    "voxel_commit_checkpoint",
    argsForCommit(lease, previous, value, objects),
  );
const activeSequence = (lease: RoomLease) =>
  db.value(
    `SELECT checkpoint_sequence FROM public.voxel_worlds WHERE session_id=${literal(lease.room)}`,
  );

test("real concurrent acquisition yields one owner; retry is idempotent and expired takeover retains world identity", async () => {
  const room = db.session(),
    a = randomUUID(),
    b = randomUUID();
  const results = await Promise.all(
    [a, b].map((owner) =>
      db.rpcAsync("voxel_acquire_room", { p_session: room, p_owner: owner }),
    ),
  );
  const lease = results.find(Boolean) as RoomLease;
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(lease.epoch, 1);
  assert.equal(acquire(room, lease.owner).epoch, 1);
  assert.equal(
    db.value(
      `SELECT count(*) FROM public.voxel_worlds WHERE session_id=${literal(room)}`,
    ),
    1,
  );
  db.exec(
    `UPDATE public.voxel_worlds SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE session_id=${literal(room)}`,
  );
  const next = acquire(room, randomUUID());
  assert.equal(next.epoch, 2);
  assert.equal(next.worldId, lease.worldId);
});

test("renewal checks the database clock after waiting for the owner row lock", async () => {
  const lease = acquire(),
    barrier = 31001;
  db.exec(
    `UPDATE public.voxel_worlds SET lease_expires_at=clock_timestamp()+interval '200 milliseconds' WHERE session_id=${literal(lease.room)}`,
  );
  const held =
    db.execAsync(`BEGIN; SELECT 1 FROM public.voxel_worlds WHERE session_id=${literal(lease.room)} FOR UPDATE;
    SELECT pg_advisory_lock(${barrier}); SELECT pg_sleep(0.45); COMMIT;`);
  await db.waitForAdvisory(barrier);
  const renewed = db.rpcAsync("voxel_renew_room", ownership(lease));
  await held;
  assert.equal(await renewed, null);
});

test("two transactions racing one sequence commit one whole graph and exact retry cannot duplicate history", async () => {
  const lease = acquire(),
    common = ready(lease, "common column"),
    a = ready(lease, "manifest a"),
    b = ready(lease, "manifest b");
  const pointers = [pointer(lease, 1, a), pointer(lease, 1, b)];
  const result = await Promise.all(
    pointers.map((value) =>
      db.rpcAsync(
        "voxel_commit_checkpoint",
        argsForCommit(lease, 0, value, [value.object, common]),
      ),
    ),
  );
  assert.equal(result.filter(Boolean).length, 1);
  const winner = pointers[result.findIndex(Boolean)];
  assert.equal(activeSequence(lease), 1);
  assert.equal(
    db.value(
      `SELECT count(*) FROM public.voxel_checkpoints WHERE world_id=${literal(lease.worldId)}`,
    ),
    1,
  );
  assert.equal(
    db.value(
      `SELECT count(*) FROM public.voxel_checkpoint_objects WHERE world_id=${literal(lease.worldId)}`,
    ),
    2,
  );
  assert.equal(commit(lease, 0, winner, [winner.object, common]), true);
  assert.deepEqual(acquire(lease.room, lease.owner).checkpoint, winner);
});

test("expired or replaced owner cannot commit, renew or release the new epoch", () => {
  const old = acquire(),
    first = ready(old, "old root");
  assert.equal(commit(old, 0, pointer(old, 1, first), [first]), true);
  db.rpc("voxel_release_room", ownership(old));
  const next = acquire(old.room, randomUUID()),
    second = ready(next, "new root");
  assert.equal(next.epoch, old.epoch + 1);
  assert.equal(next.sequence, 1);
  assert.equal(db.rpc("voxel_renew_room", ownership(old)), null);
  assert.equal(commit(old, 1, pointer(old, 2, first), [first]), false);
  db.rpc("voxel_release_room", ownership(old));
  assert.ok(db.rpc("voxel_renew_room", ownership(next)));
  assert.equal(commit(next, 1, pointer(next, 2, second), [second]), true);
});

test("corrupt graph suffixes or unconfirmed uploads roll back pointer, history and every reference", () => {
  const lease = acquire(),
    root = ready(lease, "valid root"),
    pending = object(lease, "pending column");
  db.rpc("voxel_prepare_object", { p_object: pending });
  for (const refs of [
    [root, pending],
    [root, root],
    [
      root,
      { ...root, key: root.key.replace(hash(lease.worldId), "a".repeat(64)) },
    ],
  ]) {
    assert.throws(() => commit(lease, 0, pointer(lease, 1, root), refs));
    assert.equal(activeSequence(lease), 0);
    assert.equal(
      db.value(
        `SELECT count(*) FROM public.voxel_checkpoints WHERE world_id=${literal(lease.worldId)}`,
      ),
      0,
    );
    assert.equal(
      db.value(
        `SELECT count(*) FROM public.voxel_checkpoint_objects WHERE world_id=${literal(lease.worldId)}`,
      ),
      0,
    );
  }
  assert.throws(() =>
    commit(lease, 0, pointer(lease, 1, root), [ready(lease, "other root")]),
  );
  assert.equal(commit(lease, 0, pointer(lease, 1, root), [root]), true);
});

test("browser roles cannot read metadata or execute RPCs; service writes require RPCs and the bucket is private", () => {
  const room = db.session(),
    owner = randomUUID();
  for (const role of ["anon", "authenticated"]) {
    assert.throws(() => db.exec("SELECT * FROM public.voxel_worlds", role));
    assert.throws(() =>
      db.rpc("voxel_acquire_room", { p_session: room, p_owner: owner }, role),
    );
    assert.throws(() => db.rpc("voxel_persistence_status", {}, role));
  }
  assert.throws(() =>
    db.exec(
      "UPDATE public.voxel_worlds SET checkpoint_sequence=99",
      "service_role",
    ),
  );
  assert.deepEqual(db.rpc("voxel_persistence_status", {}), {
    schema: 1,
    privateBucket: true,
  });
  assert.equal(
    db.value(
      `SELECT count(*) FROM pg_class WHERE relname IN ('voxel_worlds','voxel_objects','voxel_checkpoints','voxel_checkpoint_objects') AND relrowsecurity`,
    ),
    4,
  );
});

test("retention keeps active/shared objects; garbage claims fence uploads and stale deletion workers", () => {
  const lease = acquire(),
    shared = ready(lease, "retained shared"),
    old = ready(lease, "retained old root"),
    current = ready(lease, "retained current root");
  assert.equal(commit(lease, 0, pointer(lease, 1, old), [old, shared]), true);
  assert.equal(
    commit(lease, 1, pointer(lease, 2, current), [current, shared]),
    true,
  );
  const orphan = ready(lease, "orphan"),
    protectedUpload = object(lease, "protected upload");
  db.rpc("voxel_prepare_object", { p_object: protectedUpload });
  db.exec(`UPDATE public.voxel_checkpoints SET created_at=clock_timestamp()-interval '25 hours' WHERE world_id=${literal(lease.worldId)};
    UPDATE public.voxel_objects SET created_at=clock_timestamp()-interval '25 hours',protected_until=clock_timestamp()-interval '1 hour'
      WHERE world_id=${literal(lease.worldId)} AND object_key <> ${literal(protectedUpload.key)}`);
  assert.equal(db.rpc("voxel_prune_checkpoints", {}), 1);
  const claims = db.rpc("voxel_claim_garbage", { p_limit: 64 }) as {
    key: string;
    token: string;
  }[];
  assert.deepEqual(
    claims.map((c) => c.key).sort(),
    [old.key, orphan.key].sort(),
  );
  assert.equal(db.rpc("voxel_prepare_object", { p_object: orphan }), null);
  assert.deepEqual(db.rpc("voxel_claim_garbage", { p_limit: 64 }), []);
  db.exec(
    `UPDATE public.voxel_objects SET delete_claimed_at=clock_timestamp()-interval '11 minutes' WHERE object_key=${literal(orphan.key)}`,
  );
  const retry = db.rpc("voxel_claim_garbage", { p_limit: 64 }) as {
    key: string;
    token: string;
  }[];
  assert.equal(retry.length, 1);
  assert.equal(retry[0].key, orphan.key);
  assert.equal(
    db.rpc("voxel_finish_garbage", {
      p_key: orphan.key,
      p_token: claims.find((c) => c.key === orphan.key)!.token,
    }),
    false,
  );
  for (const claim of [claims.find((c) => c.key === old.key)!, retry[0]]) {
    assert.equal(
      db.rpc("voxel_finish_garbage", {
        p_key: claim.key,
        p_token: claim.token,
      }),
      true,
    );
    assert.equal(
      db.rpc("voxel_finish_garbage", {
        p_key: claim.key,
        p_token: claim.token,
      }),
      true,
    );
  }
  assert.equal(activeSequence(lease), 2);
  assert.equal(
    db.value(
      `SELECT state FROM public.voxel_objects WHERE object_key=${literal(current.key)}`,
    ),
    "ready",
  );
  assert.equal(
    db.value(
      `SELECT state FROM public.voxel_objects WHERE object_key=${literal(shared.key)}`,
    ),
    "ready",
  );
});

test("cleanup skips uncommitted graph locks and rechecks references before claiming deletion", async () => {
  const lease = acquire(),
    root = ready(lease, "racing cleanup root"),
    barrier = 31002;
  db.exec(
    `UPDATE public.voxel_objects SET created_at=clock_timestamp()-interval '25 hours',protected_until=clock_timestamp()-interval '1 hour' WHERE object_key=${literal(root.key)}`,
  );
  const expr = db.call(
    "voxel_commit_checkpoint",
    argsForCommit(lease, 0, pointer(lease, 1, root), [root]),
  );
  const committing = db.execAsync(
    `BEGIN; SELECT ${expr}; SELECT pg_advisory_lock(${barrier}); SELECT pg_sleep(0.35); COMMIT;`,
    "service_role",
  );
  await db.waitForAdvisory(barrier);
  assert.deepEqual(db.rpc("voxel_claim_garbage", { p_limit: 64 }), []);
  await committing;
  assert.deepEqual(db.rpc("voxel_claim_garbage", { p_limit: 64 }), []);
  assert.equal(activeSequence(lease), 1);
});

test("session removal retains orphan object addresses for subsequent Storage cleanup", () => {
  const lease = acquire(),
    root = ready(lease, "deleted session root");
  assert.equal(commit(lease, 0, pointer(lease, 1, root), [root]), true);
  db.exec(`DELETE FROM public.game_sessions WHERE id=${literal(lease.room)}`);
  assert.equal(
    db.value(
      `SELECT count(*) FROM public.voxel_worlds WHERE world_id=${literal(lease.worldId)}`,
    ),
    0,
  );
  assert.equal(
    db.value(
      `SELECT count(*) FROM public.voxel_checkpoint_objects WHERE world_id=${literal(lease.worldId)}`,
    ),
    0,
  );
  assert.equal(
    db.value(
      `SELECT count(*) FROM public.voxel_objects WHERE object_key=${literal(root.key)}`,
    ),
    1,
  );
});

test("old active references cannot starve a bounded garbage-collection batch", () => {
  const lease = acquire(),
    root = ready(lease, "many active root");
  const columns = Array.from({ length: 65 }, (_, index) =>
    ready(lease, `active column ${index}`),
  );
  assert.equal(
    commit(lease, 0, pointer(lease, 1, root), [root, ...columns]),
    true,
  );
  db.exec(
    `UPDATE public.voxel_objects SET created_at=clock_timestamp()-interval '26 hours',protected_until=clock_timestamp()-interval '1 hour' WHERE world_id=${literal(lease.worldId)}`,
  );
  const orphan = ready(lease, "newer collectible orphan");
  db.exec(
    `UPDATE public.voxel_objects SET created_at=clock_timestamp()-interval '25 hours',protected_until=clock_timestamp()-interval '1 hour' WHERE object_key=${literal(orphan.key)}`,
  );
  const claims = db.rpc("voxel_claim_garbage", { p_limit: 1 });
  assert.equal(claims.length, 1);
  assert.equal(claims[0].key, orphan.key);
  assert.equal(activeSequence(lease), 1);
});

test("commit rechecks expiry after object locks and cannot leave partial history after a delayed upload lock", async () => {
  const lease = acquire(),
    root = ready(lease, "expiry during object wait"),
    barrier = 31003;
  db.exec(
    `UPDATE public.voxel_worlds SET lease_expires_at=clock_timestamp()+interval '200 milliseconds' WHERE session_id=${literal(lease.room)}`,
  );
  const held =
    db.execAsync(`BEGIN; SELECT 1 FROM public.voxel_objects WHERE object_key=${literal(root.key)} FOR UPDATE;
    SELECT pg_advisory_lock(${barrier}); SELECT pg_sleep(0.45); COMMIT;`);
  await db.waitForAdvisory(barrier);
  const saving = db.rpcAsync(
    "voxel_commit_checkpoint",
    argsForCommit(lease, 0, pointer(lease, 1, root), [root]),
  );
  await held;
  assert.equal(await saving, false);
  assert.equal(activeSequence(lease), 0);
  assert.equal(
    db.value(
      `SELECT count(*) FROM public.voxel_checkpoints WHERE world_id=${literal(lease.worldId)}`,
    ),
    0,
  );
});
