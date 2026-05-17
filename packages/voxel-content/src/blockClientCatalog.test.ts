import { BLOCK_REGISTRY } from "./blocks";
import { NOA_BLOCK_ENTRIES } from "./blockClientCatalog";

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
});
