import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID, createHash } from "node:crypto";
import {
  createSupabasePersistence,
  PersistenceError,
  CHECKPOINT_BUCKET,
} from "../src/supabase-persistence.ts";
import type {
  RoomLease,
  StoredObject,
} from "../../../games/voxel/src/server/checkpoint-storage.ts";
const secret = "sb_secret_fixture_only";
const hash = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
function service(
  handler: (request: Request) => Promise<Response> | Response,
  timeout = 8000,
) {
  return createSupabasePersistence(
    { SUPABASE_URL: "https://fixture.invalid", SUPABASE_SECRET_KEY: secret },
    async (input, init) => {
      const request = new Request(input, init);
      assert.equal(request.headers.get("apikey"), secret);
      assert.equal(
        request.headers.has("Authorization"),
        false,
        "API secrets are not bearer JWTs",
      );
      assert.equal(request.url.includes(secret), false);
      return handler(request);
    },
    timeout,
  );
}
const object = (world: string, text: string): StoredObject => ({
  key: `v1/${hash(world)}/${hash(text)}.json`,
  sha256: hash(text),
  bytes: Buffer.byteLength(text),
});

test("installed SDK sends canonical service RPCs with a secret apikey and accepts only coherent immutable lease replies", async () => {
  const room = randomUUID(),
    owner = randomUUID(),
    worldId = randomUUID();
  const lease: RoomLease = {
    room,
    owner,
    worldId,
    epoch: 1,
    sequence: 0,
    validForMs: 30000,
    checkpoint: null,
  };
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const backend = service(async (request) => {
    const name = new URL(request.url).pathname.split("/").at(-1)!;
    calls.push({
      name,
      args: (await request.json()) as Record<string, unknown>,
    });
    if (name === "voxel_persistence_status")
      return response({ schema: 1, privateBucket: true });
    if (name === "voxel_acquire_room") return response(lease);
    if (name === "voxel_renew_room") return response({ validForMs: 30000 });
    if (name === "voxel_release_room") return response(null);
    if (name === "voxel_commit_checkpoint") return response(true);
    throw new Error("unexpected RPC");
  });
  await backend.verifyInstallation();
  const acquired = await backend.acquire(room, owner);
  assert.ok(acquired);
  assert.equal(Object.isFrozen(acquired), true);
  assert.deepEqual(acquired, lease);
  assert.deepEqual(await backend.renew(acquired), { validForMs: 30000 });
  const root = object(worldId, "root"),
    pointer = { ownerEpoch: 1, sequence: 1, object: root };
  assert.equal(await backend.commit(acquired, 0, pointer, [root]), true);
  assert.deepEqual(
    calls.find((v) => v.name === "voxel_commit_checkpoint")!.args,
    {
      p_session: room,
      p_world: worldId,
      p_owner: owner,
      p_epoch: 1,
      p_previous: 0,
      p_pointer: pointer,
      p_objects: [root],
    },
  );
  await backend.release(acquired);
  const corrupt = service(() => response({ ...lease, sequence: 2 }));
  await assert.rejects(corrupt.acquire(room, owner), /acquire_protocol/);
});

test("create-only uploads copy bytes before IO and verify a duplicate object before marking it ready", async () => {
  const world = randomUUID(),
    text = '{"owned":17}',
    bytes = Buffer.from(text),
    ref = object(world, text),
    token = randomUUID();
  let stored: string | null = null,
    completed = 0,
    uploads = 0;
  let unblock!: () => void, entered!: () => void;
  const held = new Promise<void>((r) => (unblock = r)),
    preparing = new Promise<void>((r) => (entered = r));
  const backend = service(async (request) => {
    const path = new URL(request.url).pathname;
    if (path.endsWith("/voxel_prepare_object")) {
      entered();
      await held;
      return response({ token });
    }
    if (path.endsWith("/voxel_complete_object")) {
      completed++;
      return response(true);
    }
    assert.equal(path, `/storage/v1/object/${CHECKPOINT_BUCKET}/${ref.key}`);
    if (request.method === "POST") {
      uploads++;
      assert.equal(request.headers.get("x-upsert"), "false");
      assert.equal(request.headers.get("content-type"), "application/json");
      assert.equal(await request.text(), text);
      if (stored !== null)
        return response(
          { statusCode: "409", error: "Duplicate", message: "already exists" },
          409,
        );
      stored = text;
      return response({
        Key: `${CHECKPOINT_BUCKET}/${ref.key}`,
        Id: randomUUID(),
      });
    }
    assert.equal(request.method, "GET");
    return new Response(stored!, {
      headers: { "Content-Type": "application/json" },
    });
  });
  const saving = backend.put(ref, bytes);
  try {
    await preparing;
    bytes[0] = 0;
  } finally {
    unblock();
  }
  await saving;
  assert.equal(completed, 1);
  await backend.put(ref, Buffer.from(text));
  assert.equal(uploads, 2);
  assert.equal(completed, 2);
  assert.equal(Buffer.from(await backend.get(ref)).toString(), text);
  stored = "corrupt";
  await assert.rejects(backend.put(ref, Buffer.from(text)), /object_download/);
  assert.equal(
    completed,
    2,
    "a conflict with wrong bytes never becomes a ready object",
  );
});

test("provider errors cannot expose credentials and an unavailable provider respects the request deadline", async () => {
  const room = randomUUID(),
    owner = randomUUID();
  const failed = service(() =>
    response(
      { code: secret, message: `secret=${secret}`, details: secret },
      503,
    ),
  );
  await assert.rejects(failed.acquire(room, owner), (error: unknown) => {
    assert.ok(error instanceof PersistenceError);
    assert.equal(error.message.includes(secret), false);
    assert.equal(error.providerCode, "UNAVAILABLE");
    return true;
  });
  const timeout = service(
    (request) =>
      new Promise((_resolve, reject) => {
        const abort = () =>
          reject(new DOMException("request aborted", "AbortError"));
        if (request.signal.aborted) abort();
        else request.signal.addEventListener("abort", abort, { once: true });
      }),
    25,
  );
  const started = performance.now();
  await assert.rejects(timeout.acquire(room, owner), /Supabase/);
  assert.ok(performance.now() - started < 2000);
});

test("failed Storage cleanup retains its catalog claim; completion only follows a successful API deletion", async () => {
  const key = object(randomUUID(), "orphan").key,
    token = randomUUID();
  let failDelete = true,
    finished = 0;
  const backend = service(async (request) => {
    const path = new URL(request.url).pathname;
    if (path.endsWith("/voxel_prune_checkpoints")) return response(3);
    if (path.endsWith("/voxel_claim_garbage"))
      return response([{ key, token }]);
    if (path.endsWith("/voxel_finish_garbage")) {
      finished++;
      return response(true);
    }
    assert.equal(path, `/storage/v1/object/${CHECKPOINT_BUCKET}`);
    assert.equal(request.method, "DELETE");
    assert.deepEqual(await request.json(), { prefixes: [key] });
    return failDelete
      ? response({ statusCode: "503", message: secret }, 503)
      : response([]);
  });
  assert.deepEqual(await backend.collectGarbage(), {
    pruned: 3,
    deleted: 0,
    failed: 1,
  });
  assert.equal(finished, 0);
  failDelete = false;
  assert.deepEqual(await backend.collectGarbage(), {
    pruned: 3,
    deleted: 1,
    failed: 0,
  });
  assert.equal(finished, 1);
});

test("configuration rejects missing, public or legacy API keys and nonsecure remote endpoints", () => {
  for (const env of [
    {},
    {
      SUPABASE_URL: "https://fixture.invalid",
      SUPABASE_SECRET_KEY: "sb_publishable_test",
    },
    {
      SUPABASE_URL: "https://fixture.invalid",
      SUPABASE_SERVICE_ROLE_KEY: "legacy",
    },
    { SUPABASE_URL: "http://fixture.invalid", SUPABASE_SECRET_KEY: secret },
  ])
    assert.throws(() => createSupabasePersistence(env));
});

test("the shared server SDK preserves an explicit user bearer token for identity verification", async () => {
  const { createSupabaseServerClient } = await import(
    "../src/supabase-persistence.ts"
  );
  const token = "user-access-token-fixture",
    id = randomUUID();
  const client = createSupabaseServerClient(
    { SUPABASE_URL: "https://fixture.invalid", SUPABASE_SECRET_KEY: secret },
    async (input, init) => {
      const request = new Request(input, init);
      assert.equal(new URL(request.url).pathname, "/auth/v1/user");
      assert.equal(request.headers.get("apikey"), secret);
      assert.equal(request.headers.get("Authorization"), `Bearer ${token}`);
      assert.equal(request.url.includes(token), false);
      return response({ id, aud: "authenticated", role: "authenticated" });
    },
  );
  const result = await client.auth.getUser(token);
  assert.equal(result.error, null);
  assert.equal(result.data.user?.id, id);
});
