import type { SupabaseClient } from "@supabase/supabase-js";
import type { GatewayOptions } from "../../../games/voxel/src/server/gateway.ts";
import {
  readModerationAction,
  readModerationReceipt,
} from "../../../games/voxel/src/shared/moderation.ts";
import type { ModerationAction } from "../../../games/voxel/src/shared/moderation.ts";
import { SchoolAccess, AccessDenied, bearerToken } from "./school-access.ts";
import { PersistenceError } from "./supabase-persistence.ts";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export class SupabaseModeration {
  private client: SupabaseClient;
  constructor(client: SupabaseClient) {
    this.client = client;
  }
  private async rpc(name: string, args: Record<string, unknown>) {
    try {
      const result = await this.client.rpc(name, args).retry(false);
      if (result.error) throw new PersistenceError(name, result.error);
      return result.data;
    } catch (error) {
      throw error instanceof PersistenceError
        ? error
        : new PersistenceError(name, error);
    }
  }
  async verifyInstallation() {
    const v = await this.rpc("voxel_moderation_status", {});
    if (
      !v ||
      typeof v !== "object" ||
      Array.isArray(v) ||
      Object.keys(v).length !== 2 ||
      v.schema !== 1 ||
      v.revisionFencing !== true
    )
      throw new PersistenceError("moderation_installation_protocol");
  }
  async apply(
    room: string,
    id: string,
    actor: string,
    target: string,
    action: ModerationAction,
    expiresAt: number,
  ) {
    const value = await this.rpc("voxel_moderate", {
      p_session: room,
      p_request: id,
      p_actor: actor,
      p_target: target,
      p_action: action,
      p_authorized_until: new Date(expiresAt).toISOString(),
    });
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.keys(value).length !== 7
    )
      throw new PersistenceError("moderation_protocol");
    const receipt = readModerationReceipt({
      ...value,
      saved: false,
      revocationRequested: value.current && action !== "unban",
    });
    if (
      !receipt ||
      receipt.requestId !== id ||
      receipt.action !== action ||
      receipt.target !== target
    )
      throw new PersistenceError("moderation_protocol");
    return receipt;
  }
  async targets(room: string, actor: string, expiresAt: number) {
    const value = await this.rpc("voxel_moderation_targets", {
      p_session: room,
      p_actor: actor,
      p_authorized_until: new Date(expiresAt).toISOString(),
    });
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.keys(value).length !== 1 ||
      !Array.isArray(value.targets) ||
      value.targets.some((v: unknown) => {
        if (!v || typeof v !== "object" || Array.isArray(v)) return true;
        const row = v as Record<string, unknown>;
        return (
          Object.keys(row).length !== 4 ||
          typeof row.id !== "string" ||
          !UUID.test(row.id) ||
          typeof row.name !== "string" ||
          typeof row.banned !== "boolean" ||
          typeof row.pendingReadmission !== "boolean"
        );
      }) ||
      new Set(value.targets.map((v: { id: string }) => v.id)).size !==
        value.targets.length
    )
      throw new PersistenceError("moderation_targets_protocol");
    return value as {
      targets: ReadonlyArray<
        Readonly<{
          id: string;
          name: string;
          banned: boolean;
          pendingReadmission: boolean;
        }>
      >;
    };
  }
}
/** Durable policy acknowledgement; worker disconnection and world saving are separate boundaries. */
export function schoolModerationApi(
  access: SchoolAccess,
  moderation: SupabaseModeration,
  event: (
    name: string,
    context: Record<string, string | number | boolean>,
  ) => void,
): NonNullable<GatewayOptions["api"]> {
  const run =
    (targets: boolean): NonNullable<GatewayOptions["api"]>[string] =>
    async (req, body, res, context) => {
      let id = "invalid";
      try {
        if (!body || typeof body !== "object" || Array.isArray(body))
          throw new AccessDenied("INVALID");
        const v = body as Record<string, unknown>,
          action = readModerationAction(v.action);
        if (
          typeof v.room !== "string" ||
          !UUID.test(v.room) ||
          Object.keys(v).length !== (targets ? 1 : 4) ||
          (!targets &&
            (typeof v.requestId !== "string" ||
              !UUID.test(v.requestId) ||
              typeof v.target !== "string" ||
              !UUID.test(v.target) ||
              !action))
        )
          throw new AccessDenied("INVALID");
        const token = bearerToken(req.headers.authorization);
        if (!token) throw new AccessDenied("UNAUTHORIZED");
        if (!targets && !context)
          throw new Error("moderation context unavailable");
        const started = Date.now(),
          identity = await access.identity(token);
        if (identity.subject.role === "kid")
          throw new AccessDenied("FORBIDDEN");
        const until = Math.min(started + 5000, identity.expiresAt);
        if (Date.now() >= until)
          throw new Error("moderation authorization expired");
        if (targets)
          return await moderation.targets(v.room, identity.subject.id, until);
        id = v.requestId as string;
        const receipt = await moderation.apply(
          v.room,
          id,
          identity.subject.id,
          v.target as string,
          action!,
          until,
        );
        if (receipt.revocationRequested)
          context!.revoke(v.room, receipt.target, receipt.revision);
        event("VOXEL_MODERATION_POLICY_APPLIED", {
          correlationId: id,
          room: v.room,
          action: receipt.action,
          current: receipt.current,
          revision: receipt.revision,
          banned: receipt.banned,
        });
        return receipt;
      } catch (error) {
        const code =
          error instanceof AccessDenied
            ? error.code
            : error instanceof PersistenceError &&
                error.providerCode === "42501"
              ? "FORBIDDEN"
              : error instanceof PersistenceError &&
                  error.providerCode === "22023"
                ? "CONFLICT"
                : error instanceof PersistenceError &&
                    error.providerCode === "55000"
                  ? "SESSION_ENDED"
                  : "MODERATION_UNCONFIRMED";
        event("VOXEL_MODERATION_REJECTED", { correlationId: id, code });
        res.writeHead(
          code === "INVALID"
            ? 400
            : code === "UNAUTHORIZED"
              ? 401
              : code === "CONFLICT" || code === "SESSION_ENDED"
                ? 409
                : code === "MODERATION_UNCONFIRMED"
                  ? 503
                  : 403,
          { "Content-Type": "application/json", "Cache-Control": "no-store" },
        );
        res.end(JSON.stringify({ error: code, saved: false }));
        return null;
      }
    };
  return {
    "/api/voxel/moderation": run(false),
    "/api/voxel/moderation-targets": run(true),
  };
}
