import type { SupabaseClient } from "@supabase/supabase-js";
import type { RoomLease } from "../../../games/voxel/src/server/checkpoint-storage.ts";
import type { ControlPolicy } from "../../../games/voxel/src/server/control.ts";
import {
  readStaffCommand,
  readStaffResult,
} from "../../../games/voxel/src/shared/staff.ts";
import type {
  StaffCommand,
  StaffResult,
} from "../../../games/voxel/src/shared/staff.ts";
import { AccessDenied, SchoolAccess, bearerToken } from "./school-access.ts";
import { PersistenceError } from "./supabase-persistence.ts";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
type Receipt = Readonly<{
  command: StaffCommand;
  revision: number;
  ownerEpoch: number;
  completed: boolean;
  result: StaffResult | null;
  current: boolean;
}>;
const owner = (lease: RoomLease) => ({
  p_session: lease.room,
  p_world: lease.worldId,
  p_owner: lease.owner,
  p_epoch: lease.epoch,
});
function readReceipt(value: unknown): Receipt {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new PersistenceError("staff_protocol");
  const v = value as Record<string, unknown>,
    command = readStaffCommand(v.command),
    result = readStaffResult(v.result);
  if (
    Object.keys(v).length !== 6 ||
    !command ||
    !Number.isSafeInteger(v.revision) ||
    (v.revision as number) < 1 ||
    !Number.isSafeInteger(v.ownerEpoch) ||
    (v.ownerEpoch as number) < 1 ||
    typeof v.completed !== "boolean" ||
    typeof v.current !== "boolean" ||
    (v.completed ? !result : v.result !== null)
  )
    throw new PersistenceError("staff_protocol");
  if (
    result?.ok &&
    result.reason !== command.kind &&
    !(command.kind === "mode" && result.reason === "unchanged")
  )
    throw new PersistenceError("staff_protocol");
  return Object.freeze({ ...v, command, result }) as Receipt;
}
export class SupabaseStaff {
  private client: SupabaseClient;
  constructor(client: SupabaseClient) {
    this.client = client;
  }
  private async rpc(
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const result = await this.client.rpc(name, args);
      if (result.error) throw new PersistenceError(name, result.error);
      return result.data;
    } catch (error) {
      throw error instanceof PersistenceError
        ? error
        : new PersistenceError(name, error);
    }
  }
  async verifyInstallation() {
    const value = await this.rpc("voxel_staff_status", {});
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.keys(value).length !== 2 ||
      !("schema" in value) ||
      value.schema !== 1 ||
      !("epochFencing" in value) ||
      value.epochFencing !== true
    )
      throw new PersistenceError("staff_installation_protocol");
  }
  async receipt(room: string, id: string, actor: string) {
    const value = await this.rpc("voxel_staff_receipt", {
      p_session: room,
      p_request: id,
      p_actor: actor,
    });
    return value === null ? null : readReceipt(value);
  }
  async begin(
    lease: RoomLease,
    id: string,
    actor: string,
    command: StaffCommand,
    expiresAt: number,
  ) {
    const value = await this.rpc("voxel_begin_staff", {
      ...owner(lease),
      p_request: id,
      p_actor: actor,
      p_command: command,
      p_authorized_until: new Date(expiresAt).toISOString(),
    });
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      !("dispatch" in value) ||
      typeof value.dispatch !== "boolean"
    )
      throw new PersistenceError("staff_protocol");
    const { dispatch, ...rest } = value;
    const receipt = readReceipt(rest);
    if (dispatch && receipt.completed)
      throw new PersistenceError("staff_protocol");
    return { ...receipt, dispatch };
  }
  async finish(
    lease: RoomLease,
    id: string,
    actor: string,
    result: StaffResult,
  ) {
    return readReceipt(
      await this.rpc("voxel_finish_staff", {
        ...owner(lease),
        p_actor: actor,
        p_request: id,
        p_result: result,
      }),
    );
  }
}
/** Staff only, with fresh role checks after queueing/allocation and a fenced audit. */
export function schoolStaff(
  access: SchoolAccess,
  commands: SupabaseStaff,
  onEvent: (
    name: string,
    context: Record<string, string | number | boolean>,
  ) => void = () => {},
): ControlPolicy {
  return async (req, body, res) => {
    let requestId = "";
    const reply = (status: number, value: unknown) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(value));
    };
    const fail = (error: unknown) => {
      const code =
        error instanceof AccessDenied
          ? error.code
          : error instanceof PersistenceError && error.providerCode === "42501"
            ? "FORBIDDEN"
            : error instanceof PersistenceError &&
                error.providerCode === "22023"
              ? "CONFLICT"
              : "STAFF_UNCONFIRMED";
      onEvent("VOXEL_STAFF_REJECTED", {
        correlationId: requestId || "invalid",
        code,
      });
      reply(
        code === "INVALID"
          ? 400
          : code === "UNAUTHORIZED"
            ? 401
            : code === "STAFF_UNCONFIRMED"
              ? 503
              : code === "CONFLICT"
                ? 409
                : 403,
        { error: code, saved: false },
      );
    };
    try {
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw new AccessDenied("INVALID");
      const v = body as Record<string, unknown>,
        command = readStaffCommand(v.command);
      if (
        Object.keys(v).length !== 3 ||
        typeof v.room !== "string" ||
        !UUID.test(v.room) ||
        typeof v.requestId !== "string" ||
        !UUID.test(v.requestId) ||
        !command ||
        (command.kind === "teleport" &&
          command.target !== "spawn" &&
          !UUID.test(command.target))
      )
        throw new AccessDenied("INVALID");
      const room = v.room;
      requestId = v.requestId;
      const token = bearerToken(req.headers.authorization);
      if (!token) throw new AccessDenied("UNAUTHORIZED");
      const first = await access.identity(token),
        old = await commands.receipt(room, requestId, first.subject.id);
      if (old && JSON.stringify(old.command) !== JSON.stringify(command))
        throw new AccessDenied("INVALID");
      if (old?.completed) {
        reply(200, { requestId, ...old, saved: false });
        return null;
      }
      if ((await access.authorize(token, { room })).subject.role === "kid")
        throw new AccessDenied("FORBIDDEN");
      return Object.freeze({
        room,
        execute: async (control) => {
          try {
            const fresh = await access.authorize(token, { room });
            if (
              fresh.subject.role === "kid" ||
              fresh.subject.id !== first.subject.id
            )
              throw new AccessDenied("FORBIDDEN");
            const accepted = await commands.begin(
              control.lease,
              requestId,
              fresh.subject.id,
              command,
              fresh.expiresAt,
            );
            if (accepted.completed) {
              const { dispatch: _dispatch, ...receipt } = accepted;
              return { requestId, ...receipt, saved: false };
            }
            if (!accepted.dispatch) {
              reply(accepted.current ? 503 : 409, {
                error:
                  accepted.ownerEpoch === control.lease.epoch
                    ? "SUPERSEDED"
                    : "STAFF_UNCONFIRMED",
                requestId,
                saved: false,
              });
              return null;
            }
            const outcome = await control.staff({
              requestId,
              revision: accepted.revision,
              actorId: fresh.subject.id,
              command,
              expiresAt: fresh.expiresAt,
            });
            const result = await commands.finish(
              control.lease,
              requestId,
              fresh.subject.id,
              outcome,
            );
            onEvent("VOXEL_STAFF_COMPLETED", {
              correlationId: requestId,
              kind: command.kind,
              applied: outcome.ok,
              revision: result.revision,
            });
            return { requestId, ...result, saved: false };
          } catch (error) {
            fail(error);
            return null;
          }
        },
      });
    } catch (error) {
      fail(error);
      return null;
    }
  };
}
