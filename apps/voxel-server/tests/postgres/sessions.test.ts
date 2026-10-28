import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { PostgresTestDatabase, literal } from "../helpers/postgres.ts";
import { supabaseWire } from "../helpers/supabase-wire.ts";
import { schoolSqlFixture } from "../helpers/school-sql-fixture.ts";
import {
  createSupabaseServerClient,
  SupabasePersistence,
} from "../../src/supabase-persistence.ts";
import { SupabaseSessions } from "../../src/supabase-sessions.ts";
import { createGateway } from "../../../../games/voxel/src/server/gateway.ts";
import { SchoolAccess } from "../../src/school-access.ts";
import { schoolGatewayPolicy } from "../../src/school-admission.ts";
import { once } from "node:events";
import { SocketProbe } from "../../../../games/voxel/tests/fixtures/socket-probe.ts";
import type { RoomLease } from "../../../../games/voxel/src/server/checkpoint-storage.ts";
const db = new PostgresTestDatabase();
db.installSessionControls();
after(() => db.close());
const owner = (lease: RoomLease) => ({
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
    wrong = randomUUID(),
    game = randomUUID();
  db.exec(`INSERT INTO public.games(id,game_url) VALUES(${literal(game)},'minecraft');
    INSERT INTO public.kid_profiles(id,full_name,gender,grade,role) VALUES
    (${literal(host)},'Host','boy','ג','kid'),(${literal(guest)},'Guest','boy','ד','kid'),
    (${literal(teacher)},'Hidden teacher','girl',NULL,'teacher'),(${literal(wrong)},'Wrong partition','girl','ג','kid');
    UPDATE public.game_sessions SET game_id=${literal(game)},host_id=${literal(host)},host_name='Host',host_grade='ג',gender='boy',player_ids=ARRAY[${literal(host)}]::uuid[],player_names=ARRAY['Host'] WHERE id=${literal(room)}`);
  const lease: RoomLease = db.rpc("voxel_acquire_room", {
    p_session: room,
    p_owner: randomUUID(),
  });
  assert.equal(db.rpc("voxel_initialize_session", owner(lease)), true);
  return { room, host, guest, teacher, wrong, lease };
}
const view = (room: string) =>
  db.value(
    `SELECT to_jsonb(s) FROM public.game_sessions s WHERE id=${literal(room)}`,
  );
const project = (lease: RoomLease, seq: number, state: string, ids: string[]) =>
  db.rpc("voxel_project_session", {
    ...owner(lease),
    p_sequence: seq,
    p_state: state,
    p_participants: ids,
  });

test("fresh school admission distinguishes an empty presence projection from deliberate SQL pause intent", async () => {
  const f = fixture(),
    school = schoolSqlFixture(db, f.room, [f.host, f.guest, f.teacher]);
  assert.equal(project(f.lease, 1, "paused", []), true);
  assert.equal(view(f.room).status, "paused");
  assert.equal(
    (await school.access.authorize(school.token(f.guest), { room: f.room }))
      .actor.id,
    f.guest,
  );
  assert(school.calls.includes("voxel_session_policy"));
  db.exec(
    `UPDATE public.voxel_session_controls SET desired_state='paused' WHERE session_id=${literal(f.room)}`,
  );
  await assert.rejects(
    school.access.authorize(school.token(f.guest), { room: f.room }),
    { code: "PAUSED_ROSTER" },
  );
  await school.access.authorize(school.token(f.host), { room: f.room });
  await school.access.authorize(school.token(f.teacher), { room: f.room });
});

test("SDK projection persists accepted membership and derives aligned presence/names and host reassignment without exposing staff", async () => {
  const f = fixture(),
    wire = await supabaseWire(db);
  const client = createSupabaseServerClient({
      SUPABASE_URL: wire.origin,
      SUPABASE_SECRET_KEY: wire.secret,
    }),
    sessions = new SupabaseSessions(client);
  try {
    const actor = (
      id: string,
      role: "participant" | "observer" = "participant",
    ) => ({
      id,
      role,
      capabilities: {
        build: role === "participant",
        fly: true,
        observe: role === "observer",
        combat: role === "participant",
        explosives: role === "participant",
      },
    });
    await sessions.verifyInstallation();
    await sessions.accept(f.lease, actor(f.guest), {
      expiresAt: Date.now() + 4500,
      membershipRevision: 0,
    });
    await sessions.accept(f.lease, actor(f.guest), {
      expiresAt: Date.now() + 4500,
      membershipRevision: 0,
    });
    await sessions.accept(f.lease, actor(f.teacher, "observer"), {
      expiresAt: Date.now() + 4500,
      membershipRevision: 0,
    });
    await assert.rejects(
      sessions.accept(f.lease, actor(f.wrong), {
        expiresAt: Date.now() + 4500,
        membershipRevision: 0,
      }),
    );
    assert.deepEqual(view(f.room).player_ids, [f.host, f.guest]);
    assert.equal(
      await sessions.project(f.lease, 1, {
        state: "playing",
        participants: [f.guest, f.guest, f.teacher, f.wrong],
      }),
      true,
    );
    let s = view(f.room);
    assert.deepEqual(s.connected_player_ids, [f.guest]);
    assert.deepEqual(s.connected_player_names, ["Guest"]);
    assert.equal(s.host_id, f.guest);
    assert.equal(s.host_name, "Guest");
    assert.equal(s.host_grade, "ד");
    assert.equal(s.status, "playing");
    assert.ok(Date.parse(s.voxel_presence_expires_at) > Date.now());
    assert.equal(
      await sessions.project(f.lease, 2, { state: "paused", participants: [] }),
      true,
    );
    s = view(f.room);
    assert.equal(s.status, "paused");
    assert.deepEqual(s.player_ids, [f.host, f.guest]);
    assert.equal(s.voxel_presence_expires_at, null);
    assert.equal(
      (await sessions.roomPolicy(f.room)).state,
      "playing",
      "projected pause does not become pause intent",
    );
    assert.equal(
      await sessions.project(f.lease, 3, {
        state: "playing",
        participants: [f.host],
      }),
      true,
    );
    assert.equal(view(f.room).status, "playing");
  } finally {
    await wire.close();
  }
});

test("out-of-order, expired, released and replaced owner projections cannot overwrite newer state; completion is irreversible", () => {
  const f = fixture();
  assert.equal(project(f.lease, 3, "playing", [f.host]), true);
  assert.equal(project(f.lease, 2, "paused", []), false);
  db.rpc("voxel_release_room", owner(f.lease));
  assert.equal(project(f.lease, 4, "paused", []), false);
  const next: RoomLease = db.rpc("voxel_acquire_room", {
    p_session: f.room,
    p_owner: randomUUID(),
  });
  assert.equal(db.rpc("voxel_initialize_session", owner(next)), true);
  assert.equal(project(next, 1, "playing", [f.host]), true);
  assert.equal(project(f.lease, 999, "ended", []), false);
  assert.equal(view(f.room).status, "playing");
  assert.equal(project(next, 2, "ended", [f.host]), true);
  assert.equal(project(next, 3, "playing", [f.host]), true);
  assert.equal(view(f.room).status, "completed");
  assert.deepEqual(view(f.room).connected_player_ids, []);
  assert.equal(db.rpc("voxel_initialize_session", owner(next)), false);
  assert.equal(
    db.rpc("voxel_session_policy", { p_session: f.room }).state,
    "ended",
  );
});

test("database checks lease expiry after row-lock wait and pause intent denies late newcomer acceptance", async () => {
  const f = fixture();
  db.exec(
    `UPDATE public.voxel_session_controls SET desired_state='paused' WHERE session_id=${literal(f.room)}`,
  );
  assert.equal(
    db.rpc("voxel_accept_member_revision", {
      ...owner(f.lease),
      p_actor: f.guest,
      p_revision: 0,
      p_authorized_until: new Date(Date.now() + 4500).toISOString(),
    }),
    false,
  );
  assert.equal(project(f.lease, 1, "playing", [f.host]), true);
  assert.equal(view(f.room).status, "paused");
  const barrier = 31008;
  db.exec(
    `UPDATE public.voxel_worlds SET lease_expires_at=clock_timestamp()+interval '200 milliseconds' WHERE session_id=${literal(f.room)}`,
  );
  const held = db.execAsync(
    `BEGIN;SELECT 1 FROM public.voxel_worlds WHERE session_id=${literal(f.room)} FOR UPDATE; SELECT pg_advisory_lock(${barrier});SELECT pg_sleep(0.45);COMMIT;`,
  );
  await db.waitForAdvisory(barrier);
  const write = db.rpcAsync("voxel_project_session", {
    ...owner(f.lease),
    p_sequence: 2,
    p_state: "playing",
    p_participants: [f.host],
  });
  await held;
  assert.equal(await write, false);
});

test("all session mutations recheck lease expiry after waiting for the platform session row", async () => {
  for (const [index, operation] of [
    "voxel_initialize_session",
    "voxel_accept_member_revision",
    "voxel_project_session",
  ].entries()) {
    const f = fixture(),
      barrier = 31009 + index;
    db.exec(
      `UPDATE public.voxel_worlds SET lease_expires_at=clock_timestamp()+interval '200 milliseconds' WHERE session_id=${literal(f.room)}`,
    );
    const held = db.execAsync(
      `BEGIN;SELECT 1 FROM public.game_sessions WHERE id=${literal(f.room)} FOR UPDATE;SELECT pg_advisory_lock(${barrier});SELECT pg_sleep(0.45);COMMIT;`,
    );
    await db.waitForAdvisory(barrier);
    const args = {
      ...owner(f.lease),
      ...(operation === "voxel_accept_member_revision"
        ? {
            p_actor: f.guest,
            p_revision: 0,
            p_authorized_until: new Date(Date.now() + 4500).toISOString(),
          }
        : operation === "voxel_project_session"
          ? { p_sequence: 1, p_state: "playing", p_participants: [f.host] }
          : {}),
    };
    const result = db.rpcAsync(operation, args);
    await held;
    assert.equal(await result, false, operation);
    assert.deepEqual(view(f.room).player_ids, [f.host]);
    assert.equal(view(f.room).status, "waiting");
  }
});

test("browser roles and browser-invoked legacy definer RPCs cannot write allocated sessions; unrelated sessions retain policy", () => {
  const f = fixture();
  db.exec(
    `CREATE OR REPLACE FUNCTION public.fixture_legacy_pause(p_id uuid) RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$ UPDATE public.game_sessions SET status='playing' WHERE id=p_id $$;GRANT EXECUTE ON FUNCTION public.fixture_legacy_pause(uuid) TO authenticated;`,
  );
  for (const sql of [
    `UPDATE public.game_sessions SET status='playing' WHERE id=${literal(f.room)}`,
    `DELETE FROM public.game_sessions WHERE id=${literal(f.room)}`,
    `SELECT public.fixture_legacy_pause(${literal(f.room)})`,
  ])
    assert.throws(
      () => db.exec(sql, "authenticated"),
      /42501|authoritative service/,
    );
  assert.throws(
    () =>
      db.rpc(
        "voxel_project_session",
        {
          ...owner(f.lease),
          p_sequence: 1,
          p_state: "ended",
          p_participants: [],
        },
        "authenticated",
      ),
    /42501|permission denied/,
  );
  const other = db.session();
  db.exec(
    `UPDATE public.game_sessions SET status='playing' WHERE id=${literal(other)}`,
    "authenticated",
  );
  assert.equal(view(other).status, "playing");
});

test(
  "school SDK/native worker preserve an accepted guest through paused renewal/reconnect, hide staff, reassign host and save empty presence",
  { timeout: 20000 },
  async () => {
    const f = fixture();
    db.rpc("voxel_release_room", owner(f.lease));
    const wire = await supabaseWire(db),
      client = createSupabaseServerClient({
        SUPABASE_URL: wire.origin,
        SUPABASE_SECRET_KEY: wire.secret,
      }),
      backend = new SupabasePersistence(client),
      sessions = new SupabaseSessions(client);
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
      persistence: { metadata: backend, objects: backend },
      ...schoolGatewayPolicy(
        new SchoolAccess(
          createSupabaseServerClient(
            {
              SUPABASE_URL: "https://school-metadata.invalid",
              SUPABASE_SECRET_KEY: "sb_secret_fixture",
            },
            async (input, init) => {
              // Auth/PostgREST transport is a fixture. Its school/session rows below
              // are read fresh from the same real PostgreSQL state written by the SDK.
              const request = new Request(input, init),
                url = new URL(request.url),
                path = url.pathname.split("/").at(-1);
              let data: unknown;
              if (path === "user") {
                const claims = JSON.parse(
                  Buffer.from(
                    request.headers.get("Authorization")!.split(".")[1],
                    "base64url",
                  ).toString("utf8"),
                );
                assert.ok([f.host, f.guest, f.teacher].includes(claims.sub));
                data = {
                  id: claims.sub,
                  aud: "authenticated",
                  role: "authenticated",
                };
              } else if (
                ["voxel_actor_policy", "voxel_session_policy"].includes(path!)
              ) {
                data = db.rpc(
                  path!,
                  (await request.json()) as Record<string, unknown>,
                );
              } else if (path === "game_sessions") {
                assert.equal(url.searchParams.get("id"), "eq." + f.room);
                data = [
                  {
                    ...view(f.room),
                    invitation_code: "fixture-invite",
                    games: { game_url: "minecraft", is_active: true },
                  },
                ];
              } else if (path === "kid_profiles") {
                const id = url.searchParams.get("id")!.slice(3);
                data = db.value(
                  `SELECT coalesce(jsonb_agg(k),'[]'::jsonb) FROM public.kid_profiles k WHERE id=${literal(id)}`,
                );
              } else if (path === "recess_schedules")
                data = Array.from({ length: 7 }, (_, day_of_week) => ({
                  day_of_week,
                  start_time: "00:00:00",
                  end_time: "24:00:00",
                  is_active: true,
                }));
              else if (
                [
                  "admin_profiles",
                  "class_recess_schedule_settings",
                  "class_recess_schedule_exceptions",
                ].includes(path!)
              )
                data = [];
              else throw new Error("unexpected school fixture request");
              return new Response(JSON.stringify(data), {
                headers: { "Content-Type": "application/json" },
              });
            },
          ),
        ),
        sessions,
      ),
    });
    assert.ok(gateway.address && typeof gateway.address === "object");
    const origin = `http://127.0.0.1:${gateway.address.port}`;
    const probes: SocketProbe[] = [];
    const connectAs = async (id: string) => {
      const token = [
        Buffer.from('{"alg":"HS256"}').toString("base64url"),
        Buffer.from(
          JSON.stringify({
            sub: id,
            exp: Math.floor(Date.now() / 1000) + 3600,
          }),
        ).toString("base64url"),
        "fixture_signature",
      ].join(".");
      const response = await fetch(origin + "/api/voxel/admission", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ room: f.room }),
      });
      const ticket = (await response.json()) as {
        ticket: string;
        buildId: string;
      };
      assert.equal(response.status, 200, JSON.stringify(ticket));
      const p = new SocketProbe(
        origin.replace(/^http/, "ws") + "/voxel",
        content.blocks.length,
      );
      probes.push(p);
      await once(p.socket, "open");
      p.send({ type: "hello", ...ticket });
      await p.event("welcome");
      await p.ready();
      return p;
    };
    const until = async (check: () => boolean) => {
      for (let i = 0; i < 100; i++) {
        if (check()) return;
        await delay(30);
      }
      assert.fail("projection did not settle");
    };
    try {
      const host = await connectAs(f.host);
      let guest = await connectAs(f.guest);
      const teacher = await connectAs(f.teacher);
      await until(() => view(f.room).connected_player_ids.length === 2);
      assert.deepEqual(view(f.room).player_ids, [f.host, f.guest]);
      db.exec(
        `UPDATE public.voxel_session_controls SET desired_state='paused' WHERE session_id=${literal(f.room)}`,
      );
      await until(() => view(f.room).status === "paused");
      await delay(2800);
      assert.equal(
        guest.socket.readyState,
        1,
        "accepted guest remains authorized through paused roster renewal",
      );
      guest.socket.close();
      guest = await connectAs(f.guest);
      assert.equal(
        guest.socket.readyState,
        1,
        "a fresh paused reconnect sees committed membership",
      );
      db.exec(
        `UPDATE public.voxel_session_controls SET desired_state='playing' WHERE session_id=${literal(f.room)}`,
      );
      await until(() => view(f.room).status === "playing");
      host.socket.close();
      await until(() => view(f.room).host_id === f.guest);
      assert.deepEqual(view(f.room).connected_player_ids, [f.guest]);
      guest.socket.close();
      await until(
        () =>
          view(f.room).status === "paused" &&
          view(f.room).connected_player_ids.length === 0,
      );
      assert.equal((await sessions.roomPolicy(f.room)).state, "playing");
      teacher.socket.close();
      await until(() => gateway.rooms.size === 0);
      assert.equal(
        db.value(
          `SELECT checkpoint_sequence>0 AND lease_expires_at<=clock_timestamp() FROM public.voxel_worlds WHERE session_id=${literal(f.room)}`,
        ),
        true,
      );
    } finally {
      for (const p of probes) p.socket.close();
      await gateway.close();
      await wire.close();
    }
  },
);
