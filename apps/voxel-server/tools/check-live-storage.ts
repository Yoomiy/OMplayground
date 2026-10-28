import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  createSupabaseServerClient,
  SupabasePersistence,
  PersistenceError,
  CHECKPOINT_BUCKET,
} from "../src/supabase-persistence.ts";
if (process.env.VOXEL_LIVE_CHECK !== "1")
  throw new Error(
    "Set VOXEL_LIVE_CHECK=1 to create and remove one private qualification object",
  );
const publicKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  publicUrl = process.env.VITE_SUPABASE_URL;
if (
  !publicKey?.startsWith("sb_publishable_") ||
  !publicUrl ||
  !process.env.SUPABASE_URL ||
  new URL(publicUrl).origin !== new URL(process.env.SUPABASE_URL).origin
)
  throw new Error(
    "Matching server and publishable project configuration is required",
  );
const client = createSupabaseServerClient(),
  backend = new SupabasePersistence(client),
  run = randomUUID();
const path = `qualification/${run}.json`,
  text = JSON.stringify({ schema: 1, qualification: "voxel-persistence", run });
const hash = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");
const report: Record<string, unknown> = {
  result: "FAIL",
  run,
  bucket: CHECKPOINT_BUCKET,
  path,
  startedAt: new Date().toISOString(),
  cleanup: false,
};
let attempted = false;
try {
  await backend.verifyInstallation();
  const bucket = await client.storage.getBucket(CHECKPOINT_BUCKET);
  if (bucket.error || !bucket.data || bucket.data.public !== false)
    throw new Error("BUCKET_NOT_PRIVATE");
  attempted = true;
  const uploaded = await client.storage
    .from(CHECKPOINT_BUCKET)
    .upload(path, Buffer.from(text), {
      upsert: false,
      contentType: "application/json",
    });
  if (uploaded.error)
    throw new PersistenceError("qualification_upload", uploaded.error);
  const duplicate = await client.storage
    .from(CHECKPOINT_BUCKET)
    .upload(path, Buffer.from("different bytes"), {
      upsert: false,
      contentType: "application/json",
    });
  const code = (duplicate.error as { statusCode?: unknown } | null)?.statusCode,
    status = (duplicate.error as { status?: unknown } | null)?.status;
  if (
    !duplicate.error ||
    !(["409", "Duplicate"].includes(String(code)) || status === 409)
  )
    throw new Error("DUPLICATE_NOT_REJECTED");
  const downloaded = await client.storage
    .from(CHECKPOINT_BUCKET)
    .download(path);
  if (
    downloaded.error ||
    !downloaded.data ||
    hash(new Uint8Array(await downloaded.data.arrayBuffer())) !== hash(text)
  )
    throw new Error("STORAGE_BYTES_MISMATCH");
  const base = new URL(process.env.SUPABASE_URL!);
  const anonymous = await fetch(
    new URL(`/storage/v1/object/${CHECKPOINT_BUCKET}/${path}`, base),
    { headers: { apikey: publicKey }, signal: AbortSignal.timeout(8000) },
  );
  const publicRead = await fetch(
    new URL(`/storage/v1/object/public/${CHECKPOINT_BUCKET}/${path}`, base),
    { signal: AbortSignal.timeout(8000) },
  );
  if (
    ![400, 401, 403, 404].includes(anonymous.status) ||
    ![400, 401, 403, 404].includes(publicRead.status)
  )
    throw new Error("UNEXPECTED_PUBLIC_ACCESS");
  Object.assign(report, {
    result: "PASS",
    privateBucket: true,
    immutable: true,
    byteHash: hash(text),
    anonymousStatus: anonymous.status,
    publicStatus: publicRead.status,
  });
} catch (error) {
  report.errorCode =
    error instanceof PersistenceError
      ? error.providerCode
      : error instanceof Error && /^[A-Z_]{1,64}$/.test(error.message)
        ? error.message
        : "CHECK_FAILED";
} finally {
  if (attempted) {
    try {
      const removed = await client.storage
        .from(CHECKPOINT_BUCKET)
        .remove([path]);
      const missing = await client.storage
        .from(CHECKPOINT_BUCKET)
        .download(path);
      const code = (missing.error as { statusCode?: unknown } | null)
          ?.statusCode,
        status = (missing.error as { status?: unknown } | null)?.status;
      report.cleanup =
        !removed.error &&
        !!missing.error &&
        (String(code) === "404" ||
          status === 404 ||
          String(code) === "not_found");
    } catch {
      report.cleanup = false;
    }
  }
  if (attempted && !report.cleanup) report.result = "FAIL";
  report.finishedAt = new Date().toISOString();
  const folder = new URL("../test-results/", import.meta.url);
  mkdirSync(folder, { recursive: true });
  writeFileSync(
    new URL("live-storage.json", folder),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
  if (report.result !== "PASS") process.exitCode = 1;
}
