import { DIAGNOSTIC_REASONS } from "../../../games/voxel/src/shared/diagnostics.ts";
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
        const correlationId = res.getHeader?.("x-correlation-id");
        event("VOXEL_SESSION_API_REJECTED", {
          code,
          ...(typeof correlationId === "string" ? { correlationId } : {}),
          operation:
            req.url === "/api/voxel/diagnostics" ? "diagnostics" : "session",
          ...(error instanceof PersistenceError
            ? {
                providerCode: error.providerCode,
                persistenceOperation: error.operation,
              }
            : {}),
        });
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
    "/api/voxel/room-settings": run(async (req, body) => {
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw new AccessDenied("INVALID");
      const v = body as Record<string, unknown>;
      if (
        typeof v.room !== "string" ||
        !UUID.test(v.room) ||
        Object.keys(v).some((k) => !["room", "isOpen"].includes(k)) ||
        ("isOpen" in v && typeof v.isOpen !== "boolean")
      )
        throw new AccessDenied("INVALID");
      const token = bearerToken(req.headers.authorization);
      if (!token) throw new AccessDenied("UNAUTHORIZED");
      const auth = await access.identity(token);
      await access.inspect(token, { room: v.room });
      const fields = "is_open,invitation_code";
      const result =
        "isOpen" in v
          ? await client
              .from("game_sessions")
              .update({ is_open: v.isOpen })
              .eq("id", v.room)
              .eq("host_id", auth.subject.id)
              .neq("status", "completed")
              .select(fields)
              .maybeSingle()
              .retry(false)
          : await client
              .from("game_sessions")
              .select(fields)
              .eq("id", v.room)
              .eq("host_id", auth.subject.id)
              .maybeSingle()
              .retry(false);
      if (result.error)
        throw new PersistenceError("room_settings", result.error);
      if (!result.data) throw new AccessDenied("FORBIDDEN");
      return {
        isOpen: result.data.is_open,
        invitationCode: result.data.invitation_code,
      };
    }),
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
        Object.keys(v).some(
          (key) =>
            ![
              "room",
              "correlationId",
              "operation",
              "code",
              "buildId",
              "reason",
              "fatal",
            ].includes(key),
        ) ||
        (v.reason !== undefined &&
          !(DIAGNOSTIC_REASONS as readonly unknown[]).includes(v.reason)) ||
        (v.fatal !== undefined && typeof v.fatal !== "boolean") ||
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
        ...(typeof v.reason === "string" ? { reason: v.reason } : {}),
        ...(typeof v.fatal === "boolean" ? { fatal: v.fatal } : {}),
      });
      return { ok: true };
    }),
  };
}
