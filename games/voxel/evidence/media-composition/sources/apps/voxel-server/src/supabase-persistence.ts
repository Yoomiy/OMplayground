import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CheckpointObjects,
  RoomMetadata,
  RoomLease,
  CheckpointPointer,
  StoredObject,
} from "../../../games/voxel/src/server/checkpoint-storage.ts";

export const CHECKPOINT_BUCKET = "voxel-checkpoints";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const digest = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
function exact(
  value: unknown,
  fields: readonly string[],
): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === fields.length &&
    fields.every((key) => Object.hasOwn(value, key))
  );
}
const integer = (value: unknown, min = 0): value is number =>
  Number.isSafeInteger(value) && (value as number) >= min;
function validObject(value: unknown): value is StoredObject {
  return (
    exact(value, ["key", "sha256", "bytes"]) &&
    typeof value.sha256 === "string" &&
    /^[a-f0-9]{64}$/.test(value.sha256) &&
    typeof value.key === "string" &&
    value.key.split("/").length === 3 &&
    value.key.split("/")[0] === "v1" &&
    /^[a-f0-9]{64}$/.test(value.key.split("/")[1]) &&
    value.key.split("/")[2] === `${value.sha256}.json` &&
    integer(value.bytes, 1)
  );
}
function pointer(value: unknown): value is CheckpointPointer {
  return (
    exact(value, ["ownerEpoch", "sequence", "object"]) &&
    integer(value.ownerEpoch, 1) &&
    integer(value.sequence, 1) &&
    validObject(value.object)
  );
}
/** Provider messages can contain URLs or credentials; preserve only a bounded machine code. */
export class PersistenceError extends Error {
  readonly operation: string;
  readonly providerCode: string;
  constructor(operation: string, error?: unknown) {
    const raw =
      error && typeof error === "object"
        ? ((error as { code?: unknown; statusCode?: unknown; status?: unknown })
            .code ??
          (error as { statusCode?: unknown }).statusCode ??
          (error as { status?: unknown }).status)
        : undefined;
    const code =
      typeof raw === "string" || typeof raw === "number" ? String(raw) : "";
    const safe =
      /^(?:[0-9A-Z]{5}|PGRST[0-9]{3}|[1-5][0-9]{2})$/.test(code) ||
      [
        "Duplicate",
        "NoSuchBucket",
        "NoSuchKey",
        "ResourceAlreadyExists",
      ].includes(code)
        ? code
        : "UNAVAILABLE";
    super(`Supabase ${operation} failed (${safe})`);
    this.operation = operation;
    this.providerCode = safe;
  }
}
export function createSupabaseServerClient(
  env: Readonly<Record<string, string | undefined>> = process.env,
  request: typeof fetch = fetch,
  timeoutMs = 8000,
): SupabaseClient {
  const url = env.SUPABASE_URL?.trim(),
    secret = env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret?.startsWith("sb_secret_"))
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required");
  let endpoint: URL;
  try {
    endpoint = new URL(url);
  } catch {
    throw new Error("invalid Supabase endpoint");
  }
  if (
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    (endpoint.protocol !== "https:" &&
      !(
        endpoint.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname)
      ))
  )
    throw new Error("invalid Supabase endpoint");
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000)
    throw new Error("invalid Supabase request timeout");
  const client = createClient(url, secret, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: async (input, init) => {
        const signals = [
          AbortSignal.timeout(timeoutMs),
          ...(init?.signal ? [init.signal] : []),
        ];
        const headers = new Headers(init?.headers);
        // SDK defaults put the API key in both headers. Secret keys are not JWTs.
        if (headers.get("Authorization") === `Bearer ${secret}`)
          headers.delete("Authorization");
        return request(input, {
          ...init,
          headers,
          signal: AbortSignal.any(signals),
        });
      },
    },
  });
  return client;
}
export function createSupabasePersistence(
  env: Readonly<Record<string, string | undefined>> = process.env,
  request: typeof fetch = fetch,
  timeoutMs = 8000,
): SupabasePersistence {
  return new SupabasePersistence(
    createSupabaseServerClient(env, request, timeoutMs),
  );
}
/** Service-only adapter. It is composed outside the platform-independent game package. */
export class SupabasePersistence implements CheckpointObjects, RoomMetadata {
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
  async verifyInstallation(): Promise<void> {
    const result = await this.rpc("voxel_persistence_status", {});
    if (
      !exact(result, ["schema", "privateBucket"]) ||
      result.schema !== 1 ||
      result.privateBucket !== true
    )
      throw new PersistenceError("installation_protocol");
  }
  async collectGarbage(
    batch = 64,
  ): Promise<{ pruned: number; deleted: number; failed: number }> {
    if (!Number.isSafeInteger(batch) || batch < 1 || batch > 256)
      throw new Error("invalid cleanup batch");
    const pruned = await this.rpc("voxel_prune_checkpoints", {});
    if (!integer(pruned)) throw new PersistenceError("retention_protocol");
    const result = await this.rpc("voxel_claim_garbage", { p_limit: batch });
    if (
      !Array.isArray(result) ||
      result.length > batch ||
      result.some(
        (entry) =>
          !exact(entry, ["key", "token"]) ||
          typeof entry.key !== "string" ||
          !/^v1\/[a-f0-9]{64}\/[a-f0-9]{64}\.json$/.test(entry.key) ||
          typeof entry.token !== "string" ||
          !UUID.test(entry.token),
      )
    )
      throw new PersistenceError("cleanup_protocol");
    const claims = result as { key: string; token: string }[];
    let next = 0,
      deleted = 0,
      failed = 0;
    await Promise.all(
      Array.from({ length: Math.min(4, claims.length) }, async () => {
        for (;;) {
          const index = next++;
          if (index >= claims.length) return;
          const claim = claims[index];
          try {
            const response = await this.client.storage
              .from(CHECKPOINT_BUCKET)
              .remove([claim.key]);
            if (response.error)
              throw new PersistenceError("object_delete", response.error);
            const done = await this.rpc("voxel_finish_garbage", {
              p_key: claim.key,
              p_token: claim.token,
            });
            if (done !== true) throw new PersistenceError("cleanup_finish");
            deleted++;
          } catch {
            failed++;
          }
        }
      }),
    );
    return { pruned, deleted, failed };
  }
  async acquire(room: string, owner: string): Promise<RoomLease | null> {
    if (!UUID.test(room) || !UUID.test(owner))
      throw new Error("invalid durable room identity");
    const value = await this.rpc("voxel_acquire_room", {
      p_session: room,
      p_owner: owner,
    });
    if (value === null) return null;
    if (
      !exact(value, [
        "room",
        "worldId",
        "owner",
        "epoch",
        "sequence",
        "validForMs",
        "checkpoint",
      ]) ||
      value.room !== room ||
      value.owner !== owner ||
      typeof value.worldId !== "string" ||
      !UUID.test(value.worldId) ||
      !integer(value.epoch, 1) ||
      !integer(value.sequence) ||
      value.validForMs !== 30000 ||
      (value.checkpoint === null
        ? value.sequence !== 0
        : !pointer(value.checkpoint) ||
          value.checkpoint.sequence !== value.sequence ||
          value.checkpoint.ownerEpoch > value.epoch)
    )
      throw new PersistenceError("acquire_protocol");
    const checkpoint = value.checkpoint as CheckpointPointer | null;
    return Object.freeze({
      ...value,
      checkpoint:
        checkpoint === null
          ? null
          : Object.freeze({
              ...checkpoint,
              object: Object.freeze({ ...checkpoint.object }),
            }),
    }) as RoomLease;
  }
  private owner(lease: RoomLease) {
    if (
      ![lease.room, lease.worldId, lease.owner].every((id) => UUID.test(id)) ||
      !integer(lease.epoch, 1)
    )
      throw new Error("invalid durable room lease");
    return {
      p_session: lease.room,
      p_world: lease.worldId,
      p_owner: lease.owner,
      p_epoch: lease.epoch,
    };
  }
  async renew(lease: RoomLease): Promise<{ validForMs: number } | null> {
    const value = await this.rpc("voxel_renew_room", this.owner(lease));
    if (value === null) return null;
    if (!exact(value, ["validForMs"]) || value.validForMs !== 30000)
      throw new PersistenceError("renew_protocol");
    return { validForMs: 30000 };
  }
  async release(lease: RoomLease): Promise<void> {
    await this.rpc("voxel_release_room", this.owner(lease));
  }
  async commit(
    lease: RoomLease,
    previousSequence: number,
    value: CheckpointPointer,
    objects: readonly StoredObject[],
  ): Promise<boolean> {
    if (
      !integer(previousSequence) ||
      !pointer(value) ||
      value.ownerEpoch !== lease.epoch ||
      value.sequence !== previousSequence + 1 ||
      !objects.length ||
      !objects.every(validObject)
    )
      throw new Error("invalid checkpoint commit");
    const result = await this.rpc("voxel_commit_checkpoint", {
      ...this.owner(lease),
      p_previous: previousSequence,
      p_pointer: value,
      p_objects: objects,
    });
    if (typeof result !== "boolean")
      throw new PersistenceError("commit_protocol");
    return result;
  }
  private verify(object: StoredObject, bytes: Uint8Array) {
    if (
      !validObject(object) ||
      bytes.byteLength !== object.bytes ||
      digest(bytes) !== object.sha256
    )
      throw new Error("checkpoint object integrity failure");
  }
  async put(object: StoredObject, bytes: Uint8Array): Promise<void> {
    const body = Uint8Array.from(bytes);
    this.verify(object, body);
    const prepared = await this.rpc("voxel_prepare_object", {
      p_object: object,
    });
    if (
      !exact(prepared, ["token"]) ||
      typeof prepared.token !== "string" ||
      !UUID.test(prepared.token)
    )
      throw new PersistenceError("object_prepare");
    try {
      const response = await this.client.storage
        .from(CHECKPOINT_BUCKET)
        .upload(object.key, body, {
          upsert: false,
          contentType: "application/json",
          cacheControl: "31536000",
          metadata: { sha256: object.sha256 },
        });
      if (response.error) {
        const code = (response.error as { statusCode?: unknown }).statusCode,
          status = (response.error as { status?: unknown }).status;
        if (
          String(code) !== "409" &&
          status !== 409 &&
          String(code) !== "Duplicate"
        )
          throw new PersistenceError("object_upload", response.error);
        // A create-only conflict is accepted only after verifying the existing bytes.
        await this.get(object);
      }
    } catch (error) {
      throw error instanceof PersistenceError
        ? error
        : new PersistenceError("object_upload", error);
    }
    const complete = await this.rpc("voxel_complete_object", {
      p_key: object.key,
      p_token: prepared.token,
    });
    if (complete !== true) throw new PersistenceError("object_complete");
  }
  async get(object: StoredObject): Promise<Uint8Array> {
    if (!validObject(object))
      throw new Error("invalid checkpoint object reference");
    try {
      const response = await this.client.storage
        .from(CHECKPOINT_BUCKET)
        .download(object.key);
      if (response.error || !response.data)
        throw new PersistenceError("object_download", response.error);
      const bytes = new Uint8Array(await response.data.arrayBuffer());
      this.verify(object, bytes);
      return bytes;
    } catch (error) {
      throw error instanceof PersistenceError
        ? error
        : new PersistenceError("object_download", error);
    }
  }
}
