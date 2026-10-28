import { schoolFixture as fixture } from "./helpers/school-fixture.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { isSessionEnded } from "../../../games/voxel/src/server/admission.ts";
import {
  AccessDenied,
  SchoolUnavailable,
  bearerToken,
  AUTHORIZATION_MS,
} from "../src/school-access.ts";
const rejected = (code: string) => (error: unknown) => {
  assert.ok(error instanceof AccessDenied);
  assert.equal(error.code, code);
  return true;
};

test("a verified active child gets a short private authorization with no name, inventory or capacity query", async () => {
  const f = fixture(),
    decision = await f.access.authorize(f.token(), { room: f.room });
  assert.equal(decision.actor.id, f.kid);
  assert.equal(decision.actor.role, "participant");
  assert.deepEqual(decision.actor.capabilities, {
    build: true,
    fly: true,
    observe: false,
    combat: true,
    explosives: true,
  });
  assert.equal(decision.expiresAt, f.now + AUTHORIZATION_MS);
  assert.equal(decision.controls, true);
  assert.equal(Object.isFrozen(decision), true);
  assert.equal(Object.isFrozen(decision.actor.capabilities), true);
  assert.ok(
    f.requests.every(
      (r) =>
        !/full_name|player_names|max_players|game_state/.test(
          r.query.get("select") ?? "",
        ),
    ),
  );
  assert.ok(
    f.requests.some(
      (r) =>
        r.path === "user" &&
        r.headers.get("Authorization") === `Bearer ${f.token()}`,
    ),
  );
});

test("disabled accounts cannot fall through into admin access; each authorization reads current identity and profile", async () => {
  const f = fixture();
  await f.access.authorize(f.token(), { room: f.room });
  f.profiles.get(f.kid)!.is_active = false;
  f.admins.add(f.kid);
  await assert.rejects(
    f.access.authorize(f.token(), { room: f.room }),
    rejected("FORBIDDEN"),
  );
  assert.equal(f.requests.filter((r) => r.path === "user").length, 2);
  f.profiles.get(f.kid)!.is_active = true;
  f.state.authStatus = 401;
  await assert.rejects(
    f.access.authorize(f.token(), { room: f.room }),
    rejected("UNAUTHORIZED"),
  );
  f.state.authStatus = 503;
  await assert.rejects(
    f.access.authorize(f.token(), { room: f.room }),
    SchoolUnavailable,
  );
});

test("staff observe across partitions without gameplay grants; teacher participation follows the normal gender rule", async () => {
  const f = fixture();
  for (const id of [f.teacher, f.admin]) {
    const decision = await f.access.authorize(f.token(id), { room: f.room });
    assert.equal(decision.actor.role, "observer");
    assert.equal(decision.controls, true);
    assert.deepEqual(decision.actor.capabilities, {
      build: false,
      fly: true,
      observe: true,
      combat: false,
      explosives: false,
    });
  }
  await assert.rejects(
    f.access.authorize(f.token(f.teacher), {
      room: f.room,
      participation: "player",
    }),
    rejected("GENDER_MISMATCH"),
  );
  f.profiles.get(f.teacher)!.gender = "boy";
  assert.equal(
    (
      await f.access.authorize(f.token(f.teacher), {
        room: f.room,
        participation: "player",
      })
    ).actor.role,
    "participant",
  );
  await assert.rejects(
    f.access.authorize(f.token(f.admin), {
      room: f.room,
      participation: "player",
    }),
    rejected("MODE_DENIED"),
  );
  await assert.rejects(
    f.access.authorize(f.token(), { room: f.room, participation: "observer" }),
    rejected("MODE_DENIED"),
  );
});

test("closed rooms require current membership, a current invitation, or an accepted challenge", async () => {
  const f = fixture();
  f.state.session.is_open = false;
  await f.access.authorize(f.token(), { room: f.room });
  await assert.rejects(
    f.access.authorize(f.token(f.guest), { room: f.room }),
    rejected("SESSION_CLOSED"),
  );
  await f.access.authorize(f.token(f.guest), {
    room: f.room,
    invitationCode: " join-test ",
  });
  f.state.session.invitation_code = "rotated";
  await assert.rejects(
    f.access.authorize(f.token(f.guest), {
      room: f.room,
      invitationCode: "join-test",
    }),
    rejected("SESSION_CLOSED"),
  );
  f.state.accepted = true;
  await f.access.authorize(f.token(f.guest), { room: f.room });
  f.state.accepted = false;
  f.state.session.player_ids.push(f.guest);
  await f.access.authorize(f.token(f.guest), { room: f.room });
  f.state.session.player_ids = f.state.session.player_ids.filter(
    (id) => id !== f.guest,
  );
  await assert.rejects(
    f.access.authorize(f.token(f.guest), { room: f.room }),
    rejected("SESSION_CLOSED"),
  );
});

test("paused sessions preserve roster/host access and staff inspection, while ended or wrong-game sessions never start", async () => {
  const f = fixture();
  f.state.session.status = "paused";
  f.state.session.player_ids = [];
  await f.access.authorize(f.token(), { room: f.room });
  await assert.rejects(
    f.access.authorize(f.token(f.guest), {
      room: f.room,
      invitationCode: "join-test",
    }),
    rejected("PAUSED_ROSTER"),
  );
  await f.access.authorize(f.token(f.admin), { room: f.room });
  f.state.session.status = "completed";
  await assert.rejects(
    f.access.authorize(f.token(f.admin), { room: f.room }),
    rejected("SESSION_ENDED"),
  );
  f.state.session.status = "playing";
  f.state.session.games.game_url = "another-game";
  await assert.rejects(
    f.access.authorize(f.token(), { room: f.room }),
    rejected("WRONG_GAME"),
  );
  f.state.session.games.game_url = "minecraft";
  f.state.session.games.is_active = false;
  await assert.rejects(
    f.access.authorize(f.token(), { room: f.room }),
    rejected("WRONG_GAME"),
  );
});

test("class exceptions override recess defaults and conflicting or unavailable schedules fail closed", async () => {
  const f = fixture();
  f.state.setting = { override_enabled: true };
  f.state.exceptions = [
    {
      day_of_week: 0,
      start_time: "09:30",
      end_time: "10:30",
      is_active: true,
      mode: "class_time",
    },
  ];
  await assert.rejects(
    f.access.authorize(f.token(), { room: f.room }),
    rejected("RECESS_CLOSED"),
  );
  f.state.setting.override_enabled = false;
  await f.access.authorize(f.token(), { room: f.room });
  f.state.setting.override_enabled = true;
  f.setNow(Date.parse("2026-10-25T11:00:00Z"));
  f.state.exceptions = [
    {
      day_of_week: 0,
      start_time: "12:30",
      end_time: "13:30",
      is_active: true,
      mode: "recess",
    },
  ];
  await f.access.authorize(f.token(), { room: f.room });
  f.state.exceptions.push({ ...f.state.exceptions[0], mode: "class_time" });
  await assert.rejects(
    f.access.authorize(f.token(), { room: f.room }),
    SchoolUnavailable,
  );
  f.state.exceptions = [];
  f.state.outage = "recess_schedules";
  await assert.rejects(
    f.access.authorize(f.token(), { room: f.room }),
    SchoolUnavailable,
  );
});

test("authorization cannot cross a schedule minute, JWT expiry, or an overlong provider read", async () => {
  const f = fixture();
  f.setNow(Date.parse("2026-10-25T09:59:58Z"));
  assert.equal(
    (await f.access.authorize(f.token(), { room: f.room })).expiresAt,
    f.now + 2000,
  );
  f.setNow(Date.parse("2026-10-25T10:00:00Z"));
  await assert.rejects(
    f.access.authorize(f.token(), { room: f.room }),
    rejected("RECESS_CLOSED"),
  );
  f.setNow(Date.parse("2026-10-25T08:00:00Z"));
  assert.equal(
    (await f.access.authorize(f.token(f.kid, f.now + 2000), { room: f.room }))
      .expiresAt,
    f.now + 2000,
  );
  await assert.rejects(
    f.access.authorize(f.token(f.kid, f.now), { room: f.room }),
    rejected("UNAUTHORIZED"),
  );
  f.state.onRequest = (path) => {
    if (path === "kid_profiles") f.setNow(f.now + AUTHORIZATION_MS + 1);
  };
  await assert.rejects(
    f.access.authorize(f.token(), { room: f.room }),
    SchoolUnavailable,
  );
});

test("private owned-object eligibility ignores offline recess time, but never ignores membership removal or a provider outage", async () => {
  const f = fixture();
  f.state.session.is_open = false;
  f.state.defaults = [];
  assert.equal((await f.access.resolveOwner(f.room, f.kid))?.id, f.kid);
  await assert.rejects(
    f.access.authorize(f.token(), { room: f.room }),
    rejected("RECESS_CLOSED"),
  );
  f.state.session.host_id = f.guest;
  f.state.session.player_ids = [];
  assert.equal(await f.access.resolveOwner(f.room, f.kid), null);
  f.state.outage = "kid_profiles";
  await assert.rejects(f.access.resolveOwner(f.room, f.kid), SchoolUnavailable);
});

test("authority comes from platform rows, never forged claims, extra request fields or a headcount ceiling", async () => {
  const f = fixture();
  f.state.session.player_ids = Array.from({ length: 257 }, () => randomUUID());
  const decision = await f.access.authorize(
    f.token(f.guest, undefined, { role: "admin" }),
    { room: f.room },
  );
  assert.equal(decision.subject.role, "kid");
  assert.equal(decision.controls, false);
  await assert.rejects(
    f.access.authorize(f.token(), {
      room: f.room,
      capabilities: { observe: true },
    } as any),
    rejected("INVALID"),
  );
  f.state.authOverride = f.guest;
  await assert.rejects(
    f.access.authorize(f.token(), { room: f.room }),
    rejected("UNAUTHORIZED"),
  );
  assert.equal(bearerToken(`Bearer ${f.token()}`), f.token());
  assert.equal(bearerToken(["Bearer token"]), null);
  assert.equal(bearerToken("Basic token"), null);
});

test("schedule interpretation retains Jerusalem time across summer and winter offsets", async () => {
  const f = fixture();
  for (const time of ["2026-07-26T07:00:00Z", "2026-10-25T08:00:00Z"]) {
    f.setNow(Date.parse(time));
    await f.access.authorize(f.token(), { room: f.room });
  }
  f.state.defaults = [
    {
      day_of_week: 0,
      start_time: "09:00:00.000",
      end_time: "12:00:00.000",
      is_active: true,
    },
  ];
  await f.access.authorize(f.token(), { room: f.room });
});

test("a continuous recess interval renews across ordinary minutes while the actual closing boundary remains authoritative", async () => {
  const f = fixture();
  f.setNow(Date.parse("2026-10-25T08:00:58Z"));
  assert.equal(
    (await f.access.authorize(f.token(), { room: f.room })).expiresAt,
    f.now + AUTHORIZATION_MS,
  );
  assert.equal(
    (await f.access.authorize(f.token(f.admin), { room: f.room })).expiresAt,
    f.now + AUTHORIZATION_MS,
  );
  f.state.defaults = [
    {
      day_of_week: 0,
      start_time: "00:00:00",
      end_time: "24:00:00",
      is_active: true,
    },
  ];
  await f.access.authorize(f.token(), { room: f.room });
});

test("a private grant refreshes current policy and cannot be redirected by mutating its original request", async () => {
  const f = fixture(),
    input = { room: f.room, invitationCode: "join-test" };
  f.state.session.is_open = false;
  const grant = await f.access.grant(f.token(f.guest), input);
  input.room = randomUUID();
  input.invitationCode = "other";
  assert.ok(await grant.revalidate());
  f.state.session.invitation_code = "rotated";
  assert.equal(await grant.revalidate(), null);
  f.state.outage = "kid_profiles";
  const before = f.requests.filter(
    (request) => request.path === "kid_profiles",
  ).length;
  await assert.rejects(grant.revalidate(), SchoolUnavailable);
  assert.equal(
    f.requests.filter((request) => request.path === "kid_profiles").length,
    before + 1,
    "the authorization owner controls retry timing",
  );
});

test("central room policy reads fresh session state independently of player admission and treats deletion/completion as terminal", async () => {
  const f = fixture();
  assert.equal((await f.access.roomPolicy(f.room)).state, "playing");
  f.state.session.status = "paused";
  assert.equal((await f.access.roomPolicy(f.room)).state, "paused");
  f.state.session.status = "completed";
  assert.equal((await f.access.roomPolicy(f.room)).state, "ended");
  f.state.session.status = "playing";
  f.state.session.games.is_active = false;
  assert.equal((await f.access.roomPolicy(f.room)).state, "ended");
  assert.equal(
    f.requests.some(
      (request) => request.path === "kid_profiles" || request.path === "user",
    ),
    false,
  );
});
test("unavailable or overlong session reads cannot renew central room permission", async () => {
  const f = fixture();
  f.state.outage = "game_sessions";
  await assert.rejects(f.access.roomPolicy(f.room), SchoolUnavailable);
  f.state.outage = "";
  f.state.onRequest = () => f.setNow(f.now + AUTHORIZATION_MS);
  await assert.rejects(f.access.roomPolicy(f.room), SchoolUnavailable);
});

test("a completed school session remains a terminal revalidation reason rather than a generic permission or provider failure", async () => {
  const f = fixture(),
    grant = await f.access.grant(f.token(), { room: f.room });
  f.state.session.status = "completed";
  await assert.rejects(grant.revalidate(), isSessionEnded);
  f.state.session.status = "playing";
  f.state.session.games.is_active = false;
  await assert.rejects(grant.revalidate(), isSessionEnded);
});

test("an empty invitation value never opens a closed room", async () => {
  const f = fixture();
  f.state.session.is_open = false;
  f.state.session.invitation_code = "";
  await assert.rejects(
    f.access.authorize(f.token(f.guest), { room: f.room, invitationCode: "" }),
    rejected("SESSION_CLOSED"),
  );
});

test("roster revisions fence old open-room tickets while actor and passive ownership renewal require accepted membership", async () => {
  const f = fixture(),
    token = f.token(f.guest),
    old = await f.access.grant(token, { room: f.room });
  assert.equal((await old.revalidate("ticket"))?.membershipRevision, 0);
  f.state.session.voxel_roster_revision = 1;
  assert.equal(await old.revalidate("ticket"), null);
  const fresh = await f.access.grant(token, { room: f.room });
  assert.equal((await fresh.revalidate("ticket"))?.membershipRevision, 1);
  assert.equal(await fresh.revalidate("actor"), null);
  assert.equal(await f.access.resolveOwner(f.room, f.guest), null);
  f.state.session.player_ids.push(f.guest);
  assert.equal(
    await old.revalidate("ticket"),
    null,
    "restoring membership cannot revive a pre-departure ticket",
  );
  assert.equal((await fresh.revalidate("actor"))?.actor.id, f.guest);
  assert.equal((await f.access.resolveOwner(f.room, f.guest))?.id, f.guest);
  f.state.session.player_ids = [f.kid];
  f.state.session.voxel_roster_revision++;
  assert.equal(await fresh.revalidate("actor"), null);
  assert.equal(await f.access.resolveOwner(f.room, f.guest), null);
  assert.ok(
    await (
      await f.access.grant(f.token(f.teacher), { room: f.room })
    ).revalidate("actor"),
  );
});

test("removal generations revoke earlier actor/owner proofs without disrupting peers and bans deny fresh admission until explicit unban/readmission", async () => {
  const f = fixture();
  f.state.session.player_ids.push(f.guest);
  const old = await f.access.grant(f.token(), { room: f.room });
  const peer = await f.access.grant(f.token(f.guest), { room: f.room });
  f.state.session.voxel_roster_revision = 1;
  f.state.policies.set(f.kid, {
    revision: 1,
    acceptedRevision: 0,
    banned: false,
  });
  assert.equal(await old.revalidate("actor"), null);
  assert.equal(await old.revalidate("ticket"), null);
  assert.equal(await f.access.resolveOwner(f.room, f.kid), null);
  assert.equal((await peer.revalidate("actor"))?.actor.id, f.guest);
  const fresh = await f.access.grant(f.token(), { room: f.room });
  assert.equal((await fresh.revalidate("ticket"))?.membershipRevision, 1);
  assert.equal(await fresh.revalidate("actor"), null);
  f.state.policies.get(f.kid)!.acceptedRevision = 1;
  assert.equal((await fresh.revalidate("actor"))?.actor.id, f.kid);
  assert.equal(await old.revalidate("actor"), null);
  f.state.session.voxel_roster_revision = 2;
  f.state.policies.set(f.kid, {
    revision: 2,
    acceptedRevision: 1,
    banned: true,
  });
  await assert.rejects(
    f.access.authorize(f.token(), { room: f.room }),
    rejected("BANNED"),
  );
  assert.equal(await fresh.revalidate("actor"), null);
  assert.equal(await f.access.resolveOwner(f.room, f.kid), null);
  f.state.session.status = "completed";
  await assert.rejects(
    f.access.inspect(f.token(), { room: f.room }),
    rejected("BANNED"),
  );
  f.state.session.status = "playing";
  f.state.session.voxel_roster_revision = 3;
  f.state.policies.set(f.kid, {
    revision: 3,
    acceptedRevision: 1,
    banned: false,
  });
  const unbanned = await f.access.grant(f.token(), { room: f.room });
  assert.equal((await unbanned.revalidate("ticket"))?.membershipRevision, 3);
  assert.equal(await unbanned.revalidate("actor"), null);
  assert.equal(await fresh.revalidate("ticket"), null);
});
test("missing, inconsistent or overlong access-policy reads cannot grant or renew school authority", async () => {
  const f = fixture();
  f.state.outage = "voxel_actor_policy";
  await assert.rejects(
    f.access.authorize(f.token(), { room: f.room }),
    SchoolUnavailable,
  );
  f.state.outage = "";
  f.state.policies.set(f.kid, {
    revision: 0,
    acceptedRevision: 1,
    banned: false,
  });
  await assert.rejects(
    f.access.authorize(f.token(), { room: f.room }),
    SchoolUnavailable,
  );
  f.state.policies.clear();
  f.state.onRequest = (path) => {
    if (path === "voxel_actor_policy") f.setNow(f.now + 5001);
  };
  await assert.rejects(
    f.access.authorize(f.token(), { room: f.room }),
    SchoolUnavailable,
  );
});
