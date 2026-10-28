import { execFileSync } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = new URL("../../../", import.meta.url);
const sha = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

export async function runtimeInventory(
  root: string,
  prefix = "",
): Promise<{ path: string; hash: string }[]> {
  const entries = await readdir(join(root, prefix), { withFileTypes: true });
  const result: { path: string; hash: string }[] = [];
  for (const entry of entries.sort((a, b) =>
    a.name.localeCompare(b.name, "en"),
  )) {
    if (entry.name === "node_modules") continue;
    const path = prefix + entry.name;
    if (entry.isSymbolicLink())
      throw new Error("Runtime package cannot contain source symlinks");
    if (entry.isDirectory())
      result.push(...(await runtimeInventory(root, path + "/")));
    else if (entry.isFile() && path !== "runtime-package.json")
      result.push({ path, hash: sha(await readFile(join(root, path))) });
    else if (!entry.isFile()) throw new Error("Invalid runtime package entry");
  }
  return result;
}

/** Copies an explicit allowlist; never copies credentials, caches or evidence. */
export async function packageRelease(destination: string) {
  if (process.versions.node !== "24.21.0")
    throw new Error("Node 24.21.0 required");
  execFileSync(
    process.execPath,
    [fileURLToPath(new URL("games/voxel/tools/verify-release.mjs", repo))],
    { stdio: "pipe" },
  );
  await mkdir(destination); // Existing paths are refused; the caller owns cleanup.
  const paths = [
    "package.json",
    "package-lock.json",
    "apps/voxel-server/package.json",
    "apps/voxel-server/src",
    "packages/game-logic/package.json",
    "packages/game-logic/dist",
    "packages/observability/package.json",
    "packages/observability/dist",
    "games/voxel/package.json",
    "games/voxel/package-lock.json",
    "games/voxel/LICENSE",
    "games/voxel/UPSTREAM.md",
    "games/voxel/engine/LICENSE",
    "games/voxel/src/server/admission.ts",
    "games/voxel/src/server/session-projection.ts",
    "games/voxel/src/shared", // School validators share the production game contracts.
    "games/voxel/config/world.json",
    "games/voxel/dist-server",
    "games/voxel/artifacts/build.json",
    "games/voxel/artifacts/content.json",
    "games/voxel/artifacts/release.json",
  ];
  for (const path of paths) {
    await mkdir(dirname(join(destination, path)), { recursive: true });
    await cp(new URL(path, repo), join(destination, path), {
      recursive: true,
      filter: (source) =>
        !/(?:^|\/)__tests__(?:\/|$)|\.test\.[^/]+$/.test(source),
    });
  }
  for (const file of ["verify-runtime.mjs", "healthcheck.mjs"])
    await cp(new URL(file, import.meta.url), join(destination, file));
  const build = JSON.parse(
    await readFile(new URL("games/voxel/artifacts/build.json", repo), "utf8"),
  );
  const manifest = {
    schema: 1,
    buildId: build.buildId,
    engineHash: build.engineHash,
    contentHash: build.contentHash,
    files: await runtimeInventory(destination),
  };
  await writeFile(
    join(destination, "runtime-package.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  return manifest;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const parent = fileURLToPath(new URL("../dist/", import.meta.url));
  await mkdir(parent, { recursive: true });
  const staging = await mkdtemp(join(parent, ".package-"));
  try {
    const manifest = await packageRelease(join(staging, "runtime"));
    execFileSync(
      process.execPath,
      [join(staging, "runtime/verify-runtime.mjs")],
      { stdio: "inherit" },
    );
    await rm(join(parent, "runtime"), { recursive: true, force: true });
    await rename(join(staging, "runtime"), join(parent, "runtime"));
    console.log(
      `Packaged voxel ${manifest.buildId.slice(0, 12)}: apps/voxel-server/dist/runtime`,
    );
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}
