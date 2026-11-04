import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { once } from "node:events";
import { PostgresTestDatabase, literal } from "../helpers/postgres.ts";
import { supabaseWire } from "../helpers/supabase-wire.ts";
import { schoolSqlFixture } from "../helpers/school-sql-fixture.ts";
import {
  createSupabaseServerClient,
  SupabasePersistence,
} from "../../src/supabase-persistence.ts";
import { SupabaseSessions } from "../../src/supabase-sessions.ts";
import { SupabaseStaff, schoolStaff } from "../../src/school-staff.ts";
import { schoolGatewayPolicy } from "../../src/school-admission.ts";
import { createGateway } from "../../../../games/voxel/src/server/gateway.ts";
import { SocketProbe } from "../../../../games/voxel/tests/fixtures/socket-probe.ts";
import type { RoomLease } from "../../../../games/voxel/src/server/checkpoint-storage.ts";
const db = new PostgresTestDatabase();
db.installSessionControls();
after(() => db.close());
const own = (lease: RoomLease) => ({
  p_session: lease.room,
  p_world: lease.worldId,
  p_owner: lease.owner,
  p_epoch: lease.epoch,
});
function fixture(acquire = true) {
  const room = db.session(),
    host = randomUUID(),
    teacher = randomUUID(),
    admin = randomUUID(),
    game = randomUUID();
  db.exec(`INSERT INTO public.games(id,game_url) VALUES(${literal(game)},'minecraft');
 INSERT INTO public.kid_profiles(id,full_name,gender,grade,role) VALUES(${literal(host)},'Child','boy','ג','kid'),(${literal(teacher)},'Teacher','girl',NULL,'teacher');
 INSERT INTO public.admin_profiles VALUES(${literal(admin)});
 UPDATE public.game_sessions SET game_id=${literal(game)},host_id=${literal(host)},host_name='Child',gender='boy',status='playing',player_ids=ARRAY[${literal(host)}]::uuid[],player_names=ARRAY['Child'] WHERE id=${literal(room)}`);
  const lease: RoomLease = acquire
    ? db.rpc("voxel_acquire_room", { p_session: room, p_owner: randomUUID() })
    : null;
  if (lease) assert.equal(db.rpc("voxel_initialize_session", own(lease)), true);
  return { room, host, teacher, admin, lease };
}
const begin = (
  f: ReturnType<typeof fixture>,
  actor = f.teacher,
  command: unknown = { kind: "mode", mode: "creative" },
  id = randomUUID(),
  until = Date.now() + 4500,
  lease = f.lease,
) =>
  db.rpc("voxel_begin_staff", {
    ...own(lease),
    p_actor: actor,
    p_request: id,
    p_command: command,
    p_authorized_until: new Date(until).toISOString(),
  });
const finish = (
  f: ReturnType<typeof fixture>,
  id: string,
  result: unknown = { ok: true, reason: "mode" },
  lease = f.lease,
) =>
  db.rpc("voxel_finish_staff", {
    ...own(lease),
    p_actor: f.teacher,
    p_request: id,
    p_result: result,
  });
const count = (room: string, table = "voxel_staff_commands") =>
  db.value(
    `SELECT count(*) FROM public.${table} WHERE ${table === "audit_log" ? "entity_id" : "session_id"}=${literal(room)}`,
  );

test("SQL staff authority is fresh, audit is idempotent and application receipts never claim a checkpoint", () => {
  const f = fixture(),
    id = randomUUID();
  assert.throws(() => begin(f, f.host), /forbidden/);
  const first = begin(f, f.teacher, undefined, id);
  assert.equal(first.dispatch, true);
  assert.equal(first.completed, false);
  assert.equal(first.current, true);
  assert.equal(count(f.room, "audit_log"), 1);
  assert.deepEqual(begin(f, f.teacher, undefined, id), first);
  assert.equal(count(f.room), 1);
  assert.throws(() => begin(f, f.admin, undefined, id), /conflict/);
  assert.throws(
    () => begin(f, f.teacher, { kind: "teleport", target: "spawn" }, id),
    /conflict/,
  );
  assert.throws(
    () =>
      begin(f, f.teacher, {
        kind: "teleport",
        target: "spawn",
        position: [1, 2, 3],
      }),
    /invalid/,
  );
  assert.throws(
    () => finish(f, id, { ok: true, reason: "teleport" }),
    /conflict/,
  );
  const done = finish(f, id);
  assert.equal(done.completed, true);
  assert.deepEqual(done.result, { ok: true, reason: "mode" });
  assert.equal("savedSequence" in done, false);
  assert.deepEqual(finish(f, id), done);
  assert.equal(begin(f, f.teacher, undefined, id).dispatch, false);
  assert.equal(
    begin(f, f.admin, { kind: "mode", mode: "survival" }).revision,
    2,
  );
  assert.equal(
    db.rpc("voxel_staff_receipt", {
      p_session: f.room,
      p_request: id,
      p_actor: f.teacher,
    }).current,
    false,
  );
  assert.doesNotMatch(
    JSON.stringify(
      db.value(
        `SELECT metadata FROM public.audit_log WHERE entity_id=${literal(f.room)} ORDER BY created_at LIMIT 1`,
      ),
    ),
    /Child|Teacher|Bearer|sb_secret_/,
  );
  assert.throws(
    () =>
      db.rpc(
        "voxel_staff_receipt",
        { p_session: f.room, p_request: id, p_actor: f.teacher },
        "authenticated",
      ),
    /permission denied/,
  );
  db.exec(
    `UPDATE public.kid_profiles SET role='kid' WHERE id=${literal(f.teacher)}`,
  );
  assert.throws(() => begin(f), /forbidden/);
});

test("SQL dispatched commands cannot execute or complete under a replacement owner; a fresh explicit request remains possible", () => {
  const f = fixture(),
    id = randomUUID(),
    command = { kind: "teleport", target: "spawn" };
  begin(f, f.teacher, command, id);
  db.rpc("voxel_release_room", own(f.lease));
  const next: RoomLease = db.rpc("voxel_acquire_room", {
    p_session: f.room,
    p_owner: randomUUID(),
  });
  const old = begin(f, f.teacher, command, id, Date.now() + 4500, next);
  assert.equal(old.dispatch, false);
  assert.equal(old.current, false);
  assert.equal(old.completed, false);
  assert.throws(
    () => finish(f, id, { ok: true, reason: "teleport" }, next),
    /unavailable/,
  );
  const fresh = begin(
    f,
    f.teacher,
    command,
    randomUUID(),
    Date.now() + 4500,
    next,
  );
  assert.equal(fresh.dispatch, true);
  assert.equal(fresh.ownerEpoch, next.epoch);
  assert.equal(count(f.room, "audit_log"), 2);
});

test("SQL staff proofs and completion recheck the clock after platform/audit row waits and roll back partial results", async () => {
  const f = fixture(),
    barrier = 31050;
  const held = db.execAsync(
    `BEGIN;SELECT 1 FROM public.game_sessions WHERE id=${literal(f.room)} FOR UPDATE;SELECT pg_advisory_lock(${barrier});SELECT pg_sleep(0.45);COMMIT;`,
  );
  await db.waitForAdvisory(barrier);
  const rejected = assert.rejects(
    db.rpcAsync("voxel_begin_staff", {
      ...own(f.lease),
      p_actor: f.teacher,
      p_request: randomUUID(),
      p_command: { kind: "mode", mode: "creative" },
      p_authorized_until: new Date(Date.now() + 200).toISOString(),
    }),
    /expired/,
  );
  await held;
  await rejected;
  assert.equal(count(f.room), 0);
  assert.equal(count(f.room, "audit_log"), 0);
  const id = randomUUID();
  begin(f, f.teacher, undefined, id);
  const audit = db.value(
    `SELECT audit_id FROM public.voxel_staff_commands WHERE session_id=${literal(f.room)}`,
  );
  const locked = db.execAsync(
    `BEGIN;SELECT 1 FROM public.audit_log WHERE id=${literal(audit)} FOR UPDATE;SELECT pg_advisory_lock(${barrier + 1});SELECT pg_sleep(0.45);COMMIT;`,
  );
  await db.waitForAdvisory(barrier + 1);
  db.exec(
    `UPDATE public.voxel_worlds SET lease_expires_at=clock_timestamp()+interval '200 milliseconds' WHERE session_id=${literal(f.room)}`,
  );
  const denied = assert.rejects(
    db.rpcAsync("voxel_finish_staff", {
      ...own(f.lease),
      p_actor: f.teacher,
      p_request: id,
      p_result: { ok: true, reason: "mode" },
    }),
    /unavailable/,
  );
  await locked;
  await denied;
  assert.equal(
    db.value(
      `SELECT completed FROM public.voxel_staff_commands WHERE session_id=${literal(f.room)}`,
    ),
    false,
  );
  assert.equal(
    db.value(
      `SELECT metadata->>'status' FROM public.audit_log WHERE id=${literal(audit)}`,
    ),
    "dispatched",
  );
});

test("native SDK/SQL staff controls change mode and teleport only the verified hidden staff actor with one audited receipt", async () => {
  const f = fixture(false),
    wire = await supabaseWire(db),
    school = schoolSqlFixture(db, f.room, [f.host, f.teacher]),
    client = createSupabaseServerClient({
      SUPABASE_URL: wire.origin,
      SUPABASE_SECRET_KEY: wire.secret,
    });
  const backend = new SupabasePersistence(client),
    sessions = new SupabaseSessions(client),
    staff = new SupabaseStaff(client);
  const build = JSON.parse(
      readFileSync(
        new URL(
          "../../../../games/voxel/artifacts/build.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ),
    content = JSON.parse(
      readFileSync(
        new URL(
          "../../../../games/voxel/artifacts/content.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
  const gateway = await createGateway({
    build,
    content,
    ...schoolGatewayPolicy(school.access, sessions),
    control: schoolStaff(school.access, staff),
    persistence: { objects: backend, metadata: backend },
    worldDefaults: { mode: "survival" },
  });
  assert.ok(gateway.address && typeof gateway.address === "object");
  const origin = `http://127.0.0.1:${gateway.address.port}`,
    probes: SocketProbe[] = [];
  const post = (actor: string, requestId: string, command: unknown) =>
    fetch(origin + "/api/voxel/control", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + school.token(actor),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ room: f.room, requestId, command }),
    });
  const connect = async (actor: string) => {
    const response = await fetch(origin + "/api/voxel/admission", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + school.token(actor),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ room: f.room }),
    });
    const ticket = await response.json();
    assert.equal(response.status, 200);
    const probe = new SocketProbe(
      origin.replace(/^http/, "ws") + "/voxel",
      content.blocks.length,
    );
    probes.push(probe);
    await once(probe.socket, "open");
    probe.send({ type: "hello", ...ticket });
    await probe.ready();
    return probe;
  };
  try {
    await staff.verifyInstallation();
    assert.equal(
      (await post(f.host, randomUUID(), { kind: "mode", mode: "creative" }))
        .status,
      403,
    );
    assert.equal(gateway.rooms.size, 0);
    const child = await connect(f.host),
      teacher = await connect(f.teacher),
      id = randomUUID();
    const changed = await post(f.teacher, id, {
      kind: "mode",
      mode: "creative",
    });
    assert.equal(changed.status, 200);
    const receipt = await changed.json();
    assert.equal(receipt.saved, false);
    assert.equal(receipt.result.ok, true);
    await child.event("rules");
    await teacher.event("rules");
    const mode = await teacher.wait(
      (e): e is any =>
        "type" in e && e.type === "baseline" && e.reason === "mode",
    );
    const replay = await post(f.teacher, id, {
      kind: "mode",
      mode: "creative",
    });
    assert.equal(replay.status, 200);
    assert.deepEqual(await replay.json(), receipt);
    assert.equal(count(f.room, "audit_log"), 1);
    const teleported = await post(f.teacher, randomUUID(), {
      kind: "teleport",
      target: f.host,
    });
    assert.equal(teleported.status, 200);
    assert.equal((await teleported.json()).result.ok, true);
    const moved = await teacher.wait(
      (e): e is any =>
        "type" in e && e.type === "baseline" && e.reason === "teleport",
    );
    assert.ok(moved.epoch > mode.epoch);
    assert.equal(moved.phase, "preparing");
    assert.equal(moved.state[12], 1);
    assert.equal(
      child.events.some(
        (e) =>
          "type" in e && e.type === "actor_joined" && e.actor.id === f.teacher,
      ),
      false,
    );
    assert.equal(count(f.room), 2);
    assert.equal(count(f.room, "audit_log"), 2);
  } finally {
    for (const p of probes) p.socket.terminate();
    await gateway.close();
    await wire.close();
  }
});

test("SQL inactive or demoted kid-profile rows cannot fall through to a second admin profile for staff or lifecycle authority", () => {
  const f = fixture();
  const pause = () =>
    db.rpc("voxel_begin_control", {
      ...own(f.lease),
      p_actor: f.teacher,
      p_request: randomUUID(),
      p_action: "pause",
      p_authorized_until: new Date(Date.now() + 4500).toISOString(),
    });
  db.exec(
    `INSERT INTO public.admin_profiles VALUES(${literal(f.teacher)});UPDATE public.kid_profiles SET is_active=false WHERE id=${literal(f.teacher)}`,
  );
  assert.throws(() => begin(f), /forbidden/);
  assert.throws(pause, /forbidden/);
  db.exec(
    `UPDATE public.kid_profiles SET is_active=true,role='kid',gender='boy' WHERE id=${literal(f.teacher)}`,
  );
  assert.throws(() => begin(f), /forbidden/);
  assert.throws(pause, /forbidden/);
  assert.equal(count(f.room), 0);
  assert.equal(count(f.room, "audit_log"), 0);
  db.exec(
    `UPDATE public.kid_profiles SET role='teacher' WHERE id=${literal(f.teacher)}`,
  );
  assert.equal(begin(f).dispatch, true);
  assert.equal(pause().completed, false);
  assert.equal(
    db.value(
      `SELECT bool_and(actor_kind='teacher') FROM public.audit_log WHERE entity_id=${literal(f.room)}`,
    ),
    true,
  );
  for (const role of ["authenticated", "anon", "service_role"]) {
    assert.throws(
      () =>
        db.exec(
          `SET ROLE ${role};SELECT public.voxel_actor_kind(${literal(f.teacher)});RESET ROLE`,
        ),
      /permission denied/,
    );
  }
});
