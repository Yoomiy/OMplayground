import type { ControlPolicy } from "../../../games/voxel/src/server/control.ts";
import type { RoomLease } from "../../../games/voxel/src/server/checkpoint-storage.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AccessDenied, SchoolAccess, bearerToken } from "./school-access.ts";
import { PersistenceError } from "./supabase-persistence.ts";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export type LifecycleAction = "pause" | "resume" | "end";
type Receipt = Readonly<{
  action: LifecycleAction;
  completed: boolean;
  savedSequence: number | null;
  revision: number;
  current: boolean;
}>;
const owner = (lease: RoomLease) => ({
  p_session: lease.room,
  p_world: lease.worldId,
  p_owner: lease.owner,
  p_epoch: lease.epoch,
});
function receipt(value: unknown): Receipt {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new PersistenceError("control_protocol");
  const v = value as Record<string, unknown>;
  if (
    Object.keys(v).length !== 5 ||
    !["pause", "resume", "end"].includes(v.action as string) ||
    typeof v.completed !== "boolean" ||
    typeof v.current !== "boolean" ||
    !Number.isSafeInteger(v.revision) ||
    (v.revision as number) < 1 ||
    !(
      v.savedSequence === null ||
      (Number.isSafeInteger(v.savedSequence) && (v.savedSequence as number) > 0)
    ) ||
    (v.action === "resume" && v.savedSequence !== null) ||
    (v.action !== "resume" && v.completed && v.savedSequence === null)
  )
    throw new PersistenceError("control_protocol");
  return Object.freeze(v) as Receipt;
}
export class SupabaseControls {
  private client: SupabaseClient;
  constructor(client: SupabaseClient) {
    this.client = client;
  }
  private async rpc(
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const response = await this.client.rpc(name, args);
      if (response.error) throw new PersistenceError(name, response.error);
      return response.data;
    } catch (error) {
      throw error instanceof PersistenceError
        ? error
        : new PersistenceError(name, error);
    }
  }
  async verifyInstallation() {
    const v = await this.rpc("voxel_controls_status", {});
    if (
      !v ||
      typeof v !== "object" ||
      Object.keys(v).length !== 1 ||
      !("schema" in v) ||
      v.schema !== 1
    )
      throw new PersistenceError("controls_installation_protocol");
  }
  async receipt(room: string, id: string, actor: string) {
    const v = await this.rpc("voxel_control_receipt", {
      p_session: room,
      p_request: id,
      p_actor: actor,
    });
    return v === null ? null : receipt(v);
  }
  async begin(
    lease: RoomLease,
    id: string,
    actor: string,
    action: LifecycleAction,
    expiresAt: number,
  ) {
    return receipt(
      await this.rpc("voxel_begin_control", {
        ...owner(lease),
        p_request: id,
        p_actor: actor,
        p_action: action,
        p_authorized_until: new Date(expiresAt).toISOString(),
      }),
    );
  }
  async finish(
    lease: RoomLease,
    id: string,
    actor: string,
    saved: number | null,
  ) {
    return receipt(
      await this.rpc("voxel_finish_control", {
        ...owner(lease),
        p_request: id,
        p_actor: actor,
        p_saved: saved,
      }),
    );
  }
}
/** Input validates before allocation; identity is refreshed again after queue/allocation IO. */
export function schoolControl(
  access: SchoolAccess,
  commands: SupabaseControls,
  onEvent: (
    event: string,
    context: Record<string, string | number | boolean>,
  ) => void = () => {},
): ControlPolicy {
  return async (req, body, res) => {
    const reply = (status: number, value: unknown) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(value));
    };
    const failure = (error: unknown) => {
      const code =
        error instanceof AccessDenied
          ? error.code
          : error instanceof PersistenceError && error.providerCode === "42501"
            ? "FORBIDDEN"
            : "CONTROL_UNAVAILABLE";
      onEvent("VOXEL_CONTROL_REJECTED", {
        correlationId: requestId || "invalid",
        code,
      });
      reply(
        code === "UNAUTHORIZED"
          ? 401
          : code === "INVALID"
            ? 400
            : code === "CONTROL_UNAVAILABLE"
              ? 503
              : 403,
        { error: code, saved: false },
      );
    };
    let requestId = "";
    try {
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw new AccessDenied("INVALID");
      const input = body as Record<string, unknown>;
      if (
        Object.keys(input).length !== 3 ||
        typeof input.room !== "string" ||
        !UUID.test(input.room) ||
        typeof input.requestId !== "string" ||
        !UUID.test(input.requestId) ||
        !["pause", "resume", "end"].includes(input.action as string)
      )
        throw new AccessDenied("INVALID");
      const room = input.room,
        action = input.action as LifecycleAction;
      requestId = input.requestId;
      const token = bearerToken(req.headers.authorization);
      if (!token) throw new AccessDenied("UNAUTHORIZED");
      const first = await access.identity(token),
        old = await commands.receipt(room, requestId, first.subject.id);
      if (old && old.action !== action) throw new AccessDenied("INVALID");
      if (old?.completed) {
        reply(200, { requestId, ...old, saved: old.savedSequence !== null });
        return null;
      }
      // Controls need current host/staff authority; a receipt alone grants no mutation.
      const authorized = await access.authorize(token, { room });
      if (!authorized.controls) throw new AccessDenied("FORBIDDEN");
      return Object.freeze({
        room,
        execute: async (control) => {
          try {
            const fresh = await access.authorize(token, { room });
            if (!fresh.controls || fresh.subject.id !== first.subject.id)
              throw new AccessDenied("FORBIDDEN");
            const accepted = await commands.begin(
              control.lease,
              requestId,
              fresh.subject.id,
              action,
              fresh.expiresAt,
            );
            if (!accepted.current && !accepted.completed) {
              reply(409, { error: "SUPERSEDED", requestId, saved: false });
              return null;
            }
            if (accepted.completed)
              return {
                requestId,
                ...accepted,
                saved: accepted.savedSequence !== null,
              };
            let saved: number | null = null;
            if (action === "resume") control.resume();
            else {
              saved = (await control.savePaused()).sequence;
              if (action === "end") control.end();
            }
            const result = await commands.finish(
              control.lease,
              requestId,
              fresh.subject.id,
              saved,
            );
            onEvent("VOXEL_CONTROL_COMPLETED", {
              correlationId: requestId,
              action,
              revision: result.revision,
              saved: saved !== null,
            });
            return {
              requestId,
              ...result,
              saved: result.savedSequence !== null,
            };
          } catch (error) {
            failure(error);
            return null;
          }
        },
      });
    } catch (error) {
      failure(error);
      return null;
    }
  };
}
