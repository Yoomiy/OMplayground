import { BLOCK_REGISTRY } from "./blocks";
import { NOA_BLOCK_ENTRIES, PLANT_SPRITE_BLOCK_IDS } from "./blockClientCatalog";

describe("blockClientCatalog", () => {
  it("registers exactly one noa entry per non-air block id", () => {
    const ids = NOA_BLOCK_ENTRIES.map((e) => e.id);
    expect(ids.length).toBe(42);
    expect(new Set(ids).size).toBe(42);
    expect(ids.includes(BLOCK_REGISTRY.AIR)).toBe(false);
    for (let i = 1; i <= 42; i++) {
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
});
