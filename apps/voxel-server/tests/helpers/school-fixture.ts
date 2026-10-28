import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { SchoolAccess } from "../../src/school-access.ts";
import { createSupabaseServerClient } from "../../src/supabase-persistence.ts";
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
export function schoolFixture() {
  let now = Date.parse("2026-10-25T08:00:00Z");
  const kid = randomUUID(),
    teacher = randomUUID(),
    admin = randomUUID(),
    room = randomUUID(),
    guest = randomUUID();
  const profiles = new Map<string, Record<string, unknown>>([
    [kid, { id: kid, role: "kid", gender: "boy", grade: "ג", is_active: true }],
    [
      teacher,
      {
        id: teacher,
        role: "teacher",
        gender: "girl",
        grade: null,
        is_active: true,
      },
    ],
    [
      guest,
      { id: guest, role: "kid", gender: "boy", grade: "ג", is_active: true },
    ],
  ]);
  const admins = new Set<string>([admin]);
  const state = {
    session: {
      id: room,
      host_id: kid,
      player_ids: [kid],
      gender: "boy",
      status: "playing",
      is_open: true,
      voxel_roster_revision: 0,
      invitation_code: "join-test",
      games: { game_url: "minecraft", is_active: true },
    },
    defaults: [
      {
        day_of_week: 0,
        start_time: "09:00:00",
        end_time: "12:00:00",
        is_active: true,
      },
    ],
    setting: null as { override_enabled: boolean } | null,
    exceptions: [] as Record<string, unknown>[],
    accepted: false,
    sessionPolicy: undefined as unknown,
    policies: new Map<
      string,
      { revision: number; acceptedRevision: number; banned: boolean }
    >(),
    outage: "" as string,
    outageId: null as string | null,
    authStatus: 200,
    authOverride: null as string | null,
    onRequest: null as ((path: string) => void) | null,
  };
  const requests: { path: string; query: URLSearchParams; headers: Headers }[] =
    [];
  const client = createSupabaseServerClient(
    {
      SUPABASE_URL: "https://school.invalid",
      SUPABASE_SECRET_KEY: "sb_secret_fixture",
    },
    async (input, init) => {
      const request = new Request(input, init),
        url = new URL(request.url),
        path = url.pathname.split("/").at(-1)!;
      requests.push({
        path,
        query: url.searchParams,
        headers: request.headers,
      });
      state.onRequest?.(path);
      if (
        path === state.outage &&
        (state.outageId === null ||
          url.searchParams.get("id") === `eq.${state.outageId}`)
      )
        return response(
          { code: "P0001", message: "private-provider-message" },
          503,
        );
      if (path === "user") {
        if (state.authStatus !== 200)
          return response(
            { message: "private-provider-message" },
            state.authStatus,
          );
        const token = request.headers
          .get("Authorization")!
          .slice("Bearer ".length);
        const claims = JSON.parse(
          Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
        );
        return response({
          id: state.authOverride ?? claims.sub,
          aud: "authenticated",
          role: "authenticated",
        });
      }
      assert.equal(request.headers.has("Authorization"), false);
      if (path === "voxel_session_policy") {
        assert.deepEqual(await request.json(), { p_session: room });
        return response(
          state.sessionPolicy === undefined
            ? {
                state: state.session.status === "paused" ? "paused" : "playing",
              }
            : state.sessionPolicy,
        );
      }
      if (path === "voxel_actor_policy") {
        const body = (await request.json()) as {
          p_session: string;
          p_actor: string;
        };
        assert.equal(body.p_session, room);
        return response(
          state.policies.get(body.p_actor) ?? {
            revision: 0,
            acceptedRevision: 0,
            banned: false,
          },
        );
      }
      const id = url.searchParams.get("id")?.slice(3);
      if (path === "kid_profiles")
        return response(profiles.has(id!) ? [profiles.get(id!)] : []);
      if (path === "admin_profiles")
        return response(admins.has(id!) ? [{ id }] : []);
      if (path === "game_sessions")
        return response(id === room ? [state.session] : []);
      if (path === "recess_schedules") return response(state.defaults);
      if (path === "class_recess_schedule_settings")
        return response(state.setting ? [state.setting] : []);
      if (path === "class_recess_schedule_exceptions")
        return response(state.exceptions);
      if (path === "game_challenges") {
        assert.equal(url.searchParams.get("session_id"), `eq.${room}`);
        assert.equal(url.searchParams.get("status"), "eq.accepted");
        assert.ok(url.searchParams.get("to_kid_id"));
        return response(state.accepted ? [{ id: randomUUID() }] : []);
      }
      throw new Error("unexpected policy query");
    },
  );
  const token = (
    id: string = kid,
    expiresAt = now + 3600000,
    extra: Record<string, unknown> = {},
  ) =>
    [
      Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
        "base64url",
      ),
      Buffer.from(
        JSON.stringify({
          sub: id,
          exp: Math.floor(expiresAt / 1000),
          role: "authenticated",
          ...extra,
        }),
      ).toString("base64url"),
      "fixture_signature",
    ].join(".");
  const access = new SchoolAccess(client, () => now);
  return {
    access,
    kid,
    teacher,
    admin,
    guest,
    room,
    profiles,
    admins,
    state,
    requests,
    token,
    setNow(value: number) {
      now = value;
    },
    get now() {
      return now;
    },
  };
}
