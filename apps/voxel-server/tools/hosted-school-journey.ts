import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createSupabaseServerClient,
  SupabasePersistence,
  CHECKPOINT_BUCKET,
} from "../src/supabase-persistence.ts";
import { startVoxelService } from "../src/service.ts";
import { SocketProbe } from "../../../games/voxel/tests/fixtures/socket-probe.ts";
import { CheckpointStorage } from "../../../games/voxel/src/server/checkpoint-storage.ts";
import { loadServerRelease } from "../src/release.ts";
import { mineNaturalResource } from "./hosted-natural-mining.ts";
import { checkHostedRequest, hostedCleanupSql } from "./hosted-school-scope.ts";
import type { ServerMessage } from "../../../games/voxel/src/shared/protocol.ts";

if (process.env.VOXEL_HOSTED_SCHOOL_CHECK !== "1")
  throw new Error(
    "Set VOXEL_HOSTED_SCHOOL_CHECK=1 for temporary hosted qualification identities/session/storage",
  );
const url = process.env.SUPABASE_URL!,
  publicUrl = process.env.VITE_SUPABASE_URL!,
  key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
assert(
  key?.startsWith("sb_publishable_") &&
    new URL(url).origin === new URL(publicUrl).origin,
  "matching project configuration",
);
assert.equal(
  readFileSync(
    new URL("../../../supabase/.temp/project-ref", import.meta.url),
    "utf8",
  ).trim(),
  new URL(url).hostname.split(".")[0],
  "linked cleanup project matches SDK",
);
const run = randomUUID(),
  room = randomUUID(),
  teacher = randomUUID(),
  kid = randomUUID(),
  folder = mkdtempSync(join(tmpdir(), "voxel-hosted-school-")),
  origin = "https://voxel-qualification.invalid",
  admin = createSupabaseServerClient(),
  execute = promisify(execFile),
  runtime = await loadServerRelease();
const report: Record<string, any> = {
  result: "FAIL",
  run,
  room,
  startedAt: new Date().toISOString(),
  buildId: runtime.build.buildId,
  scope:
    "Real hosted Auth/PostgREST/private Storage and packaged gateway/native worker, temporary identities and one private session; socket client, no real school users, browser/SFU/physical-device/deployment qualification",
  stages: [],
  cleanup: {},
};
const journal = { run, room, teacher, kid, worldId: null as string | null };
const persist = () => {
  writeFileSync(
    join(folder, "journal.json"),
    JSON.stringify(journal, null, 2) + "\n",
  );
  writeFileSync(
    join(folder, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
};
persist();
const stage = (name: string) => {
  report.stages.push(name);
  console.log(name);
  persist();
};
function checked<R extends { data: unknown; error: any }>(
  result: R,
  operation: string,
): R["data"] {
  if (result.error)
    throw new Error(
      `${operation}:${/^[A-Za-z0-9_]{1,40}$/.test(String(result.error.code)) ? result.error.code : "UNAVAILABLE"}`,
    );
  return result.data;
}
function required<R extends { data: unknown; error: any }>(
  result: R,
  operation: string,
): NonNullable<R["data"]> {
  const value = checked(result, operation);
  assert(value !== null && value !== undefined, operation + ":MISSING");
  return value as NonNullable<R["data"]>;
}
const sessions = new Map<string, SupabaseClient>();
let service: Awaited<ReturnType<typeof startVoxelService>> | undefined;
const probes: SocketProbe[] = [],
  allowedNamespaces = new Set<string>(),
  requests: Record<string, number> = {},
  errors: string[] = [];
// Guard every service write; scheduled global retention/garbage work is denied.
const scopedFetch: typeof fetch = async (input, init) => {
  const request = new Request(input, init),
    path = new URL(request.url).pathname;
  const rpc = path.startsWith("/rest/v1/rpc/")
    ? path.split("/").at(-1)!
    : undefined;
  if (rpc) requests[rpc] = (requests[rpc] ?? 0) + 1;
  const args = rpc ? await request.clone().json() : undefined;
  if (
    checkHostedRequest(
      request,
      args,
      journal,
      new URL(url).origin,
      allowedNamespaces,
    ) === "deny-maintenance"
  )
    return new Response(JSON.stringify({ code: "42501" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  const response = await fetch(request);
  if (rpc === "voxel_acquire_room" && response.ok) {
    const lease = await response.clone().json();
    if (lease) {
      journal.worldId = lease.worldId;
      allowedNamespaces.add(
        createHash("sha256").update(lease.worldId).digest("hex"),
      );
      persist();
    }
  }
  return response;
};
const cleanupSql = join(folder, "cleanup.sql");
writeFileSync(cleanupSql, hostedCleanupSql({ run, room, teacher, kid }));
async function start() {
  service = await startVoxelService({
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: "0",
      VOXEL_HOST: "127.0.0.1",
      VOXEL_ALLOWED_ORIGINS: origin,
    },
    request: scopedFetch,
    logger: {
      info() {},
      error(v: { context?: Record<string, unknown> }) {
        const e = v.context?.event;
        if (typeof e === "string") errors.push(e);
      },
    },
  });
  const a = service.gateway.address;
  assert(a && typeof a === "object");
  return `http://127.0.0.1:${a.port}`;
}
async function call(
  endpoint: string,
  path: string,
  body: object,
  token: string,
) {
  const response = await fetch(endpoint + path, {
    method: "POST",
    headers: {
      Origin: origin,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  return { status: response.status, value: (await response.json()) as any };
}
async function connect(endpoint: string, token: string, activate = true) {
  const ticket = await call(
    endpoint,
    "/api/voxel/admission",
    { room, participation: "player" },
    token,
  );
  assert.equal(
    ticket.status,
    200,
    `admission status ${ticket.status}:${ticket.value.error ?? ""}`,
  );
  const probe = new SocketProbe(
    endpoint.replace(/^http/, "ws") + "/voxel",
    runtime.content.blocks.length,
  );
  probes.push(probe);
  await once(probe.socket, "open");
  probe.send({
    type: "hello",
    ticket: ticket.value.ticket,
    buildId: ticket.value.buildId,
  });
  const welcome = await probe.event("welcome");
  assert.equal(welcome.mode, "survival");
  const ready = await probe.ready();
  if (!activate) return { probe, baseline: ready, welcome };
  probe.send({ type: "focus", epoch: ready.epoch, active: true });
  const baseline = await probe.wait(
    (e): e is Extract<ServerMessage, { type: "baseline" }> =>
      "type" in e && e.type === "baseline" && e.reason === "focus",
  );
  return { probe, baseline, welcome };
}
async function row() {
  return required(
    await admin
      .from("voxel_worlds")
      .select("world_id,owner_epoch,checkpoint_sequence,namespace")
      .eq("session_id", room)
      .single()
      .retry(false),
    "world_read",
  );
}
try {
  // Auth admin createUser confirms a synthetic address without sending mail.
  for (const [id, role] of [
    [teacher, "teacher"],
    [kid, "kid"],
  ] as const) {
    const username = `voxel-qual-${run.replaceAll("-", "").slice(0, 16)}-${role}`,
      email = username + "@playground.school.local",
      password = randomBytes(32).toString("base64url");
    const created = checked(
      await admin.auth.admin.createUser({
        id,
        email,
        password,
        email_confirm: true,
        app_metadata: { voxel_qualification: run },
      }),
      "auth_create",
    );
    assert.equal(created.user?.id, id);
    checked(
      await admin.from("kid_profiles").insert({
        id,
        username,
        full_name: `בדיקת ווקסל ${role}`,
        gender: "boy",
        grade: "א",
        role,
        is_active: true,
      }),
      "profile_create",
    );
    const client = createClient(publicUrl, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const signed = checked(
      await client.auth.signInWithPassword({ email, password }),
      "auth_signin",
    );
    assert.equal(signed.user?.id, id);
    assert(signed.session);
    sessions.set(id, client);
  }
  stage("temporary_real_auth_profiles_ready");
  const teacherClient = sessions.get(teacher)!,
    token = (await teacherClient.auth.getSession()).data.session!.access_token;
  const catalog = required(
    await teacherClient
      .from("games")
      .select("id,game_url,is_active")
      .eq("game_url", "minecraft")
      .eq("is_active", true)
      .single()
      .retry(false),
    "catalog_read",
  );
  checked(
    await teacherClient
      .from("game_sessions")
      .insert({
        id: room,
        game_id: catalog.id,
        host_id: teacher,
        host_name: "בדיקת ווקסל teacher",
        player_ids: [teacher],
        player_names: ["בדיקת ווקסל teacher"],
        status: "waiting",
        is_open: false,
        invitation_code: `vq-${run}`,
        gender: "boy",
        host_grade: "א",
      })
      .select("id")
      .single(),
    "public_session_create",
  );
  report.catalogId = catalog.id;
  stage("public_rls_private_session_created");
  let endpoint = await start();
  stage("production_service_hosted_ready");
  const kidToken = (await sessions.get(kid)!.auth.getSession()).data.session!
    .access_token;
  const denied = await call(
    endpoint,
    "/api/voxel/admission",
    { room },
    kidToken,
  );
  const denialCode =
    typeof denied.value.error === "string" &&
    /^[A-Z_]{1,60}$/.test(denied.value.error)
      ? denied.value.error
      : "INVALID_RESPONSE";
  report.uninvitedAdmission = { status: denied.status, code: denialCode };
  assert(
    denied.status === 403,
    `uninvited_status_${denied.status}_${denialCode}`,
  );
  assert(denialCode === "SESSION_CLOSED", `uninvited_code_${denialCode}`);
  report.uninvitedKidDenied = true;
  const first = await connect(endpoint, token);
  stage("real_school_native_admission_ready");
  const earned = await mineNaturalResource(
    first.probe,
    first.baseline,
    runtime.content,
    stage,
  );
  report.mining = {
    target: earned.target,
    itemType: earned.itemType,
    inventoryRevision: earned.inventory.revision,
  };
  stage("natural_survival_item_earned");
  const pauseId = randomUUID(),
    paused = await call(
      endpoint,
      "/api/voxel/control",
      { room, requestId: pauseId, action: "pause" },
      token,
    );
  assert.equal(
    paused.status,
    200,
    `pause status ${paused.status}:${paused.value.error ?? ""}`,
  );
  assert(
    paused.value.saved &&
      paused.value.completed &&
      paused.value.savedSequence > 0,
  );
  const saved = await row();
  assert(saved.checkpoint_sequence >= paused.value.savedSequence);
  const backend = new SupabasePersistence(admin),
    pointerRow = required(
      await admin
        .from("voxel_checkpoints")
        .select(
          "owner_epoch,sequence,manifest_key,manifest_sha256,manifest_bytes",
        )
        .eq("world_id", saved.world_id)
        .eq("sequence", paused.value.savedSequence)
        .single()
        .retry(false),
      "checkpoint_read",
    );
  const checkpoint = await new CheckpointStorage(
    saved.world_id,
    backend,
    backend,
    runtime.content,
    runtime.build,
  ).load({
    ownerEpoch: pointerRow.owner_epoch,
    sequence: pointerRow.sequence,
    object: {
      key: pointerRow.manifest_key,
      sha256: pointerRow.manifest_sha256,
      bytes: pointerRow.manifest_bytes,
    },
  });
  const owned = (checkpoint.inventories as any).players.find(
    (p: any) => p.id === teacher,
  );
  assert.deepEqual(owned.bag, earned.inventory.bag);
  assert.equal(owned.revision, earned.inventory.revision);
  report.checkpoint = {
    worldId: saved.world_id,
    sequence: paused.value.savedSequence,
    ownerEpoch: saved.owner_epoch,
    tick: checkpoint.tick,
    inventoryRevision: owned.revision,
  };
  stage("hosted_graph_and_saved_receipt_verified");
  first.probe.socket.terminate();
  await service!.close();
  service = undefined;
  endpoint = await start();
  stage("fresh_production_service_started");
  const second = await connect(endpoint, token, false),
    restored = await row();
  assert.equal(second.welcome.worldId, first.welcome.worldId);
  assert(restored.owner_epoch > saved.owner_epoch);
  const inventory = await second.probe.event("inventory");
  assert.deepEqual(inventory.view.bag, earned.inventory.bag);
  assert.equal(inventory.view.revision, owned.revision);
  const resumed = await call(
    endpoint,
    "/api/voxel/control",
    { room, requestId: randomUUID(), action: "resume" },
    token,
  );
  assert.equal(resumed.status, 200);
  assert.equal(resumed.value.saved, false);
  const replay = await call(
    endpoint,
    "/api/voxel/control",
    { room, requestId: pauseId, action: "pause" },
    token,
  );
  assert.equal(replay.status, 200);
  assert.equal(replay.value.current, false);
  assert.equal(replay.value.savedSequence, paused.value.savedSequence);
  report.restored = {
    worldId: restored.world_id,
    ownerEpoch: restored.owner_epoch,
    inventoryRevision: inventory.view.revision,
    sameBag: true,
    historicalPauseCannotUndoResume: true,
  };
  stage("real_auth_hosted_restart_restored_earned_ownership");
  checked(
    await admin
      .from("kid_profiles")
      .update({ is_active: false })
      .eq("id", teacher),
    "deactivate_owned_profile",
  );
  const closed = await Promise.race([
    once(second.probe.socket, "close").then(() => true),
    new Promise<boolean>((r) => setTimeout(() => r(false), 8000)),
  ]);
  assert(closed, "live account revocation closes actual socket");
  report.accountRevocation = true;
  report.result = "PASS";
} catch (error) {
  report.failure = {
    stage: report.stages.at(-1) ?? "setup",
    code:
      error instanceof Error && /^[A-Za-z0-9_: -]{1,140}$/.test(error.message)
        ? error.message
        : "CHECK_FAILED",
  };
} finally {
  for (const probe of probes) probe.socket.terminate();
  try {
    await service?.close();
    report.cleanup.serviceClosed = true;
  } catch {
    report.cleanup.serviceClosed = false;
  }
  try {
    assert(
      report.cleanup.serviceClosed,
      "stop workers before removing their objects",
    );
    const found = checked(
      await admin
        .from("voxel_worlds")
        .select("world_id,namespace")
        .eq("session_id", room)
        .maybeSingle()
        .retry(false),
      "cleanup_world",
    );
    if (found) {
      assert.equal(
        found.namespace,
        createHash("sha256").update(found.world_id).digest("hex"),
      );
      let removed = 0;
      for (;;) {
        const listed = required(
          await admin.storage
            .from(CHECKPOINT_BUCKET)
            .list(`v1/${found.namespace}`, { limit: 1000 }),
          "cleanup_list",
        );
        if (!listed.length) break;
        const paths = listed.map((o) => {
          assert(/^[a-f0-9]{64}\.json$/.test(o.name));
          return `v1/${found.namespace}/${o.name}`;
        });
        checked(
          await admin.storage.from(CHECKPOINT_BUCKET).remove(paths),
          "cleanup_objects",
        );
        removed += paths.length;
      }
      report.cleanup.storageObjectsRemoved = removed;
    }
    const sql = await execute(
      "supabase",
      ["db", "query", "--linked", "--file", cleanupSql, "--output", "json"],
      {
        cwd: new URL("../../../", import.meta.url),
        timeout: 20000,
        maxBuffer: 1024 * 1024,
      },
    );
    writeFileSync(join(folder, "cleanup-output.json"), sql.stdout);
    report.cleanup.scopedSql = true;
    const missing = checked(
      await admin
        .from("game_sessions")
        .select("id")
        .eq("id", room)
        .maybeSingle()
        .retry(false),
      "cleanup_session_verify",
    );
    assert.equal(missing, null);
    report.cleanup.sessionAbsent = true;
    const missingWorld = checked(
      await admin
        .from("voxel_worlds")
        .select("world_id")
        .eq("session_id", room)
        .maybeSingle()
        .retry(false),
      "cleanup_world_verify",
    );
    assert.equal(missingWorld, null);
    if (found) {
      const missingObjects = required(
        await admin
          .from("voxel_objects")
          .select("object_key")
          .eq("world_id", found.world_id)
          .retry(false),
        "cleanup_graph_verify",
      );
      assert.equal(missingObjects.length, 0);
    }
    report.cleanup.metadataAbsent = true;
  } catch {
    report.cleanup.scopedSql = false;
  }
  for (const id of [kid, teacher]) {
    try {
      assert(
        report.cleanup.scopedSql,
        "remove session before deleting its Auth owners",
      );
      const user = await admin.auth.admin.getUserById(id);
      if (user.data.user) {
        assert.equal(user.data.user.app_metadata.voxel_qualification, run);
        checked(await admin.auth.admin.deleteUser(id), "cleanup_auth");
      }
      const missing = await admin.auth.admin.getUserById(id);
      assert(!missing.data.user && missing.error?.status === 404);
      report.cleanup[id === teacher ? "teacherAbsent" : "kidAbsent"] = true;
    } catch {
      report.cleanup[id === teacher ? "teacherAbsent" : "kidAbsent"] = false;
    }
  }
  if (
    !report.cleanup.serviceClosed ||
    !report.cleanup.sessionAbsent ||
    !report.cleanup.metadataAbsent ||
    !report.cleanup.teacherAbsent ||
    !report.cleanup.kidAbsent
  )
    report.result = "FAIL";
  report.requests = requests;
  report.serviceErrors = errors;
  report.finishedAt = new Date().toISOString();
  persist();
  mkdirSync(new URL("../test-results/", import.meta.url), { recursive: true });
  writeFileSync(
    new URL("../test-results/hosted-school-journey.json", import.meta.url),
    JSON.stringify({ ...report, localArtifacts: folder }, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      result: report.result,
      stages: report.stages,
      failure: report.failure,
      cleanup: report.cleanup,
      localArtifacts: folder,
    }),
  );
  if (report.result !== "PASS") process.exitCode = 1;
}
