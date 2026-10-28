import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
const root = new URL("./", import.meta.url);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function inventory(prefix = "") {
  const result = [];
  const rows = await readdir(new URL(prefix, root), { withFileTypes: true });
  for (const row of rows.sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    if (row.name === "node_modules") continue;
    const path = prefix + row.name;
    assert(!row.isSymbolicLink(), "Runtime package source symlink");
    if (row.isDirectory()) result.push(...(await inventory(path + "/")));
    else if (row.isFile() && path !== "runtime-package.json")
      result.push({ path, hash: sha(await readFile(new URL(path, root))) });
    else assert(row.isFile(), "Invalid runtime package entry");
  }
  return result;
}
const manifest = JSON.parse(
  await readFile(new URL("runtime-package.json", root), "utf8"),
);
assert.equal(manifest.schema, 1);
assert.deepEqual(
  await inventory(),
  manifest.files,
  "Runtime package inventory mismatch",
);
const build = JSON.parse(
  await readFile(new URL("games/voxel/artifacts/build.json", root), "utf8"),
);
for (const key of ["buildId", "engineHash", "contentHash"])
  assert.equal(manifest[key], build[key]);
// This also verifies the full game inventory before executable code is imported.
await import(new URL("apps/voxel-server/src/release.ts", root)).then((m) =>
  m.loadServerRelease(),
);
console.log(
  `Verified runtime package ${manifest.buildId.slice(0, 12)} (${manifest.files.length} files)`,
);
