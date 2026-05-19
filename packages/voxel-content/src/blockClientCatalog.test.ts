import { existsSync } from "node:fs";
import path from "node:path";

import { BLOCK_REGISTRY } from "./blocks";
import { NOA_BLOCK_ENTRIES, PLANT_SPRITE_BLOCK_IDS } from "./blockClientCatalog";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const ASSETS_DIR = path.join(REPO_ROOT, "apps/web/public/minecraft-assets");

const WOOD_TEXTURE_FILES = [
  "birch_log.png",
  "birch_log_top.png",
  "birch_planks.png",
  "birch_leaves.png",
  "spruce_log.png",
  "spruce_log_top.png",
  "spruce_planks.png",
  "spruce_leaves.png"
] as const;

describe("blockClientCatalog", () => {
  it("registers exactly one noa entry per non-air block id", () => {
    const ids = NOA_BLOCK_ENTRIES.map((e) => e.id);
    expect(ids.length).toBe(99);
    expect(new Set(ids).size).toBe(99);
    expect(ids.includes(BLOCK_REGISTRY.AIR)).toBe(false);
    for (let i = 1; i <= 99; i++) {
      expect(ids.includes(i)).toBe(true);
    }
  });

  it("PLANT_SPRITE_BLOCK_IDS matches plantSprite entries (drop rendering)", () => {
    const fromEntries = new Set(
      NOA_BLOCK_ENTRIES.filter((e) => e.shape === "plantSprite").map((e) => e.id)
    );
    expect(PLANT_SPRITE_BLOCK_IDS.size).toBe(fromEntries.size);
    for (const id of fromEntries) {
      expect(PLANT_SPRITE_BLOCK_IDS.has(id)).toBe(true);
    }
    expect(PLANT_SPRITE_BLOCK_IDS.has(BLOCK_REGISTRY.SAPLING)).toBe(true);
    expect(PLANT_SPRITE_BLOCK_IDS.has(BLOCK_REGISTRY.DIRT)).toBe(false);
  });

  it("wood-family texture files exist under minecraft-assets", () => {
    for (const file of WOOD_TEXTURE_FILES) {
      expect(existsSync(path.join(ASSETS_DIR, "block", file))).toBe(true);
    }
  });
});
