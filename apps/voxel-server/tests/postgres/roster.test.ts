import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { PostgresTestDatabase, literal } from "../helpers/postgres.ts";
import { schoolSqlFixture } from "../helpers/school-sql-fixture.ts";
import { supabaseWire } from "../helpers/supabase-wire.ts";
import { createSupabaseServerClient } from "../../src/supabase-persistence.ts";
import { schoolRosterApi } from "../../src/school-roster.ts";
import { createGateway } from "../../../../games/voxel/src/server/gateway.ts";
const db = new PostgresTestDatabase();
db.installSessionControls();
after(() => db.close());
function fixture(two = true) {
  const room = db.session(),
    host = randomUUID(),
    guest = randomUUID(),
    outsider = randomUUID(),
    game = randomUUID();
  db.exec(`INSERT INTO public.games(id,game_url) VALUES(${literal(game)},'minecraft');
    INSERT INTO public.kid_profiles(id,full_name,gender,grade) VALUES(${literal(host)},'Host','boy','ג'),(${literal(guest)},'Guest','boy','ד'),(${literal(outsider)},'Outsider','boy','ג');
    UPDATE public.game_sessions SET game_id=${literal(game)},host_id=${literal(host)},host_name='Host',host_grade='ג',gender='boy',status='playing',
      player_ids=ARRAY[${literal(host)}${two ? "," + literal(guest) : ""}]::uuid[],player_names=ARRAY['old host'${two ? ",'old guest'" : ""}] WHERE id=${literal(room)}`);
  const lease = db.rpc("voxel_acquire_room", {
    p_session: room,
    p_owner: randomUUID(),
  });
  assert.equal(
    db.rpc("voxel_initialize_session", {
      p_session: room,
      p_world: lease.worldId,
      p_owner: lease.owner,
      p_epoch: lease.epoch,
    }),
    true,
  );
  return { room, host, guest, outsider, lease };
}
const view = (room: string) =>
  db.value(
    `SELECT to_jsonb(s) FROM public.game_sessions s WHERE id=${literal(room)}`,
  );
const leave = (
  f: ReturnType<typeof fixture>,
  actor = f.host,
  request = randomUUID(),
  until = Date.now() + 4500,
  role = "service_role",
) =>
  db.rpc(
    "voxel_leave_roster",
    {
      p_session: f.room,
      p_actor: actor,
      p_request: request,
      p_authorized_until: new Date(until).toISOString(),
    },
    role,
  );
const accept = (
  f: ReturnType<typeof fixture>,
  revision: number,
  until = Date.now() + 4500,
) =>
  db.rpc("voxel_accept_member_revision", {
    p_session: f.room,
    p_world: f.lease.worldId,
    p_owner: f.lease.owner,
    p_epoch: f.lease.epoch,
    p_actor: f.host,
    p_revision: revision,
    p_authorized_until: new Date(until).toISOString(),
  });

test("self-departure reassigns the host with fresh aligned names and revision-fences old admissions; retry cannot remove a later rejoin", () => {
  const f = fixture(),
    request = randomUUID(),
    receipt = leave(f, f.host, request);
  assert.deepEqual(receipt, {
    requestId: request,
    left: true,
    ended: false,
    revision: 1,
  });
  let s = view(f.room);
  assert.deepEqual(s.player_ids, [f.guest]);
  assert.deepEqual(s.player_names, ["Guest"]);
  assert.equal(s.host_id, f.guest);
  assert.equal(s.host_grade, "ד");
  assert.equal(s.voxel_roster_revision, 1);
  assert.deepEqual(leave(f, f.host, request), receipt);
  assert.throws(() => leave(f, f.guest, request), /conflict/);
  assert.equal(accept(f, 0), false);
  assert.equal(accept(f, 1), true);
  assert.deepEqual(view(f.room).player_ids, [f.guest, f.host]);
  assert.deepEqual(leave(f, f.host, request), receipt);
  assert.deepEqual(view(f.room).player_ids, [f.guest, f.host]);
  assert.throws(
    () =>
      db.rpc("voxel_accept_member", {
        p_session: f.room,
        p_world: f.lease.worldId,
        p_owner: f.lease.owner,
        p_epoch: f.lease.epoch,
        p_actor: f.host,
      }),
    /permission denied/,
  );
  assert.throws(
    () => leave(f, f.guest, randomUUID(), Date.now() + 4500, "authenticated"),
    /permission denied/,
  );
  assert.equal(accept(f, 1, Date.now() - 1), false);
  assert.equal(accept(f, 1, Date.now() + 10000), false);
});

test("connected participants and live last-owner retirement cannot be dismissed; the released empty roster becomes terminal without claiming a save", () => {
  const f = fixture(false),
    request = randomUUID();
  db.exec(
    `UPDATE public.game_sessions SET connected_player_ids=ARRAY[${literal(f.host)}]::uuid[],connected_player_names=ARRAY['Host'],voxel_presence_expires_at=clock_timestamp()+interval '15 seconds' WHERE id=${literal(f.room)}`,
  );
  assert.throws(() => leave(f, f.host, request), /participant connected/);
  db.exec(
    `UPDATE public.game_sessions SET voxel_presence_expires_at=clock_timestamp()-interval '1 second' WHERE id=${literal(f.room)}`,
  );
  assert.throws(() => leave(f, f.host, request), /room retirement pending/);
  assert.equal(view(f.room).voxel_roster_revision, 0);
  db.rpc("voxel_release_room", {
    p_session: f.room,
    p_world: f.lease.worldId,
    p_owner: f.lease.owner,
    p_epoch: f.lease.epoch,
  });
  const receipt = leave(f, f.host, request);
  assert.equal(receipt.ended, true);
  assert.equal("saved" in receipt, false);
  assert.equal(view(f.room).status, "completed");
  assert.deepEqual(view(f.room).player_ids, []);
  assert.equal(
    db.rpc("voxel_session_policy", { p_session: f.room }).state,
    "ended",
  );
  assert.deepEqual(leave(f, f.host, request), receipt);
});

test("departure checks fresh profiles, scope and the database clock after a row-lock wait, with atomic rollback", async () => {
  const f = fixture();
  assert.throws(() => leave(f, f.outsider), /departure denied/);
  assert.throws(
    () => leave(f, f.host, randomUUID(), Date.now() - 1),
    /expired/,
  );
  assert.throws(
    () => leave(f, f.host, randomUUID(), Date.now() + 10000),
    /expired/,
  );
  db.exec(
    `UPDATE public.kid_profiles SET is_active=false WHERE id=${literal(f.host)}`,
  );
  assert.throws(() => leave(f), /departure denied/);
  db.exec(
    `UPDATE public.kid_profiles SET is_active=true WHERE id=${literal(f.host)}`,
  );
  const barrier = 31040,
    held = db.execAsync(
      `BEGIN;SELECT 1 FROM public.game_sessions WHERE id=${literal(f.room)} FOR UPDATE;SELECT pg_advisory_lock(${barrier});SELECT pg_sleep(0.45);COMMIT;`,
    );
  await db.waitForAdvisory(barrier);
  const pending = db.rpcAsync("voxel_leave_roster", {
    p_session: f.room,
    p_actor: f.host,
    p_request: randomUUID(),
    p_authorized_until: new Date(Date.now() + 200).toISOString(),
  });
  const rejected = assert.rejects(pending, /expired/);
  await held;
  await rejected;
  assert.equal(view(f.room).voxel_roster_revision, 0);
  assert.deepEqual(view(f.room).player_ids, [f.host, f.guest]);
});

test("the real SDK/HTTP self-departure route binds the verified subject, rejects forged targets and allocates no worker", async () => {
  const f = fixture(),
    wire = await supabaseWire(db),
    school = schoolSqlFixture(db, f.room, [f.host, f.guest, f.outsider]);
  const client = createSupabaseServerClient({
    SUPABASE_URL: wire.origin,
    SUPABASE_SECRET_KEY: wire.secret,
  });
  const build = JSON.parse(
    readFileSync(
      new URL("../../../../games/voxel/artifacts/build.json", import.meta.url),
      "utf8",
    ),
  );
  const content = JSON.parse(
    readFileSync(
      new URL(
        "../../../../games/voxel/artifacts/content.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const events: unknown[] = [];
  const gateway = await createGateway({
    build,
    content,
    admit: async () => null,
    api: schoolRosterApi(school.access, client, (name, value) =>
      events.push({ name, value }),
    ),
  });
  assert.ok(gateway.address && typeof gateway.address === "object");
  const origin = `http://127.0.0.1:${gateway.address.port}`,
    requestId = randomUUID();
  const post = (actor: string, data: unknown) =>
    fetch(origin + "/api/voxel/leave", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + school.token(actor),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
  try {
    assert.equal(
      (await post(f.host, { room: f.room, requestId, actor: f.guest })).status,
      400,
    );
    assert.equal(
      (await post(f.outsider, { room: f.room, requestId })).status,
      403,
    );
    const result = await post(f.host, { room: f.room, requestId });
    assert.equal(result.status, 200);
    assert.equal((await result.json()).left, true);
    assert.deepEqual(view(f.room).player_ids, [f.guest]);
    assert.equal(gateway.rooms.size, 0);
    assert.doesNotMatch(
      JSON.stringify(events),
      /fixture_signature|sb_secret_|Host|Guest/,
    );
  } finally {
    await gateway.close();
    await wire.close();
  }
});

test("a never-opened roster receives guarded metadata without a worker and browser roles cannot read departure receipts or undo removal", () => {
  const f = fixture();
  db.exec(
    `DELETE FROM public.voxel_worlds WHERE session_id=${literal(f.room)}`,
  );
  assert.equal(leave(f).left, true);
  assert.equal(
    db.value(
      `SELECT owner_id FROM public.voxel_worlds WHERE session_id=${literal(f.room)}`,
    ),
    null,
  );
  assert.throws(
    () =>
      db.exec(
        `UPDATE public.game_sessions SET voxel_roster_revision=0 WHERE id=${literal(f.room)}`,
        "authenticated",
      ),
    /authoritative service/,
  );
  assert.throws(
    () =>
      db.exec(`SELECT * FROM public.voxel_roster_departures`, "authenticated"),
    /permission denied/,
  );
  assert.throws(
    () => leave(f, f.guest, randomUUID(), Date.now() + 4500, "anon"),
    /permission denied/,
  );
});

test("membership acceptance rechecks its own proof expiry after waiting for the session row even with a live owner", async () => {
  const f = fixture(),
    barrier = 31041;
  const held = db.execAsync(
    `BEGIN;SELECT 1 FROM public.game_sessions WHERE id=${literal(f.room)} FOR UPDATE;SELECT pg_advisory_lock(${barrier});SELECT pg_sleep(0.45);COMMIT;`,
  );
  await db.waitForAdvisory(barrier);
  const pending = db.rpcAsync("voxel_accept_member_revision", {
    p_session: f.room,
    p_world: f.lease.worldId,
    p_owner: f.lease.owner,
    p_epoch: f.lease.epoch,
    p_actor: f.outsider,
    p_revision: 0,
    p_authorized_until: new Date(Date.now() + 200).toISOString(),
  });
  await held;
  assert.equal(await pending, false);
  assert.deepEqual(view(f.room).player_ids, [f.host, f.guest]);
});

test("an active child can remove their own old partition membership without gaining cross-partition play authority", () => {
  const f = fixture();
  db.exec(
    `UPDATE public.kid_profiles SET gender='girl' WHERE id=${literal(f.host)}`,
  );
  assert.equal(leave(f).left, true);
  assert.deepEqual(view(f.room).player_ids, [f.guest]);
  assert.equal(accept(f, 1), false);
});
