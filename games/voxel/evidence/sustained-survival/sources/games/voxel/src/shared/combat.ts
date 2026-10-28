import type { ItemDefinition } from './content.ts';
export type CombatProfile = Readonly<{ damage: number; cooldown: number; reach: number }>;
export const UNARMED: CombatProfile = Object.freeze({ damage: 2, cooldown: 15, reach: 3 });
export function combatProfile(item?: ItemDefinition): CombatProfile {
  return item?.combat ?? UNARMED;
}
export type HitEvent = Readonly<{
  sequence: number;
  attacker: string;
  target: string;
  position: readonly [number, number, number];
  damage: number;
  dead: boolean;
}>;
/** Unit view ray against the same 0.6 x 1.8 body used by native player collision. */
export function rayBody(
  origin: readonly number[],
  direction: readonly number[],
  feet: ArrayLike<number>,
  reach: number,
): number | null {
  let near = 0,
    far = reach;
  for (let axis = 0; axis < 3; axis++) {
    const min = feet[axis] - (axis === 1 ? 0 : 0.3),
      max = feet[axis] + (axis === 1 ? 1.8 : 0.3);
    if (Math.abs(direction[axis]) < 1e-12) {
      if (origin[axis] < min || origin[axis] > max) return null;
    } else {
      const a = (min - origin[axis]) / direction[axis],
        b = (max - origin[axis]) / direction[axis];
      near = Math.max(near, Math.min(a, b));
      far = Math.min(far, Math.max(a, b));
      if (near > far) return null;
    }
  }
  return near;
}
