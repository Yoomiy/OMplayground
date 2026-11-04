import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  GatewayApiContext,
  GatewayOptions,
} from "../../../games/voxel/src/server/gateway.ts";
import {
  readChatPage,
  readChatReceipt,
  validChatText,
} from "../../../games/voxel/src/shared/chat.ts";
import type { ChatAction } from "../../../games/voxel/src/shared/chat.ts";
import { SchoolAccess, AccessDenied, bearerToken } from "./school-access.ts";
import { PersistenceError } from "./supabase-persistence.ts";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export class SupabaseChat {
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
    const v = await this.rpc("voxel_chat_status", {});
    if (
      !v ||
      typeof v !== "object" ||
      Array.isArray(v) ||
      Object.keys(v).length !== 2 ||
      v.schema !== 1 ||
      v.persistedModeration !== true
    )
      throw new PersistenceError("chat_installation_protocol");
  }
  async history(
    room: string,
    actor: string,
    before: number | null,
    until: number,
  ) {
    const result = readChatPage(
      await this.rpc("voxel_chat_history", {
        p_session: room,
        p_actor: actor,
        p_before: before,
        p_authorized_until: new Date(until).toISOString(),
      }),
    );
    if (
      !result ||
      (before !== null && result.messages.some((m) => m.sequence >= before))
    )
      throw new PersistenceError("chat_history_protocol");
    return result;
  }
  async apply(
    room: string,
    actor: string,
    id: string,
    action: ChatAction,
    target: string | null,
    message: string | null,
    until: number,
    proof?: NonNullable<ReturnType<GatewayApiContext["actor"]>>,
  ) {
    const args = {
      p_session: room,
      p_actor: actor,
      p_request: id,
      p_authorized_until: new Date(until).toISOString(),
    };
    const value =
      action === "send"
        ? await this.rpc("voxel_chat_send", {
            ...args,
            p_world: proof!.worldId,
            p_owner: proof!.owner,
            p_epoch: proof!.epoch,
            p_revision: proof!.admissionRevision,
            p_message: message,
          })
        : await this.rpc("voxel_chat_moderate", {
            ...args,
            p_action: action,
            p_target: target,
          });
    const result = readChatReceipt(value);
    if (
      !result ||
      result.requestId !== id ||
      result.action !== action ||
      result.messageId !== (action === "send" ? id : target)
    )
      throw new PersistenceError("chat_receipt_protocol");
    return result;
  }
}
export function schoolChatApi(
  access: SchoolAccess,
  chat: SupabaseChat,
  event: (
    name: string,
    context: Record<string, string | number | boolean>,
  ) => void,
): NonNullable<GatewayOptions["api"]> {
  const run =
    (
      operation: "history" | "send" | "moderate",
    ): NonNullable<GatewayOptions["api"]>[string] =>
    async (req, body, res, context) => {
      let id = "invalid";
      try {
        if (!body || typeof body !== "object" || Array.isArray(body))
          throw new AccessDenied("INVALID");
        const v = body as Record<string, unknown>;
        if (typeof v.room !== "string" || !UUID.test(v.room))
          throw new AccessDenied("INVALID");
        if (operation === "history") {
          if (
            Object.keys(v).length !== 2 ||
            !(
              v.before === null ||
              (Number.isSafeInteger(v.before) && (v.before as number) > 0)
            )
          )
            throw new AccessDenied("INVALID");
        } else {
          if (typeof v.requestId !== "string" || !UUID.test(v.requestId))
            throw new AccessDenied("INVALID");
          id = v.requestId;
          if (
            operation === "send"
              ? Object.keys(v).length !== 3 || !validChatText(v.message)
              : Object.keys(v).length !== 4 ||
                !["delete", "clear"].includes(v.action as string) ||
                (v.action === "clear"
                  ? v.target !== null
                  : typeof v.target !== "string" || !UUID.test(v.target))
          )
            throw new AccessDenied("INVALID");
        }
        const token = bearerToken(req.headers.authorization);
        if (!token) throw new AccessDenied("UNAUTHORIZED");
        const started = Date.now(),
          identity = await access.identity(token);
        let until = Math.min(started + 5000, identity.expiresAt);
        if (operation === "history") {
          if (identity.subject.role === "kid")
            until = Math.min(
              until,
              (await access.inspect(token, { room: v.room })).expiresAt,
            );
          return await chat.history(
            v.room,
            identity.subject.id,
            v.before as number | null,
            until,
          );
        }
        if (operation === "moderate" && identity.subject.role === "kid")
          throw new AccessDenied("FORBIDDEN");
        let proof:
          | NonNullable<ReturnType<GatewayApiContext["actor"]>>
          | undefined;
        if (operation === "send") {
          const first = context?.actor(v.room, identity.subject.id);
          if (!first || first.role !== "participant")
            throw new AccessDenied("NOT_IN_ROOM");
          const fresh = await access.authorize(token, {
            room: v.room,
            participation: "player",
          });
          const current = context?.actor(v.room, identity.subject.id);
          if (
            !current ||
            current.connection !== first.connection ||
            current.role !== "participant"
          )
            throw new AccessDenied("NOT_IN_ROOM");
          proof = first;
          until = Math.min(
            until,
            first.expiresAt,
            current.expiresAt,
            fresh.expiresAt,
          );
        }
        if (Date.now() >= until) throw new Error("chat proof expired");
        const result = await chat.apply(
          v.room,
          identity.subject.id,
          id,
          operation === "send" ? "send" : (v.action as ChatAction),
          operation === "send" ? null : (v.target as string | null),
          operation === "send" ? (v.message as string).trim() : null,
          until,
          proof,
        );
        event("VOXEL_CHAT_APPLIED", {
          correlationId: id,
          room: v.room,
          action: result.action,
        });
        return result;
      } catch (error) {
        const code =
          error instanceof AccessDenied
            ? error.code
            : error instanceof PersistenceError &&
                error.providerCode === "42501"
              ? "FORBIDDEN"
              : error instanceof PersistenceError &&
                  error.providerCode === "22023"
                ? "CHAT_CONFLICT"
                : "CHAT_UNCONFIRMED";
        event("VOXEL_CHAT_REJECTED", { correlationId: id, code, operation });
        res.writeHead(
          code === "UNAUTHORIZED"
            ? 401
            : code === "INVALID"
              ? 400
              : code === "CHAT_CONFLICT"
                ? 409
                : code === "CHAT_UNCONFIRMED"
                  ? 503
                  : 403,
          { "Content-Type": "application/json", "Cache-Control": "no-store" },
        );
        res.end(JSON.stringify({ error: code }));
        return null;
      }
    };
  return {
    "/api/voxel/chat-history": run("history"),
    "/api/voxel/chat-send": run("send"),
    "/api/voxel/chat-moderate": run("moderate"),
  };
}
