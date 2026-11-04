import assert from "node:assert/strict";
import { createSupabaseServerClient } from "../../src/supabase-persistence.ts";
import { SchoolAccess } from "../../src/school-access.ts";
import { PostgresTestDatabase, literal } from "./postgres.ts";
/** Auth/PostgREST transports are fixtures reading fresh real local DB metadata. */
export function schoolSqlFixture(
  db: PostgresTestDatabase,
  room: string | readonly string[],
  identities: readonly string[],
) {
  const rooms = typeof room === "string" ? [room] : room;
  const calls: string[] = [];
  const access = new SchoolAccess(
    createSupabaseServerClient(
      {
        SUPABASE_URL: "https://school-sql.invalid",
        SUPABASE_SECRET_KEY: "sb_secret_fixture",
      },
      async (input, init) => {
        const request = new Request(input, init),
          url = new URL(request.url),
          path = url.pathname.split("/").at(-1)!;
        calls.push(path);
        let data: unknown;
        if (path === "user") {
          const token = request.headers.get("Authorization")!.slice(7),
            claims = JSON.parse(
              Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
            );
          assert.ok(identities.includes(claims.sub));
          data = {
            id: claims.sub,
            aud: "authenticated",
            role: "authenticated",
          };
        } else if (
          ["voxel_actor_policy", "voxel_session_policy"].includes(path)
        ) {
          data = await db.rpcAsync(
            path,
            (await request.json()) as Record<string, unknown>,
          );
        } else if (path === "game_sessions") {
          const requestedRoom = url.searchParams.get("id")?.slice(3);
          assert.ok(requestedRoom && rooms.includes(requestedRoom));
          data = await db.valueAsync(
            `SELECT coalesce(jsonb_agg(to_jsonb(s)||jsonb_build_object('invitation_code','fixture-invite','games',jsonb_build_object('game_url','minecraft','is_active',true))),'[]'::jsonb) FROM public.game_sessions s WHERE id=${literal(requestedRoom)}`,
          );
        } else if (path === "kid_profiles" || path === "admin_profiles") {
          const id = url.searchParams.get("id")!.slice(3);
          data = await db.valueAsync(
            `SELECT coalesce(jsonb_agg(k),'[]'::jsonb) FROM public.${path} k WHERE id=${literal(id)}`,
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
            "class_recess_schedule_settings",
            "class_recess_schedule_exceptions",
          ].includes(path)
        )
          data = [];
        else throw new Error("unexpected school fixture request");
        return new Response(JSON.stringify(data), {
          headers: { "Content-Type": "application/json" },
        });
      },
    ),
  );
  const token = (id: string) =>
    [
      Buffer.from('{"alg":"HS256"}').toString("base64url"),
      Buffer.from(
        JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 }),
      ).toString("base64url"),
      "fixture_signature",
    ].join(".");
  return { access, token, calls };
}
