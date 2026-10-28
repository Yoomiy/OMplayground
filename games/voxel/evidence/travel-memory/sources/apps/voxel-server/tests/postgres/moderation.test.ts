import { readFileSync } from "node:fs";
import { once } from "node:events";
import { supabaseWire } from "../helpers/supabase-wire.ts";
import { schoolSqlFixture } from "../helpers/school-sql-fixture.ts";
import {
  createSupabaseServerClient,
  SupabasePersistence,
} from "../../src/supabase-persistence.ts";
import { SupabaseSessions } from "../../src/supabase-sessions.ts";
import {
  SupabaseModeration,
  schoolModerationApi,
} from "../../src/school-moderation.ts";
import { schoolGatewayPolicy } from "../../src/school-admission.ts";
import { createGateway } from "../../../../games/voxel/src/server/gateway.ts";
import { SocketProbe } from "../../../../games/voxel/tests/fixtures/socket-probe.ts";
import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { PostgresTestDatabase, literal } from "../helpers/postgres.ts";
const db = new PostgresTestDatabase();
db.installSessionControls();
after(() => db.close());
function fixture() {
  const room = db.session(),
    host = randomUUID(),
    peer = randomUUID(),
    teacher = randomUUID(),
    admin = randomUUID(),
    game = randomUUID();
  db.exec(`INSERT INTO public.games(id,game_url) VALUES(${literal(game)},'minecraft');
    INSERT INTO public.kid_profiles(id,full_name,gender,grade,role) VALUES
    (${literal(host)},'Host','boy','ג','kid'),(${literal(peer)},'Peer','boy','ד','kid'),(${literal(teacher)},'Teacher','girl',NULL,'teacher');
    INSERT INTO public.admin_profiles VALUES(${literal(admin)});
    UPDATE public.game_sessions SET game_id=${literal(game)},host_id=${literal(host)},gender='boy',status='playing',
      player_ids=ARRAY[${literal(host)},${literal(peer)}]::uuid[],player_names=ARRAY['Host','Peer'] WHERE id=${literal(room)}`);
  const lease = db.rpc("voxel_acquire_room", {
    p_session: room,
    p_owner: randomUUID(),
  });
  const own = {
    p_session: room,
    p_world: lease.worldId,
    p_owner: lease.owner,
    p_epoch: lease.epoch,
  };
  assert.equal(db.rpc("voxel_initialize_session", own), true);
  const moderate = (
    action = "remove",
    target = host,
    id = randomUUID(),
    actor = teacher,
    until = Date.now() + 4500,
  ) =>
    db.rpc("voxel_moderate", {
      p_session: room,
      p_request: id,
      p_actor: actor,
      p_target: target,
      p_action: action,
      p_authorized_until: new Date(until).toISOString(),
    });
  const accept = (revision: number, actor = host) =>
    db.rpc("voxel_accept_member_revision", {
      ...own,
      p_actor: actor,
      p_revision: revision,
      p_authorized_until: new Date(Date.now() + 4500).toISOString(),
    });
  const policy = () =>
    db.rpc("voxel_actor_policy", { p_session: room, p_actor: host });
  const project = (sequence: number) =>
    db.rpc("voxel_project_session", {
      ...own,
      p_sequence: sequence,
      p_state: "playing",
      p_participants: [host, peer],
    });
  return {
    room,
    host,
    peer,
    teacher,
    admin,
    own,
    moderate,
    accept,
    policy,
    project,
  };
}
test("SQL removal commits one access boundary and audit, fences old acceptance/presence and permits an explicit fresh rejoin", () => {
  const f = fixture(),
    id = randomUUID();
  assert.deepEqual(f.policy(), {
    revision: 0,
    acceptedRevision: 0,
    banned: false,
  });
  assert.equal(f.project(1), true);
  const first = f.moderate("remove", f.host, id);
  assert.deepEqual(first, {
    requestId: id,
    action: "remove",
    target: f.host,
    revision: 1,
    banned: false,
    current: true,
    applied: true,
  });
  assert.equal("saved" in first, false);
  assert.deepEqual(
    db.value(
      `SELECT connected_player_ids FROM public.game_sessions WHERE id=${literal(f.room)}`,
    ),
    [f.peer],
  );
  assert.equal(f.project(2), true);
  assert.deepEqual(
    db.value(
      `SELECT connected_player_ids FROM public.game_sessions WHERE id=${literal(f.room)}`,
    ),
    [f.peer],
  );
  assert.equal(f.accept(0), false);
  assert.equal(f.accept(1), true);
  assert.deepEqual(f.policy(), {
    revision: 1,
    acceptedRevision: 1,
    banned: false,
  });
  assert.deepEqual(f.moderate("remove", f.host, id), first);
  assert.deepEqual(f.policy(), {
    revision: 1,
    acceptedRevision: 1,
    banned: false,
  });
  assert.equal(f.project(3), true);
  assert.deepEqual(
    db.value(
      `SELECT connected_player_ids FROM public.game_sessions WHERE id=${literal(f.room)}`,
    ),
    [f.host, f.peer],
  );
  assert.equal(
    db.value(
      `SELECT count(*) FROM public.audit_log WHERE entity_id=${literal(f.room)}`,
    ),
    1,
  );
  assert.throws(() => f.moderate("ban", f.host, id), /conflict/);
});
test("SQL ban survives an expired owner and denies matching-generation admission and child-host controls until explicit unban and rejoin", () => {
  const f = fixture(),
    id = randomUUID();
  db.exec(
    `UPDATE public.voxel_worlds SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE session_id=${literal(f.room)}`,
  );
  assert.equal(f.moderate("ban", f.host, id).banned, true);
  assert.deepEqual(f.policy(), {
    revision: 1,
    acceptedRevision: 0,
    banned: true,
  });
  // Restore only the fixture owner lease to isolate the admission/host ban check.
  db.exec(
    `UPDATE public.voxel_worlds SET lease_expires_at=clock_timestamp()+interval '20 seconds' WHERE session_id=${literal(f.room)}`,
  );
  assert.equal(f.accept(1), false);
  assert.throws(
    () =>
      db.rpc("voxel_begin_control", {
        ...f.own,
        p_actor: f.host,
        p_request: randomUUID(),
        p_action: "pause",
        p_authorized_until: new Date(Date.now() + 4500).toISOString(),
      }),
    /forbidden/,
  );
  assert.equal(f.moderate("unban", f.host).revision, 2);
  assert.deepEqual(f.policy(), {
    revision: 2,
    acceptedRevision: 0,
    banned: false,
  });
  assert.equal(f.moderate("ban", f.host, id).current, false);
  assert.equal(f.accept(1), false);
  assert.equal(f.accept(2), true);
  assert.deepEqual(f.policy(), {
    revision: 2,
    acceptedRevision: 2,
    banned: false,
  });
});
test("SQL moderation requires fresh staff, cannot target staff and is inaccessible to browser roles or direct service table reads", () => {
  const f = fixture();
  assert.throws(
    () => f.moderate("ban", f.peer, randomUUID(), f.host),
    /forbidden/,
  );
  assert.throws(
    () => f.moderate("ban", f.teacher, randomUUID(), f.admin),
    /target forbidden/,
  );
  db.exec(
    `INSERT INTO public.admin_profiles VALUES(${literal(f.teacher)});UPDATE public.kid_profiles SET is_active=false WHERE id=${literal(f.teacher)}`,
  );
  assert.throws(() => f.moderate(), /forbidden/);
  assert.equal(f.moderate("ban", f.host, randomUUID(), f.admin).banned, true);
  for (const role of ["anon", "authenticated"])
    assert.throws(
      () =>
        db.rpc(
          "voxel_actor_policy",
          { p_session: f.room, p_actor: f.host },
          role,
        ),
      /permission denied/,
    );
  assert.throws(
    () => db.exec("SELECT * FROM public.voxel_actor_access", "service_role"),
    /permission denied/,
  );
  assert.throws(
    () =>
      db.exec("SELECT * FROM public.voxel_moderation_commands", "service_role"),
    /permission denied/,
  );
});
test("SQL moderation rechecks proof expiry after session and audit waits and rolls back every policy/audit boundary", async () => {
  const f = fixture(),
    key = Math.floor(Math.random() * 1_000_000) + 1;
  const lock = db.execAsync(
    `BEGIN;SELECT id FROM public.game_sessions WHERE id=${literal(f.room)} FOR UPDATE;SELECT pg_advisory_xact_lock(${key});SELECT pg_sleep(0.2);COMMIT;`,
  );
  await db.waitForAdvisory(key);
  await assert.rejects(
    db.rpcAsync("voxel_moderate", {
      p_session: f.room,
      p_actor: f.teacher,
      p_target: f.host,
      p_request: randomUUID(),
      p_action: "ban",
      p_authorized_until: new Date(Date.now() + 80).toISOString(),
    }),
    /expired/,
  );
  await lock;
  db.exec(`CREATE FUNCTION public.slow_moderation_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(0.15);RETURN NEW;END $$;
    CREATE TRIGGER slow_moderation_audit BEFORE INSERT ON public.audit_log FOR EACH ROW EXECUTE FUNCTION public.slow_moderation_audit();`);
  assert.throws(
    () => f.moderate("ban", f.host, randomUUID(), f.teacher, Date.now() + 80),
    /expired/,
  );
  assert.deepEqual(f.policy(), {
    revision: 0,
    acceptedRevision: 0,
    banned: false,
  });
  assert.equal(
    db.value(
      `SELECT count(*) FROM public.audit_log WHERE entity_id=${literal(f.room)}`,
    ),
    0,
  );
  assert.equal(
    db.value(
      `SELECT count(*) FROM public.voxel_moderation_commands WHERE session_id=${literal(f.room)}`,
    ),
    0,
  );
});

test("lifting an already absent ban does not revoke a current admission or rotate unrelated tickets", () => {
  const f = fixture();
  assert.equal(f.moderate("unban", f.host).revision, 0);
  assert.deepEqual(f.policy(), {
    revision: 0,
    acceptedRevision: 0,
    banned: false,
  });
  assert.equal(f.accept(0), true);
  assert.equal(f.moderate("remove", f.host).revision, 1);
  assert.equal(f.accept(1), true);
  assert.equal(f.moderate("unban", f.host).revision, 1);
  assert.deepEqual(f.policy(), {
    revision: 1,
    acceptedRevision: 1,
    banned: false,
  });
  assert.equal(
    db.value(
      `SELECT voxel_roster_revision FROM public.game_sessions WHERE id=${literal(f.room)}`,
    ),
    1,
  );
  assert.equal(
    db.rpc("voxel_begin_control", {
      ...f.own,
      p_actor: f.host,
      p_request: randomUUID(),
      p_action: "pause",
      p_authorized_until: new Date(Date.now() + 4500).toISOString(),
    }).completed,
    false,
  );
});

test("real SDK/SQL/worker moderation rejects child-host commands, disconnects old admissions and safely replays after remove/ban/unban and explicit rejoin", async () => {
  const f = fixture();
  db.rpc("voxel_release_room", f.own);
  const wire = await supabaseWire(db),
    client = createSupabaseServerClient({
      SUPABASE_URL: wire.origin,
      SUPABASE_SECRET_KEY: wire.secret,
    });
  const school = schoolSqlFixture(db, f.room, [
      f.host,
      f.peer,
      f.teacher,
      f.admin,
    ]),
    backend = new SupabasePersistence(client),
    sessions = new SupabaseSessions(client),
    moderation = new SupabaseModeration(client);
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
    persistence: { objects: backend, metadata: backend },
    api: schoolModerationApi(school.access, moderation, () => {}),
  });
  assert.ok(gateway.address && typeof gateway.address === "object");
  const origin = `http://127.0.0.1:${gateway.address.port}`,
    probes: SocketProbe[] = [];
  const post = (path: string, actor: string, body: unknown) =>
    fetch(origin + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + school.token(actor),
      },
      body: JSON.stringify(body),
    });
  const admit = (actor: string) =>
    post("/api/voxel/admission", actor, { room: f.room });
  const connectTicket = async (ticket: any) => {
    const p = new SocketProbe(
      origin.replace(/^http/, "ws") + "/voxel",
      content.blocks.length,
    );
    probes.push(p);
    await once(p.socket, "open");
    p.send({ type: "hello", ...ticket });
    return p;
  };
  const connect = async (actor: string) => {
    const response = await admit(actor);
    assert.equal(response.status, 200);
    const p = await connectTicket(await response.json());
    await p.ready();
    return p;
  };
  const apply = (action: string, id = randomUUID(), actor = f.teacher) =>
    post("/api/voxel/moderation", actor, {
      room: f.room,
      requestId: id,
      target: f.host,
      action,
    });
  try {
    await moderation.verifyInstallation();
    assert.equal((await apply("ban", randomUUID(), f.host)).status, 403);
    assert.equal(gateway.rooms.size, 0);
    const view = await post("/api/voxel/moderation-targets", f.teacher, {
      room: f.room,
    });
    assert.equal(view.status, 200);
    assert.equal((await view.json()).targets.length, 2);
    assert.equal(gateway.rooms.size, 0);
    assert.equal(
      (await post("/api/voxel/moderation-targets", f.host, { room: f.room }))
        .status,
      403,
    );
    await connect(f.peer);
    await connect(f.teacher);
    const child = await connect(f.host);
    const stale = await (await admit(f.host)).json();
    wire.control.loseModerationResponse = true;
    const removeId = randomUUID(),
      closed = once(child.socket, "close");
    const uncertain = await apply("remove", removeId);
    assert.equal(uncertain.status, 503);
    assert.equal((await uncertain.json()).error, "MODERATION_UNCONFIRMED");
    const removed = await apply("remove", removeId);
    assert.equal(removed.status, 200);
    const receipt = await removed.json();
    assert.equal(receipt.applied, true);
    assert.equal(receipt.saved, false);
    assert.equal(receipt.revision, 1);
    assert.equal((await closed)[0], 1008);
    const old = await connectTicket(stale);
    assert.equal((await old.event("error")).code, "UNAUTHORIZED");
    const fresh = await connect(f.host);
    assert.deepEqual(await (await apply("remove", removeId)).json(), receipt);
    assert.equal(gateway.rooms.get(f.room)!.connections.size, 3);
    const preBan = await (await admit(f.host)).json(),
      banId = randomUUID(),
      banned = once(fresh.socket, "close");
    assert.equal((await apply("ban", banId)).status, 200);
    assert.equal((await banned)[0], 1008);
    const denied = await admit(f.host);
    assert.equal(denied.status, 403);
    assert.equal((await denied.json()).error, "BANNED");
    const unban = await apply("unban", randomUUID(), f.admin);
    assert.equal(unban.status, 200);
    assert.equal((await unban.json()).banned, false);
    const staleAfterUnban = await connectTicket(preBan);
    assert.equal((await staleAfterUnban.event("error")).code, "UNAUTHORIZED");
    await connect(f.host);
    const replay = await apply("ban", banId);
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).current, false);
    assert.equal(gateway.rooms.get(f.room)!.connections.size, 3);
    assert.equal(
      db.value(
        `SELECT count(*) FROM public.audit_log WHERE entity_id=${literal(f.room)} AND action LIKE 'VOXEL_%'`,
      ),
      3,
    );
    const targets = await (
      await post("/api/voxel/moderation-targets", f.teacher, { room: f.room })
    ).json();
    assert.equal(
      targets.targets.find((r: any) => r.id === f.host).pendingReadmission,
      false,
    );
  } finally {
    for (const p of probes) p.socket.terminate();
    await gateway.close();
    await wire.close();
  }
});

test("a staff ban on a never-allocated room creates guarded metadata without an owner or world save", () => {
  const f = fixture();
  db.exec(
    `DELETE FROM public.voxel_worlds WHERE session_id=${literal(f.room)}`,
  );
  assert.equal(f.moderate("ban").banned, true);
  assert.equal(
    db.value(
      `SELECT count(*) FROM public.voxel_worlds WHERE session_id=${literal(f.room)} AND owner_id IS NULL AND checkpoint_sequence=0`,
    ),
    1,
  );
  assert.throws(
    () =>
      db.exec(
        `UPDATE public.game_sessions SET voxel_roster_revision=0 WHERE id=${literal(f.room)}`,
        "authenticated",
      ),
    /authoritative service/,
  );
});
