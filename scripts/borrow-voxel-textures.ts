/**
 * Copy whitelisted block/item textures from sourceCode/voxelsrv into
 * apps/web/public/minecraft-assets/. Idempotent; logs skips and missing files.
 *
 * Usage: pnpm exec tsx scripts/borrow-voxel-textures.ts
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VOXELSRV_ROOT = path.join(REPO_ROOT, "sourceCode/voxelsrv/dist/textures");
const DEST_DIR = path.join(REPO_ROOT, "apps/web/public/minecraft-assets");

/** voxelsrv relative path (under block/ or item/) → our public filename. */
const WHITELIST: readonly { src: string; dest: string }[] = [
  { src: "block/birch_log.png", dest: "birch_log.png" },
  { src: "block/birch_log_top.png", dest: "birch_log_top.png" },
  { src: "block/birch_planks.png", dest: "birch_planks.png" },
  { src: "block/birch_leaves.png", dest: "birch_leaves.png" },
  { src: "block/spruce_log.png", dest: "spruce_log.png" },
  { src: "block/spruce_log_top.png", dest: "spruce_log_top.png" },
  { src: "block/spruce_planks.png", dest: "spruce_planks.png" },
  { src: "block/spruce_leaves.png", dest: "spruce_leaves.png" }
];

function main(): void {
  if (!existsSync(VOXELSRV_ROOT)) {
    console.error(`Missing voxelsrv textures at ${VOXELSRV_ROOT}`);
    process.exit(1);
  }

  mkdirSync(DEST_DIR, { recursive: true });

  let copied = 0;
  let skipped = 0;
  const missing: string[] = [];

  for (const { src, dest } of WHITELIST) {
    const from = path.join(VOXELSRV_ROOT, src);
    const to = path.join(DEST_DIR, dest);

    if (!existsSync(from)) {
      missing.push(src);
      continue;
    }

    if (existsSync(to)) {
      skipped += 1;
      console.log(`skip (exists): ${dest}`);
      continue;
    }

    copyFileSync(from, to);
    copied += 1;
    console.log(`copied: ${src} → ${dest}`);
  }

  console.log(`done: ${copied} copied, ${skipped} skipped`);

  if (missing.length > 0) {
    console.error("Missing whitelisted source files:");
    for (const m of missing) console.error(`  ${m}`);
    process.exit(1);
  }
}

main();
