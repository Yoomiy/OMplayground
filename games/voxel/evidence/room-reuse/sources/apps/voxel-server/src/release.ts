import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import type { BuildIdentity } from "../../../games/voxel/src/shared/protocol.ts";
import type { ContentManifest } from "../../../games/voxel/src/shared/content.ts";
const hash = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");
/** Validate the release inventory before importing executable gateway/worker code. */
export async function loadServerRelease(
  root: URL = new URL("../../../games/voxel/", import.meta.url),
) {
  const json = async (path: string) =>
    JSON.parse(await readFile(new URL(path, root), "utf8"));
  const [build, content, release] = await Promise.all([
    json("artifacts/build.json"),
    json("artifacts/content.json"),
    json("artifacts/release.json"),
  ]);
  async function entries(
    dir: URL,
    prefix = "",
  ): Promise<{ path: string; hash: string }[]> {
    const rows = await readdir(dir, { withFileTypes: true }),
      result: { path: string; hash: string }[] = [];
    for (const e of rows.sort((a, b) => a.name.localeCompare(b.name, "en"))) {
      if (e.isSymbolicLink() || (!e.isFile() && !e.isDirectory()))
        throw new Error("invalid release entry");
      if (e.isDirectory())
        result.push(
          ...(await entries(new URL(e.name + "/", dir), prefix + e.name + "/")),
        );
      else
        result.push({
          path: prefix + e.name,
          hash: hash(await readFile(new URL(e.name, dir))),
        });
    }
    return result;
  }
  const inventory = await entries(new URL("dist-server/", root));
  if (
    !build ||
    !content ||
    !release ||
    release.buildId !== build.buildId ||
    release.engineHash !== build.engineHash ||
    release.contentHash !== build.contentHash ||
    content.hash !== build.contentHash ||
    !Array.isArray(release.server) ||
    JSON.stringify(inventory) !== JSON.stringify(release.server) ||
    hash(JSON.stringify(inventory)) !== release.serverHash ||
    !inventory.some(
      (e) => e.path === "engine.wasm" && e.hash === build.engineHash,
    )
  )
    throw new Error("voxel release mismatch");
  const [serverBuild, serverContent] = await Promise.all([
    json("dist-server/build.json"),
    json("dist-server/content.json"),
  ]);
  if (
    JSON.stringify(serverBuild) !== JSON.stringify(build) ||
    JSON.stringify(serverContent) !== JSON.stringify(content)
  )
    throw new Error("voxel release identity mismatch");
  const exports = await import(new URL("dist-server/gateway.js", root).href);
  if (typeof exports.createGateway !== "function")
    throw new Error("invalid voxel gateway release");
  return {
    build: build as BuildIdentity,
    content: content as ContentManifest,
    createGateway:
      exports.createGateway as typeof import("../../../games/voxel/src/server/gateway.ts").createGateway,
  };
}
