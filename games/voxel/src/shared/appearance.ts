import { EQUIPMENT } from './inventory.ts';
import type { EquipmentSlot } from './inventory.ts';
import type { ItemDefinition } from './content.ts';

/** Public visible identities only. Ownership quantities and instance data stay private. */
export type ActorAppearance = Readonly<{
  held: string | null;
  equipment: Readonly<Record<EquipmentSlot, string | null>>;
}>;
export function emptyAppearance(): ActorAppearance {
  return {
    held: null,
    equipment: { head: null, body: null, legs: null, feet: null, offhand: null },
  };
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const item = (v: unknown) =>
  v === null || (typeof v === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(v));
export function isActorAppearance(v: unknown): v is ActorAppearance {
  return (
    object(v) &&
    Object.keys(v).length === 2 &&
    Object.hasOwn(v, 'held') &&
    item(v.held) &&
    object(v.equipment) &&
    Object.keys(v.equipment).length === EQUIPMENT.length &&
    EQUIPMENT.every(
      (slot) =>
        Object.hasOwn(v.equipment as object, slot) &&
        item((v.equipment as Record<string, unknown>)[slot]),
    )
  );
}
export function appearanceMatchesContent(
  v: ActorAppearance,
  items: ReadonlyMap<string, ItemDefinition>,
): boolean {
  return (
    (v.held === null || items.has(v.held)) &&
    EQUIPMENT.every((slot) => {
      const kind = v.equipment[slot];
      return kind === null || items.get(kind)?.equipment === slot;
    })
  );
}
export function sameAppearance(a: ActorAppearance, b: ActorAppearance): boolean {
  return a.held === b.held && EQUIPMENT.every((slot) => a.equipment[slot] === b.equipment[slot]);
}
