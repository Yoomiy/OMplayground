import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { PostgresTestDatabase, literal } from "../helpers/postgres.ts";
const db = new PostgresTestDatabase();
db.installSessionControls();
after(() => db.close());
const until = () => new Date(Date.now() + 4500).toISOString();
function fixture() {
  const room = db.session(),
    kid = randomUUID(),
    peer = randomUUID(),
    teacher = randomUUID(),
    admin = randomUUID(),
    game = randomUUID();
  db.exec(`INSERT INTO public.games(id,game_url) VALUES(${literal(game)},'minecraft');
    INSERT INTO public.kid_profiles(id,full_name,gender,grade,role) VALUES
    (${literal(kid)},'Kid','boy','ג','kid'),(${literal(peer)},'Peer','boy','ג','kid'),(${literal(teacher)},'Teacher','boy',NULL,'teacher');
    INSERT INTO public.admin_profiles VALUES(${literal(admin)});
    UPDATE public.game_sessions SET game_id=${literal(game)},host_id=${literal(kid)},gender='boy',status='playing',
      player_ids=ARRAY[${literal(kid)},${literal(peer)},${literal(teacher)}]::uuid[],player_names=ARRAY['Kid','Peer','Teacher'] WHERE id=${literal(room)}`);
  const lease = db.rpc("voxel_acquire_room", {
      p_session: room,
      p_owner: randomUUID(),
    }),
    own = {
      p_session: room,
      p_world: lease.worldId,
      p_owner: lease.owner,
      p_epoch: lease.epoch,
    };
  assert.equal(db.rpc("voxel_initialize_session", own), true);
  const proof = (
    actor = kid,
    revision: number | null = null,
    participation = "participant",
  ) => ({
    ...own,
    p_actor: actor,
    p_revision: 0,
    p_participation: participation,
    p_media_revision: revision,
    p_authorized_until: until(),
  });
  const authorize = (
    actor = kid,
    revision: number | null = null,
    participation = "participant",
  ) => db.rpc("voxel_media_authorize", proof(actor, revision, participation));
  const command = (
    action = "mute",
    target: string | null = kid,
    id = randomUUID(),
    actor = teacher,
  ) => ({
    p_session: room,
    p_actor: actor,
    p_request: id,
    p_target: target,
    p_action: action,
    p_authorized_until: until(),
  });
  const moderate = (
    action = "mute",
    target: string | null = kid,
    id = randomUUID(),
    actor = teacher,
  ) => db.rpc("voxel_media_moderate", command(action, target, id, actor));
  const state = (actor = teacher) =>
    db.rpc("voxel_media_state", {
      p_session: room,
      p_actor: actor,
      p_authorized_until: until(),
    });
  return {
    room,
    kid,
    peer,
    teacher,
    admin,
    game,
    own,
    proof,
    authorize,
    command,
    moderate,
    state,
  };
}
test("media authority binds live owner and accepted participant; hidden staff remain listen-only and paused media works", () => {
  const f = fixture();
  assert.deepEqual(f.authorize(), {
    revision: 0,
    cutoff: 0,
    publish: true,
    hidden: false,
  });
  assert.deepEqual(f.authorize(f.teacher, null, "observer"), {
    revision: 0,
    cutoff: 0,
    publish: false,
    hidden: true,
  });
  assert.deepEqual(f.authorize(f.admin, null, "observer"), {
    revision: 0,
    cutoff: 0,
    publish: false,
    hidden: true,
  });
  assert.equal(f.authorize(f.teacher).publish, true);
  assert.throws(() => f.authorize(f.kid, null, "observer"), /forbidden/);
  assert.throws(() => f.authorize(f.admin), /forbidden/);
  db.exec(
    `UPDATE public.voxel_session_controls SET desired_state='paused' WHERE session_id=${literal(f.room)}`,
  );
  assert.equal(f.authorize().publish, true);
  assert.equal(
    db.value(
      `SELECT count(*) FROM public.voxel_media_policy WHERE session_id=${literal(f.room)}`,
    ),
    0,
  );
  db.rpc("voxel_release_room", f.own);
  assert.throws(() => f.authorize(), /unavailable/);
  db.rpc("voxel_acquire_room", { p_session: f.room, p_owner: randomUUID() });
  assert.throws(() => f.authorize(), /unavailable/);
});
test("mute and unmute fence old cohorts; unrelated commands, no-ops and historical retries preserve later admissions", () => {
  const f = fixture(),
    id = randomUUID(),
    first = f.moderate("mute", f.kid, id);
  assert.equal(first.revision, 1);
  assert.equal(first.persisted, true);
  assert.throws(() => f.authorize(f.kid, 0), /revoked/);
  assert.deepEqual(f.authorize(), {
    revision: 1,
    cutoff: 1,
    publish: false,
    hidden: false,
  });
  assert.equal(f.authorize(f.peer, 0).publish, true);
  const noop = f.moderate();
  assert.equal(noop.revision, 1);
  assert.equal(f.authorize(f.kid, 1).publish, false);
  const peerMute = f.moderate("mute", f.peer);
  assert.equal(peerMute.revision, 2);
  assert.equal(f.authorize(f.kid, 1).publish, false);
  const unmuted = f.moderate("unmute");
  assert.equal(unmuted.revision, 3);
  assert.throws(() => f.authorize(f.kid, 1), /revoked/);
  assert.equal(f.authorize().publish, true);
  const old = f.moderate("mute", f.kid, id);
  assert.equal(old.current, false);
  assert.equal(old.revision, 1);
  assert.equal(f.authorize(f.kid, 3).publish, true);
  assert.equal(f.state().revision, 3);
  assert.throws(() => f.authorize(f.kid, 4), /revoked/);
});
test("global student mute composes with individual policy without muting staff or clearing individual restrictions", () => {
  const f = fixture();
  f.moderate();
  const global = f.moderate("mute", null);
  assert.equal(global.revision, 2);
  assert.equal(f.authorize(f.peer).publish, false);
  assert.throws(() => f.authorize(f.peer, 0), /revoked/);
  assert.equal(f.authorize(f.teacher, 0).publish, true);
  assert.equal(f.authorize(f.teacher, 0, "observer").hidden, true);
  f.moderate("unmute", null);
  assert.equal(f.authorize(f.peer).publish, true);
  assert.equal(f.authorize().publish, false);
  const state = f.state();
  assert.equal(state.allMuted, false);
  assert.equal(
    state.targets.find((v: any) => v.id === f.kid).effectiveMuted,
    true,
  );
  assert(!state.targets.some((v: any) => v.id === f.teacher));
  assert.throws(() => f.moderate("mute", f.teacher), /target forbidden/);
  assert.throws(() => f.state(f.kid), /forbidden/);
});
test("media commands audit exactly once, reject request substitution and serialize concurrent target changes", async () => {
  const f = fixture(),
    id = randomUUID(),
    first = f.moderate("mute", null, id);
  assert.deepEqual(f.moderate("mute", null, id), first);
  assert.throws(() => f.moderate("unmute", null, id), /conflict/);
  assert.throws(() => f.moderate("mute", f.kid, id), /conflict/);
  assert.throws(() => f.moderate("mute", null, id, f.admin), /conflict/);
  assert.equal(
    db.value(
      `SELECT count(*) FROM public.audit_log WHERE entity_id=${literal(f.room)}`,
    ),
    1,
  );
  const changed = await Promise.all([
    db.rpcAsync("voxel_media_moderate", f.command()),
    db.rpcAsync("voxel_media_moderate", f.command("mute", f.peer)),
  ]);
  assert.deepEqual(changed.map((v) => v.revision).sort(), [2, 3]);
  assert.equal(f.state().revision, 3);
  assert.equal(
    db.value(
      `SELECT count(*) FROM public.audit_log WHERE entity_id=${literal(f.room)}`,
    ),
    3,
  );
  assert.equal(
    db.value(
      `SELECT voxel_roster_revision FROM public.game_sessions WHERE id=${literal(f.room)}`,
    ),
    0,
  );
});
test("offline and never-owned media policy needs no worker/lease/presence and staff reads do not allocate metadata", () => {
  const f = fixture(),
    room = db.session();
  db.exec(
    `UPDATE public.game_sessions SET game_id=${literal(f.game)},gender='boy' WHERE id=${literal(room)}`,
  );
  const state = {
    p_session: room,
    p_actor: f.teacher,
    p_authorized_until: until(),
  };
  assert.deepEqual(db.rpc("voxel_media_state", state), {
    revision: 0,
    allMuted: false,
    targets: [],
  });
  assert.equal(
    db.value(
      `SELECT count(*) FROM public.voxel_worlds WHERE session_id=${literal(room)}`,
    ),
    0,
  );
  assert.throws(
    () =>
      db.rpc("voxel_media_moderate", {
        ...f.command("mute", null),
        p_session: room,
        p_actor: f.kid,
      }),
    /forbidden/,
  );
  assert.equal(
    db.value(
      `SELECT count(*) FROM public.voxel_worlds WHERE session_id=${literal(room)}`,
    ),
    0,
  );
  const result = db.rpc("voxel_media_moderate", {
    ...f.command("mute", null),
    p_session: room,
  });
  assert.equal(result.revision, 1);
  assert.equal(
    db.value(
      `SELECT owner_id FROM public.voxel_worlds WHERE session_id=${literal(room)}`,
    ),
    null,
  );
  assert.equal(
    db.value(
      `SELECT cardinality(connected_player_ids) FROM public.game_sessions WHERE id=${literal(room)}`,
    ),
    0,
  );
  assert.equal(
    db.rpc("voxel_media_state", { ...state, p_authorized_until: until() })
      .allMuted,
    true,
  );
});
test("media repeats fresh school precedence, admission cutoff and terminal authorization inside the SQL locks", () => {
  const f = fixture();
  db.exec(
    `INSERT INTO public.admin_profiles VALUES(${literal(f.teacher)});UPDATE public.kid_profiles SET is_active=false WHERE id=${literal(f.teacher)}`,
  );
  assert.throws(() => f.moderate(), /forbidden/);
  assert.throws(() => f.authorize(f.teacher, null, "observer"), /forbidden/);
  db.exec(
    `UPDATE public.kid_profiles SET is_active=true WHERE id=${literal(f.teacher)}`,
  );
  db.rpc("voxel_moderate", {
    p_session: f.room,
    p_actor: f.teacher,
    p_target: f.kid,
    p_request: randomUUID(),
    p_action: "remove",
    p_authorized_until: until(),
  });
  assert.throws(() => f.authorize(), /forbidden/);
  assert.equal(
    db.rpc("voxel_accept_member_revision", {
      ...f.own,
      p_actor: f.kid,
      p_revision: 1,
      p_authorized_until: until(),
    }),
    true,
  );
  assert.throws(() => f.authorize(), /forbidden/);
  assert.equal(
    db.rpc("voxel_media_authorize", { ...f.proof(), p_revision: 1 }).publish,
    true,
  );
  const id = randomUUID();
  f.moderate("mute", null, id);
  db.exec(
    `UPDATE public.game_sessions SET status='completed' WHERE id=${literal(f.room)}`,
  );
  assert.throws(
    () => db.rpc("voxel_media_authorize", { ...f.proof(), p_revision: 1 }),
    /unavailable/,
  );
  assert.throws(() => f.moderate("unmute", null), /ended/);
  assert.equal(f.moderate("mute", null, id).persisted, true);
  assert.equal(f.state().allMuted, true);
  db.exec(
    `UPDATE public.games SET is_active=false WHERE id=${literal(f.game)}`,
  );
  assert.throws(() => f.state(), /forbidden/);
});
test("media tables and helpers are private; browser roles cannot call any media API", () => {
  const f = fixture();
  assert.deepEqual(db.rpc("voxel_media_status", {}), {
    schema: 1,
    revisionFencing: true,
  });
  for (const role of ["anon", "authenticated", "service_role"]) {
    for (const table of [
      "voxel_media_policy",
      "voxel_media_actors",
      "voxel_media_commands",
    ])
      assert.throws(
        () => db.exec(`SELECT * FROM public.${table}`, role),
        /permission denied/,
      );
    assert.throws(
      () =>
        db.exec(
          `SELECT public.voxel_media_scope(${literal(f.room)},${literal(f.teacher)},clock_timestamp()+interval '1 second')`,
          role,
        ),
      /permission denied/,
    );
    assert.throws(
      () =>
        db.exec(
          `SELECT public.voxel_media_receipt(${literal(f.room)},${literal(randomUUID())},${literal(f.teacher)})`,
          role,
        ),
      /permission denied/,
    );
  }
  for (const role of ["anon", "authenticated"]) {
    assert.throws(
      () => db.rpc("voxel_media_status", {}, role),
      /permission denied/,
    );
    assert.throws(
      () => db.rpc("voxel_media_authorize", f.proof(), role),
      /permission denied/,
    );
    assert.throws(
      () => db.rpc("voxel_media_moderate", f.command(), role),
      /permission denied/,
    );
    assert.throws(
      () =>
        db.rpc(
          "voxel_media_state",
          {
            p_session: f.room,
            p_actor: f.teacher,
            p_authorized_until: until(),
          },
          role,
        ),
      /permission denied/,
    );
  }
});
test("expired lock/audit waits roll back policy and audit; redundant unmute preserves a valid generation", async () => {
  const f = fixture(),
    key = Math.floor(Math.random() * 1e6) + 1;
  const lock = db.execAsync(
    `BEGIN;SELECT id FROM public.game_sessions WHERE id=${literal(f.room)} FOR UPDATE;SELECT pg_advisory_xact_lock(${key});SELECT pg_sleep(0.2);COMMIT;`,
  );
  await db.waitForAdvisory(key);
  await assert.rejects(
    db.rpcAsync("voxel_media_authorize", {
      ...f.proof(),
      p_authorized_until: new Date(Date.now() + 80).toISOString(),
    }),
    /forbidden|expired/,
  );
  await lock;
  db.exec(`CREATE FUNCTION public.slow_media_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(0.15);RETURN NEW;END $$;
    CREATE TRIGGER slow_media_audit BEFORE INSERT ON public.audit_log FOR EACH ROW EXECUTE FUNCTION public.slow_media_audit();`);
  try {
    await assert.rejects(
      db.rpcAsync("voxel_media_moderate", {
        ...f.command(),
        p_authorized_until: new Date(Date.now() + 80).toISOString(),
      }),
      /expired/,
    );
    assert.equal(f.state().revision, 0);
    assert.equal(
      db.value(
        `SELECT count(*) FROM public.audit_log WHERE entity_id=${literal(f.room)}`,
      ),
      0,
    );
  } finally {
    db.exec(
      "DROP TRIGGER slow_media_audit ON public.audit_log;DROP FUNCTION public.slow_media_audit()",
    );
  }
  assert.equal(f.moderate("unmute").revision, 0);
  assert.equal(f.authorize(f.kid, 0).publish, true);
  const old = f.proof();
  assert.throws(
    () =>
      db.rpc("voxel_media_authorize", {
        ...old,
        p_authorized_until: new Date(Date.now() + 6000).toISOString(),
      }),
    /forbidden/,
  );
});
