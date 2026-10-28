import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { PostgresTestDatabase, literal } from "../helpers/postgres.ts";
import { schoolSqlFixture } from "../helpers/school-sql-fixture.ts";
import { supabaseWire } from "../helpers/supabase-wire.ts";
import {
  createSupabaseServerClient,
  SupabasePersistence,
} from "../../src/supabase-persistence.ts";
import { SupabaseSessions } from "../../src/supabase-sessions.ts";
import { SupabaseControls, schoolControl } from "../../src/school-control.ts";
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
function fixture() {
  const room = db.session(),
    host = randomUUID(),
    guest = randomUUID(),
    teacher = randomUUID(),
    admin = randomUUID(),
    game = randomUUID();
  db.exec(`INSERT INTO public.games(id,game_url) VALUES(${literal(game)},'minecraft');
 INSERT INTO public.kid_profiles(id,full_name,gender,grade,role) VALUES(${literal(host)},'Host','boy','ג','kid'),(${literal(guest)},'Guest','boy','ג','kid'),(${literal(teacher)},'Teacher','girl',NULL,'teacher');
 INSERT INTO public.admin_profiles VALUES(${literal(admin)});
 UPDATE public.game_sessions SET game_id=${literal(game)},host_id=${literal(host)},host_name='Host',host_grade='ג',gender='boy',player_ids=ARRAY[${literal(host)}]::uuid[],player_names=ARRAY['Host'] WHERE id=${literal(room)}`);
  const lease: RoomLease = db.rpc("voxel_acquire_room", {
    p_session: room,
    p_owner: randomUUID(),
  });
  assert.equal(db.rpc("voxel_initialize_session", own(lease)), true);
  return { room, host, guest, teacher, admin, lease };
}
const begin = (
  f: ReturnType<typeof fixture>,
  actor: string,
  action: string,
  id = randomUUID(),
  expiresAt = new Date(Date.now() + 4500).toISOString(),
) =>
  db.rpc("voxel_begin_control", {
    ...own(f.lease),
    p_actor: actor,
    p_request: id,
    p_action: action,
    p_authorized_until: expiresAt,
  });
const count = (room: string, table = "voxel_session_commands") =>
  db.value(
    `SELECT count(*) FROM public.${table} WHERE ${table === "audit_log" ? "entity_id" : "session_id"}=${literal(room)}`,
  );

test("fenced SQL commands deny nonhosts, recheck host/role, order idempotent requests and audit staff exactly once", () => {
  const f = fixture(),
    id = randomUUID();
  assert.throws(() => begin(f, f.guest, "pause"), /42501|forbidden/);
  let r = begin(f, f.teacher, "pause", id);
  assert.equal(r.completed, false);
  assert.equal(r.current, true);
  assert.equal(count(f.room, "audit_log"), 1);
  assert.deepEqual(begin(f, f.teacher, "pause", id), r);
  assert.equal(count(f.room, "audit_log"), 1);
  assert.throws(() => begin(f, f.teacher, "resume", id), /22023|conflict/);
  assert.throws(() => begin(f, f.admin, "pause", id), /22023|conflict/);
  const resumed = begin(f, f.host, "resume");
  assert.equal(resumed.revision, r.revision + 1);
  assert.equal(begin(f, f.teacher, "pause", id).current, false);
  assert.equal(
    db.value(
      `SELECT desired_state FROM public.voxel_session_controls WHERE session_id=${literal(f.room)}`,
    ),
    "playing",
  );
  db.exec(
    `UPDATE public.game_sessions SET host_id=${literal(f.guest)} WHERE id=${literal(f.room)}`,
  );
  assert.throws(() => begin(f, f.host, "pause"), /42501|forbidden/);
  db.exec(
    `UPDATE public.kid_profiles SET role='kid' WHERE id=${literal(f.teacher)}`,
  );
  assert.throws(() => begin(f, f.teacher, "pause"), /42501|forbidden/);
  assert.equal(begin(f, f.admin, "pause").completed, false);
  assert.throws(
    () =>
      db.rpc(
        "voxel_begin_control",
        {
          ...own(f.lease),
          p_actor: f.admin,
          p_request: randomUUID(),
          p_action: "end",
          p_authorized_until: new Date(Date.now() + 4000).toISOString(),
        },
        "authenticated",
      ),
    /42501|permission denied/,
  );
});

test("control completion cannot claim an uncommitted save; fresh expiry and stale owners cannot mutate intent", async () => {
  const f = fixture(),
    id = randomUUID();
  begin(f, f.teacher, "pause", id);
  assert.throws(
    () =>
      db.rpc("voxel_finish_control", {
        ...own(f.lease),
        p_actor: f.teacher,
        p_request: id,
        p_saved: 1,
      }),
    /55000|uncommitted/,
  );
  assert.throws(
    () =>
      begin(
        f,
        f.teacher,
        "resume",
        randomUUID(),
        new Date(Date.now() - 1).toISOString(),
      ),
    /42501|expired/,
  );
  const barrier = 31020;
  const held = db.execAsync(
    `BEGIN;SELECT 1 FROM public.game_sessions WHERE id=${literal(f.room)} FOR UPDATE;SELECT pg_advisory_lock(${barrier});SELECT pg_sleep(0.45);COMMIT;`,
  );
  await db.waitForAdvisory(barrier);
  const late = db.rpcAsync("voxel_begin_control", {
    ...own(f.lease),
    p_actor: f.teacher,
    p_request: randomUUID(),
    p_action: "resume",
    p_authorized_until: new Date(Date.now() + 100).toISOString(),
  });
  const rejected = assert.rejects(late, /42501|expired/);
  await held;
  await rejected;
  db.rpc("voxel_release_room", own(f.lease));
  assert.throws(() => begin(f, f.teacher, "end"), /55000|unavailable/);
  assert.equal(count(f.room), 1);
  const delayed = fixture(),
    resumeId = randomUUID();
  begin(delayed, delayed.teacher, "resume", resumeId);
  const audit = db.value(
    `SELECT audit_id FROM public.voxel_session_commands WHERE session_id=${literal(delayed.room)} AND request_id=${literal(resumeId)}`,
  );
  db.exec(
    `UPDATE public.voxel_worlds SET lease_expires_at=clock_timestamp()+interval '200 milliseconds' WHERE session_id=${literal(delayed.room)}`,
  );
  const auditHeld = db.execAsync(
    `BEGIN;SELECT 1 FROM public.audit_log WHERE id=${literal(audit)} FOR UPDATE;SELECT pg_advisory_lock(31021);SELECT pg_sleep(0.45);COMMIT;`,
  );
  await db.waitForAdvisory(31021);
  const finish = db.rpcAsync("voxel_finish_control", {
    ...own(delayed.lease),
    p_actor: delayed.teacher,
    p_request: resumeId,
    p_saved: null,
  });
  const finishRejected = assert.rejects(finish, /55000|unavailable/);
  await auditHeld;
  await finishRejected;
  assert.equal(
    db.rpc("voxel_control_receipt", {
      p_session: delayed.room,
      p_actor: delayed.teacher,
      p_request: resumeId,
    }).completed,
    false,
    "late audit lock cannot produce a completed receipt",
  );
});

test(
  "real school HTTP controls fail unsaved, retry once, resume, end with a committed receipt and replay after terminal retirement",
  { timeout: 25000 },
  async () => {
    const f = fixture();
    db.rpc("voxel_release_room", own(f.lease));
    const wire = await supabaseWire(db),
      client = createSupabaseServerClient({
        SUPABASE_URL: wire.origin,
        SUPABASE_SECRET_KEY: wire.secret,
      }),
      backend = new SupabasePersistence(client),
      sessions = new SupabaseSessions(client),
      commands = new SupabaseControls(client),
      school = schoolSqlFixture(db, f.room, [
        f.host,
        f.guest,
        f.teacher,
        f.admin,
      ]);
    await commands.verifyInstallation();
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
      persistence: { objects: backend, metadata: backend },
      ...schoolGatewayPolicy(school.access, sessions),
      control: schoolControl(school.access, commands),
      allowedOrigins: ["https://school.example"],
    });
    assert.ok(gateway.address && typeof gateway.address === "object");
    const origin = `http://127.0.0.1:${gateway.address.port}`,
      probes: SocketProbe[] = [];
    const post = async (
      actor: string,
      action: string,
      id = randomUUID(),
      originHeader = "https://school.example",
    ) => {
      const response = await fetch(origin + "/api/voxel/control", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + school.token(actor),
          "Content-Type": "application/json",
          Origin: originHeader,
        },
        body: JSON.stringify({ room: f.room, requestId: id, action }),
      });
      return {
        status: response.status,
        value: (await response.json()) as Record<string, any>,
      };
    };
    const until = async (check: () => boolean) => {
      for (let i = 0; i < 150; i++) {
        if (check()) return;
        await delay(20);
      }
      assert.fail("control did not settle");
    };
    try {
      const response = await fetch(origin + "/api/voxel/admission", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + school.token(f.host),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ room: f.room }),
      });
      assert.equal(response.status, 200);
      const ticket = (await response.json()) as {
          ticket: string;
          buildId: string;
        },
        p = new SocketProbe(
          origin.replace(/^http/, "ws") + "/voxel",
          content.blocks.length,
        );
      probes.push(p);
      await once(p.socket, "open");
      p.send({ type: "hello", ...ticket });
      await p.ready();
      const beforeAuth = school.calls.length;
      assert.equal(
        (
          await post(
            f.teacher,
            "pause",
            randomUUID(),
            "https://foreign.example",
          )
        ).status,
        403,
      );
      assert.equal(school.calls.length, beforeAuth);
      assert.equal((await post(f.guest, "pause")).status, 403);
      assert.equal(count(f.room), 0);
      const pauseId = randomUUID();
      wire.control.failUpload = true;
      const failed = await post(f.teacher, "pause", pauseId);
      assert.equal(failed.status, 503);
      assert.equal(failed.value.saved, false);
      assert.equal(count(f.room, "audit_log"), 1);
      const pending = await commands.receipt(f.room, pauseId, f.teacher);
      assert.equal(pending!.completed, false);
      assert.equal(pending!.savedSequence, null);
      wire.control.failUpload = false;
      const paused = await post(f.teacher, "pause", pauseId);
      assert.equal(paused.status, 200);
      assert.equal(paused.value.saved, true);
      assert.ok(paused.value.savedSequence > 0);
      assert.equal(count(f.room, "audit_log"), 1);
      const repeated = await post(f.teacher, "pause", pauseId);
      assert.deepEqual(repeated, paused);
      const resumed = await post(f.teacher, "resume");
      assert.equal(resumed.status, 200);
      assert.equal(resumed.value.saved, false);
      await until(
        () =>
          p.events.filter((e) => "type" in e && e.type === "lifecycle").at(-1)
            ?.state === "playing",
      );
      const endId = randomUUID(),
        ended = await post(f.teacher, "end", endId);
      assert.equal(ended.status, 200);
      assert.equal(ended.value.saved, true);
      assert.ok(ended.value.savedSequence > paused.value.savedSequence);
      await until(() => gateway.rooms.size === 0);
      assert.equal((await p.event("error")).code, "SESSION_ENDED");
      const replay = await post(f.teacher, "end", endId);
      assert.deepEqual(replay, ended);
      assert.equal(gateway.rooms.size, 0);
      assert.equal(count(f.room, "audit_log"), 3);
      assert.equal(
        db.value(
          `SELECT bool_and(metadata->>'status'='completed') FROM public.audit_log WHERE entity_id=${literal(f.room)}`,
        ),
        true,
      );
    } finally {
      for (const p of probes) p.socket.terminate();
      await gateway.close();
      await wire.close();
    }
  },
);
