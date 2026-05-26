import { ITEM_REGISTRY } from "./items";
import { resolveMovementPerks, healthWalkMultiplier, isEquipmentPerkActive } from "./movementPerks";

describe("movementPerks", () => {
  describe("resolveMovementPerks", () => {
    it("returns 1.0 multiplier when no equipment is equipped", () => {
      const result = resolveMovementPerks([]);
      expect(result.speedMult).toBe(1.0);
      expect(result.jumpMult).toBe(1.0);
    });

    it("applies HELIUM_BOOTS jump bonus when in the feet slot (index 3)", () => {
      // index 3 is feet ("head", "chest", "legs", "feet")
      const result = resolveMovementPerks([
        { itemId: 0, count: 0 }, // head
        { itemId: 0, count: 0 }, // chest
        { itemId: 0, count: 0 }, // legs
        { itemId: ITEM_REGISTRY.HELIUM_BOOTS, count: 1 } // feet
      ]);
      expect(result.speedMult).toBe(1.0);
      expect(result.jumpMult).toBeCloseTo(1.6);
    });

    it("ignores HELIUM_BOOTS jump bonus when in the wrong slot (e.g. head, index 0)", () => {
      const result = resolveMovementPerks([
        { itemId: ITEM_REGISTRY.HELIUM_BOOTS, count: 1 }, // head
        { itemId: 0, count: 0 },
        { itemId: 0, count: 0 },
        { itemId: 0, count: 0 }
      ]);
      expect(result.speedMult).toBe(1.0);
      expect(result.jumpMult).toBe(1.0);
    });

    it("applies HEAVY_SHIELD speed reduction when in chest slot (index 1)", () => {
      const result = resolveMovementPerks([
        { itemId: 0, count: 0 },
        { itemId: ITEM_REGISTRY.HEAVY_SHIELD, count: 1 }, // chest
        { itemId: 0, count: 0 },
        { itemId: 0, count: 0 }
      ]);
      expect(result.speedMult).toBeCloseTo(0.8);
      expect(result.jumpMult).toBe(1.0);
    });

    it("stacks speed and jump modifiers correctly", () => {
      const result = resolveMovementPerks([
        { itemId: 0, count: 0 },
        { itemId: ITEM_REGISTRY.HEAVY_SHIELD, count: 1 }, // chest
        { itemId: 0, count: 0 },
        { itemId: ITEM_REGISTRY.HELIUM_BOOTS, count: 1 } // feet
      ]);
      expect(result.speedMult).toBeCloseTo(0.8);
      expect(result.jumpMult).toBeCloseTo(1.6);
    });
  });

  describe("healthWalkMultiplier", () => {
    it("returns 1.0 for high health (>= 15)", () => {
      expect(healthWalkMultiplier(20)).toBe(1.0);
      expect(healthWalkMultiplier(15)).toBe(1.0);
    });

    it("returns 0.85 for medium-high health (10-14)", () => {
      expect(healthWalkMultiplier(14)).toBe(0.85);
      expect(healthWalkMultiplier(10)).toBe(0.85);
    });

    it("returns 0.70 for medium-low health (5-9)", () => {
      expect(healthWalkMultiplier(9)).toBe(0.70);
      expect(healthWalkMultiplier(5)).toBe(0.70);
    });

    it("returns 0.50 for low health (< 5)", () => {
      expect(healthWalkMultiplier(4)).toBe(0.50);
      expect(healthWalkMultiplier(1)).toBe(0.50);
      expect(healthWalkMultiplier(0)).toBe(0.50);
    });
  });

  describe("isEquipmentPerkActive", () => {
    it("requires matching equip slot", () => {
      expect(
        isEquipmentPerkActive(
          [
            { itemId: ITEM_REGISTRY.GLOW_TALISMAN, count: 1 },
            { itemId: 0, count: 0 },
            { itemId: 0, count: 0 },
            { itemId: 0, count: 0 }
          ],
          ITEM_REGISTRY.GLOW_TALISMAN
        )
      ).toBe(true);
      expect(
        isEquipmentPerkActive(
          [
            { itemId: 0, count: 0 },
            { itemId: 0, count: 0 },
            { itemId: 0, count: 0 },
            { itemId: ITEM_REGISTRY.GLOW_TALISMAN, count: 1 }
          ],
          ITEM_REGISTRY.GLOW_TALISMAN
        )
      ).toBe(false);
    });
  });
});
