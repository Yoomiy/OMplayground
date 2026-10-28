import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  SessionProjection,
  SessionView,
} from "../../../games/voxel/src/server/session-projection.ts";
import type { RoomLease } from "../../../games/voxel/src/server/checkpoint-storage.ts";
import type { AdmittedActor } from "../../../games/voxel/src/sim/game-room.ts";
import type { RoomPolicy } from "../../../games/voxel/src/server/room-policy.ts";
import { PersistenceError } from "./supabase-persistence.ts";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const ownership = (lease: RoomLease) => ({
  p_session: lease.room,
  p_world: lease.worldId,
  p_owner: lease.owner,
  p_epoch: lease.epoch,
});
/** Only the authoritative service writes the platform's voxel session projection. */
export class SupabaseSessions implements SessionProjection {
  private client: SupabaseClient;
  private now: () => number;
  constructor(client: SupabaseClient, now: () => number = Date.now) {
    this.client = client;
    this.now = now;
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
    const result = await this.rpc("voxel_session_projection_status", {});
    if (
      !result ||
      typeof result !== "object" ||
      Array.isArray(result) ||
      Object.keys(result).length !== 2 ||
      !("schema" in result) ||
      result.schema !== 1 ||
      !("authoritativeWrites" in result) ||
      result.authoritativeWrites !== true
    )
      throw new PersistenceError("session_installation_protocol");
  }
  async initialize(lease: RoomLease) {
    if ((await this.rpc("voxel_initialize_session", ownership(lease))) !== true)
      throw new PersistenceError("session_initialize");
  }
  async verifyRosterInstallation() {
    const result = await this.rpc("voxel_roster_status", {});
    if (
      !result ||
      typeof result !== "object" ||
      Array.isArray(result) ||
      Object.keys(result).length !== 2 ||
      !("schema" in result) ||
      result.schema !== 1 ||
      !("revisionFencing" in result) ||
      result.revisionFencing !== true
    )
      throw new PersistenceError("roster_installation_protocol");
  }
  async accept(
    lease: RoomLease,
    actor: AdmittedActor,
    proof: { expiresAt: number; membershipRevision?: number },
  ) {
    if (actor.role === "observer") return;
    if (
      !UUID.test(actor.id) ||
      !Number.isSafeInteger(proof.membershipRevision) ||
      (proof.membershipRevision as number) < 0 ||
      !Number.isFinite(proof.expiresAt) ||
      proof.expiresAt <= this.now() ||
      proof.expiresAt > this.now() + 5000
    )
      throw new Error("invalid platform actor proof");
    if (
      (await this.rpc("voxel_accept_member_revision", {
        ...ownership(lease),
        p_actor: actor.id,
        p_revision: proof.membershipRevision,
        p_authorized_until: new Date(proof.expiresAt).toISOString(),
      })) !== true
    )
      throw new PersistenceError("session_accept");
  }
  async project(
    lease: RoomLease,
    sequence: number,
    view: SessionView,
  ): Promise<boolean> {
    if (
      !Number.isSafeInteger(sequence) ||
      sequence < 1 ||
      !["playing", "paused", "ended"].includes(view.state) ||
      view.participants.some((id) => !UUID.test(id))
    )
      throw new Error("invalid platform projection");
    const result = await this.rpc("voxel_project_session", {
      ...ownership(lease),
      p_sequence: sequence,
      p_state: view.state,
      p_participants: [...new Set(view.participants)],
    });
    if (typeof result !== "boolean")
      throw new PersistenceError("session_projection_protocol");
    return result;
  }
  async roomPolicy(room: string): Promise<RoomPolicy> {
    if (!UUID.test(room)) throw new Error("invalid platform room");
    const started = this.now(),
      value = await this.rpc("voxel_session_policy", { p_session: room }),
      now = this.now();
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.keys(value).length !== 1 ||
      !("state" in value) ||
      !["playing", "paused", "ended"].includes(value.state as string) ||
      !Number.isFinite(now) ||
      now < started ||
      now >= started + 5000
    )
      throw new PersistenceError("session_policy_protocol");
    return Object.freeze({
      state: value.state as RoomPolicy["state"],
      expiresAt: started + 5000,
    });
  }
}
