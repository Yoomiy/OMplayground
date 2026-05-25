/**
 * Copy all .ogg audio from sourceCode/voxelsrv into apps/web/public/minecraft-assets/sounds/.
 * Idempotent; logs copied/skipped; exits 1 if source root is missing.
 *
 * Usage: pnpm borrow-voxel-audio
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VOXELSRV_AUDIO = path.join(REPO_ROOT, "sourceCode/voxelsrv/dist/audio");
const DEST_ROOT = path.join(REPO_ROOT, "apps/web/public/minecraft-assets/sounds");

function walkOggFiles(dir: string, base = dir): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkOggFiles(full, base));
    } else if (entry.isFile() && entry.name.endsWith(".ogg")) {
      files.push(path.relative(base, full));
    }
  }
  return files;
}

function main(): void {
  if (!existsSync(VOXELSRV_AUDIO)) {
    console.error(`Missing voxelsrv audio at ${VOXELSRV_AUDIO}`);
    process.exit(1);
  }

  const relativePaths = walkOggFiles(VOXELSRV_AUDIO);
  let copied = 0;
  let skipped = 0;

  for (const rel of relativePaths) {
    const from = path.join(VOXELSRV_AUDIO, rel);
    const to = path.join(DEST_ROOT, rel);
    mkdirSync(path.dirname(to), { recursive: true });

    if (existsSync(to) && statSync(to).size === statSync(from).size) {
      skipped += 1;
      continue;
    }

    copyFileSync(from, to);
    copied += 1;
    console.log(`copied: ${rel}`);
  }

  console.log(`done: ${copied} copied, ${skipped} skipped (${relativePaths.length} total)`);
}

main();
