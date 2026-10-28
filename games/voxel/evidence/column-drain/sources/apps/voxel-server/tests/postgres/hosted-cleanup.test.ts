import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID, createHash } from "node:crypto";
import { PostgresTestDatabase, literal } from "../helpers/postgres.ts";
import { hostedCleanupSql } from "../../tools/hosted-school-scope.ts";
const db = new PostgresTestDatabase();
db.installSessionControls();
db.exec("ALTER TABLE public.game_sessions ADD COLUMN invitation_code text");
after(() => db.close());
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
function fixture() {
  const run = randomUUID(),
    room = db.session(),
    teacher = randomUUID(),
    kid = randomUUID();
  db.exec(
    `INSERT INTO public.kid_profiles(id,full_name,gender,role) VALUES (${literal(teacher)},'fixture','boy','teacher'),(${literal(kid)},'fixture','boy','kid'); UPDATE public.game_sessions SET host_id=${literal(teacher)},invitation_code=${literal("vq-" + run)} WHERE id=${literal(room)}`,
  );
  const lease = db.rpc("voxel_acquire_room", {
    p_session: room,
    p_owner: randomUUID(),
  });
  const sha256 = hash(run),
    ref = {
      key: `v1/${hash(lease.worldId)}/${sha256}.json`,
      sha256,
      bytes: 10,
    };
  const prepared = db.rpc("voxel_prepare_object", { p_object: ref });
  db.rpc("voxel_complete_object", { p_key: ref.key, p_token: prepared.token });
  assert(
    db.rpc("voxel_commit_checkpoint", {
      p_session: room,
      p_world: lease.worldId,
      p_owner: lease.owner,
      p_epoch: lease.epoch,
      p_previous: 0,
      p_pointer: { ownerEpoch: lease.epoch, sequence: 1, object: ref },
      p_objects: [ref],
    }),
  );
  db.exec(
    `INSERT INTO public.audit_log(actor_id,actor_kind,action,entity_type,entity_id) VALUES (${literal(teacher)},'teacher','TEST','game_session',${literal(room)})`,
  );
  return { run, room, teacher, kid, world: lease.worldId, key: ref.key };
}
test("qualification cleanup atomically removes its graph and audit while preserving unrelated data, then is idempotent", () => {
  const own = fixture(),
    other = fixture();
  db.exec(
    `INSERT INTO public.audit_log(actor_id,actor_kind,action,entity_type,entity_id) VALUES (${literal(own.teacher)},'teacher','TEST','another_type',${literal(own.room)})`,
  );
  db.exec(hostedCleanupSql(own));
  for (const [table, column, value] of [
    ["game_sessions", "id", own.room],
    ["voxel_worlds", "world_id", own.world],
    ["voxel_checkpoints", "world_id", own.world],
    ["voxel_checkpoint_objects", "world_id", own.world],
    ["voxel_objects", "object_key", own.key],
  ])
    assert.equal(
      db.value(
        `SELECT count(*) FROM public.${table} WHERE ${column}=${literal(value)}`,
      ),
      0,
    );
  assert.equal(
    db.value(
      `SELECT count(*) FROM public.audit_log WHERE entity_id=${literal(own.room)} AND entity_type='game_session'`,
    ),
    0,
  );
  assert.equal(
    db.value(
      `SELECT count(*) FROM public.audit_log WHERE entity_id=${literal(own.room)} AND entity_type='another_type'`,
    ),
    1,
  );
  assert.equal(
    db.value(
      `SELECT count(*) FROM public.game_sessions WHERE id=${literal(other.room)}`,
    ),
    1,
  );
  assert.equal(
    db.value(
      `SELECT count(*) FROM public.voxel_objects WHERE object_key=${literal(other.key)}`,
    ),
    1,
  );
  assert.equal(
    db.value(
      `SELECT count(*) FROM public.kid_profiles WHERE id IN (${literal(own.teacher)},${literal(own.kid)})`,
    ),
    2,
    "SQL leaves Auth/profile cleanup to owned admin API",
  );
  db.exec(hostedCleanupSql(own));
});
test("qualification cleanup refuses changed ownership or invitation before deleting anything", () => {
  for (const change of ["host", "invitation"]) {
    const own = fixture();
    db.exec(
      `UPDATE public.game_sessions SET ${change === "host" ? `host_id=${literal(own.kid)}` : "invitation_code='changed'"} WHERE id=${literal(own.room)}`,
    );
    assert.throws(() => db.exec(hostedCleanupSql(own)), /ownership mismatch/);
    assert.equal(
      db.value(
        `SELECT count(*) FROM public.game_sessions WHERE id=${literal(own.room)}`,
      ),
      1,
    );
    assert.equal(
      db.value(
        `SELECT count(*) FROM public.voxel_objects WHERE object_key=${literal(own.key)}`,
      ),
      1,
    );
    assert.equal(
      db.value(
        `SELECT count(*) FROM public.audit_log WHERE entity_id=${literal(own.room)}`,
      ),
      1,
    );
  }
});
