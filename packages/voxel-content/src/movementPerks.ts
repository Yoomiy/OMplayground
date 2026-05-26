import { itemPerkSpec } from "./items";

export const EQUIPMENT_SLOT_KEYS = ["head", "chest", "legs", "feet"] as const;

export function resolveMovementPerks(
  equipmentSlots: readonly { itemId: number; count: number }[]
): { speedMult: number; jumpMult: number } {
  let speedMult = 1.0;
  let jumpMult = 1.0;

  for (let i = 0; i < EQUIPMENT_SLOT_KEYS.length; i++) {
    const slot = equipmentSlots[i];
    if (!slot || slot.itemId === 0 || slot.count <= 0) continue;

    const perk = itemPerkSpec(slot.itemId);
    if (!perk) continue;

    // Only apply if the perk's equipSlot matches this specific slot index (head, chest, legs, feet)
    if (perk.equipSlot === EQUIPMENT_SLOT_KEYS[i]) {
      if (perk.speedBonus !== undefined) {
        speedMult += perk.speedBonus;
      }
      if (perk.jumpBonus !== undefined) {
        jumpMult += perk.jumpBonus;
      }
    }
  }

  return { speedMult, jumpMult };
}

export function healthWalkMultiplier(health: number): number {
  if (health >= 15) return 1.0;
  if (health >= 10) return 0.85;
  if (health >= 5) return 0.70;
  return 0.50;
}

/** True when `itemId` is equipped in the slot matching its perk `equipSlot`. */
export function isEquipmentPerkActive(
  equipmentSlots: readonly { itemId: number; count: number }[],
  itemId: number
): boolean {
  const perk = itemPerkSpec(itemId);
  if (!perk || perk.equipSlot === "hotbar") return false;

  const slotIndex = EQUIPMENT_SLOT_KEYS.indexOf(
    perk.equipSlot as (typeof EQUIPMENT_SLOT_KEYS)[number]
  );
  if (slotIndex < 0) return false;

  const slot = equipmentSlots[slotIndex];
  return !!slot && slot.itemId === itemId && slot.count > 0;
}
