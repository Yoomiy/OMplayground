import type { SupabaseClient } from "@supabase/supabase-js";
import type { GatewayOptions } from "../../../games/voxel/src/server/gateway.ts";
import {
  AccessDenied,
  SchoolAccess,
  SchoolUnavailable,
  bearerToken,
} from "./school-access.ts";
import type { SchoolAdmissionRequest } from "./school-access.ts";
import { PersistenceError } from "./supabase-persistence.ts";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
/** These reads do not allocate a worker or grant gameplay/voice authority. */
export function schoolSessionApi(
  access: SchoolAccess,
  client: SupabaseClient,
  event: (
    name: string,
    context: Record<string, string | number | boolean>,
  ) => void,
): NonNullable<GatewayOptions["api"]> {
  const run =
    (
      work: NonNullable<GatewayOptions["api"]>[string],
    ): NonNullable<GatewayOptions["api"]>[string] =>
    async (req, body, res) => {
      try {
        return await work(req, body, res);
      } catch (error) {
        const code =
          error instanceof AccessDenied ? error.code : "SESSION_UNAVAILABLE";
        res.writeHead(
          code === "UNAUTHORIZED"
            ? 401
            : code === "INVALID"
              ? 400
              : error instanceof AccessDenied
                ? 403
                : 503,
          { "Content-Type": "application/json", "Cache-Control": "no-store" },
        );
        res.end(JSON.stringify({ error: code }));
        return null;
      }
    };
  return {
    "/api/voxel/session": run(async (req, body) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) throw new AccessDenied("UNAUTHORIZED");
      const input = body as SchoolAdmissionRequest,
        grant = await access.inspect(token, input);
      let result: { data: unknown; error: unknown };
      try {
        result = await client
          .from("game_sessions")
          .select(
            "id,host_id,host_name,status,connected_player_ids,connected_player_names,voxel_presence_expires_at",
          )
          .eq("id", input.room)
          .maybeSingle()
          .retry(false);
      } catch {
        throw new SchoolUnavailable();
      }
      if (result.error)
        throw new PersistenceError("session_read", result.error);
      if (!result.data) throw new AccessDenied("NOT_FOUND");
      if (Date.now() >= grant.expiresAt) throw new SchoolUnavailable();
      return result.data;
    }),
    "/api/voxel/diagnostics": run(async (req, body) => {
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw new AccessDenied("INVALID");
      const v = body as Record<string, unknown>;
      if (
        Object.keys(v).length !== 5 ||
        typeof v.room !== "string" ||
        !UUID.test(v.room) ||
        typeof v.correlationId !== "string" ||
        !UUID.test(v.correlationId) ||
        typeof v.operation !== "string" ||
        !/^[a-z_]{1,40}$/.test(v.operation) ||
        typeof v.code !== "string" ||
        !/^[A-Z_]{1,48}$/.test(v.code) ||
        !(
          v.buildId === null ||
          (typeof v.buildId === "string" && /^[a-f0-9]{64}$/.test(v.buildId))
        )
      )
        throw new AccessDenied("INVALID");
      const token = bearerToken(req.headers.authorization);
      if (!token) throw new AccessDenied("UNAUTHORIZED");
      await access.inspect(token, { room: v.room });
      event("VOXEL_CLIENT_FAILURE", {
        correlationId: v.correlationId,
        room: v.room,
        operation: v.operation,
        code: v.code,
        clientBuildId: v.buildId ?? "unknown",
      });
      return { ok: true };
    }),
  };
}
