import type { ItemDefinition } from './content.ts';
import { DEFAULT_MOVEMENT } from './movement.ts';
import type { MovementModifiers } from './movement.ts';

export const VITALS_VERSION = 2;
export const MAX_HEALTH = 20;
export const MAX_FOOD = 20;
export const MAX_AIR = 300;
export const RESPAWN_TICKS = 60;
export type VitalsView = Readonly<{
  version: typeof VITALS_VERSION;
  health: number;
  food: number;
  air: number;
  dead: boolean;
  respawnIn: number;
  attackCooldown: number;
  protection: number;
}>;
export function equipmentEffects(items: readonly ItemDefinition[]): {
  movement: MovementModifiers;
  fall: number;
  armor: number;
  fallImmune: boolean;
  sunRegen: boolean;
  vision: boolean;
} {
  let speed = 1,
    gravity = 1,
    control = 1,
    fall = 0,
    armor = 0,
    jump = 1,
    fallImmune = false,
    sunRegen = false,
    vision = false;
  for (const item of items) {
    speed *= item.modifiers?.speed ?? 1;
    gravity *= item.modifiers?.gravity ?? 1;
    control *= item.modifiers?.control ?? 1;
    jump *= item.modifiers?.jump ?? 1;
    fall += item.modifiers?.fall ?? 0;
    armor += item.modifiers?.armor ?? 0;
    fallImmune ||= item.perks?.fallImmune === true;
    sunRegen ||= item.perks?.sunRegen === true;
    vision ||= item.perks?.vision === true;
  }
  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
  return {
    movement: {
      ...DEFAULT_MOVEMENT,
      speed: clamp(speed, 0.25, 2),
      gravity: clamp(gravity, 0.25, 2),
      control: clamp(control, 0.25, 2),
      jump: clamp(jump, 0.25, 2),
    },
    fall: clamp(fall, 0, 0.9),
    armor: clamp(armor, 0, 0.8),
    fallImmune,
    sunRegen,
    vision,
  };
}
export function isMovementModifiers(value: unknown): value is MovementModifiers {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    Object.keys(v).length === 5 &&
    typeof v.sprint === 'boolean' &&
    ['speed', 'gravity', 'control', 'jump'].every(
      (key) =>
        typeof v[key] === 'number' && Number.isFinite(v[key]) && v[key] >= 0.25 && v[key] <= 2,
    )
  );
}
export function isVitalsView(value: unknown): value is VitalsView {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as VitalsView;
  const integer = (n: number, max: number) => Number.isSafeInteger(n) && n >= 0 && n <= max;
  return (
    Object.keys(v).length === 8 &&
    v.version === VITALS_VERSION &&
    integer(v.health, MAX_HEALTH) &&
    integer(v.food, MAX_FOOD) &&
    integer(v.air, MAX_AIR) &&
    integer(v.attackCooldown, 60) &&
    integer(v.protection, 60) &&
    typeof v.dead === 'boolean' &&
    v.dead === (v.health === 0) &&
    integer(v.respawnIn, RESPAWN_TICKS) &&
    (v.dead || v.respawnIn === 0)
  );
}
