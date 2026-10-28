import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createSupabaseServerClient } from "/home/ubuntu/OMplayground/apps/voxel-server/src/supabase-persistence.ts";
const trace: { method: string; table: string }[] = [];
const origin = new URL(process.env.SUPABASE_URL!).origin;
const allowed = new Set(["games", "avatar_presets", "kid_profiles"]);
const client = createSupabaseServerClient(process.env, async (input, init) => {
  const request = new Request(input, init), url = new URL(request.url);
  const table = url.pathname.split("/").at(-1)!;
  assert.equal(url.origin, origin);
  assert.equal(request.method, "HEAD");
  assert.equal(url.pathname, "/rest/v1/" + table);
  assert(allowed.has(table));
  assert.equal(url.searchParams.get("select"), "id");
  trace.push({ method: request.method, table });
  return fetch(request);
});
const results = await Promise.all([
  client.from("games").select("id", { count: "exact", head: true })
    .or("thumbnail_url.ilike.%minecraft-assets%,game_url.ilike.%minecraft-assets%").retry(false),
  client.from("avatar_presets").select("id", { count: "exact", head: true })
    .ilike("image_url", "%minecraft-assets%").retry(false),
  client.from("kid_profiles").select("id", { count: "exact", head: true })
    .ilike("avatar_url", "%minecraft-assets%").retry(false),
]);
const counts = results.map((result, index) => {
  assert.equal(result.error, null, "read-only asset count unavailable at query " + index);
  assert.equal(result.data, null);
  assert(Number.isSafeInteger(result.count) && result.count! >= 0);
  return result.count;
});
assert.equal(trace.length, 3);
const report = {
  result: counts.every((count) => count === 0) ? "NO_CONFIGURED_CATALOG_OR_AVATAR_REFERENCES_TO_RETIRED_ASSETS" : "LEGACY_ASSET_DATA_REFERENCES_REQUIRE_REVIEW",
  checkedAt: new Date().toISOString(),
  configuredOriginSha256: createHash("sha256").update(origin).digest("hex"),
  matchingCounts: { gameCatalog: counts[0], avatarPresets: counts[1], profileAvatarUrls: counts[2] },
  trace,
  rowValuesReturned: false,
  hostedWrites: false,
};
writeFileSync("/tmp/voxel-legacy-assets-hosted-read.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report));
assert(counts.every((count) => count === 0), "Do not remove assets with live data references");
