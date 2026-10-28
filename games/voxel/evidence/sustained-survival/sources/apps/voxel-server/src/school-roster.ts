import type { SupabaseClient } from "@supabase/supabase-js";
import type { GatewayOptions } from "../../../games/voxel/src/server/gateway.ts";
import { AccessDenied, SchoolAccess, bearerToken } from "./school-access.ts";
import { PersistenceError } from "./supabase-persistence.ts";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
/** Self-service departure deliberately works outside recess and grants no play authority. */
export function schoolRosterApi(
  access: SchoolAccess,
  client: SupabaseClient,
  event: (
    name: string,
    context: Record<string, string | number | boolean>,
  ) => void,
): NonNullable<GatewayOptions["api"]> {
  return {
    "/api/voxel/leave": async (req, body, res) => {
      try {
        if (!body || typeof body !== "object" || Array.isArray(body))
          throw new AccessDenied("INVALID");
        const input = body as Record<string, unknown>;
        if (
          Object.keys(input).length !== 2 ||
          typeof input.room !== "string" ||
          !UUID.test(input.room) ||
          typeof input.requestId !== "string" ||
          !UUID.test(input.requestId)
        )
          throw new AccessDenied("INVALID");
        const token = bearerToken(req.headers.authorization);
        if (!token) throw new AccessDenied("UNAUTHORIZED");
        const started = Date.now(),
          identity = await access.identity(token),
          until = Math.min(started + 5000, identity.expiresAt);
        if (Date.now() >= until) throw new Error("expired roster proof");
        const result = await client.rpc("voxel_leave_roster", {
          p_session: input.room,
          p_actor: identity.subject.id,
          p_request: input.requestId,
          p_authorized_until: new Date(until).toISOString(),
        });
        if (result.error)
          throw new PersistenceError("roster_leave", result.error);
        const value = result.data;
        if (
          !value ||
          typeof value !== "object" ||
          Array.isArray(value) ||
          Object.keys(value).length !== 4 ||
          value.requestId !== input.requestId ||
          value.left !== true ||
          typeof value.ended !== "boolean" ||
          !Number.isSafeInteger(value.revision) ||
          value.revision < 1
        )
          throw new Error("invalid roster receipt");
        event("VOXEL_ROSTER_LEFT", {
          room: input.room,
          correlationId: input.requestId,
          ended: value.ended,
        });
        return value;
      } catch (error) {
        const code =
          error instanceof AccessDenied
            ? error.code
            : error instanceof PersistenceError &&
                error.providerCode === "55000"
              ? "ROSTER_BUSY"
              : error instanceof PersistenceError &&
                  error.providerCode === "42501"
                ? "FORBIDDEN"
                : error instanceof PersistenceError &&
                    error.providerCode === "22023"
                  ? "CONFLICT"
                  : "ROSTER_UNAVAILABLE";
        const status =
          code === "INVALID"
            ? 400
            : code === "UNAUTHORIZED"
              ? 401
              : code === "FORBIDDEN"
                ? 403
                : ["ROSTER_BUSY", "CONFLICT"].includes(code)
                  ? 409
                  : 503;
        res.writeHead(status, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        res.end(JSON.stringify({ error: code }));
        return null;
      }
    },
  };
}
