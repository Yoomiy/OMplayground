import type { PlayerVitals } from "./protocol";

export const MAX_HEALTH = 20;
export const MAX_HUNGER = 20;
export const EATING_DURATION_MS = 1600;
export const EAT_FINISH_TOLERANCE_MS = 1500;
const EXHAUSTION_DECAY_THRESHOLD = 4;
const IDLE_EXHAUSTION_PER_SECOND = 0.0015;
const WALK_EXHAUSTION_PER_METER = 0.008;
const JUMP_EXHAUSTION = 0.025;
const MINING_EXHAUSTION = 0.01;
const REGEN_INTERVAL_MS = 4000;
const STARVE_INTERVAL_MS = 4000;

export interface VitalsRuntime extends PlayerVitals {
  lastVitalsAt: number;
  lastRegenAt: number;
  lastStarveAt: number;
  lastHeliosRegenAt: number;
}

export interface VitalsCarrier extends Partial<VitalsRuntime> {}

export interface ActiveEating {
  hotbarIndex: number;
  itemId: number;
  startedAt: number;
}

export function createDefaultVitals(now = Date.now()): VitalsRuntime {
  return {
    health: MAX_HEALTH,
    hunger: MAX_HUNGER,
    saturation: 0,
    exhaustion: 0,
    lastVitalsAt: now,
    lastRegenAt: now,
    lastStarveAt: now,
    lastHeliosRegenAt: now
  };
}

export function cloneVitals(player: VitalsCarrier): PlayerVitals {
  return {
    health: clampNumber(player.health, MAX_HEALTH, 0, MAX_HEALTH),
    hunger: clampNumber(player.hunger, MAX_HUNGER, 0, MAX_HUNGER),
    saturation: clampNumber(player.saturation, 0, 0, MAX_HUNGER),
    exhaustion: clampNumber(player.exhaustion, 0, 0, EXHAUSTION_DECAY_THRESHOLD)
  };
}

export function vitalsFromPersisted(raw: unknown, now = Date.now()): VitalsRuntime {
  const defaults = createDefaultVitals(now);
  if (!raw || typeof raw !== "object") return defaults;
  const v = raw as Partial<VitalsRuntime>;
  return {
    health: clampNumber(v.health, defaults.health, 0, MAX_HEALTH),
    hunger: clampNumber(v.hunger, defaults.hunger, 0, MAX_HUNGER),
    saturation: clampNumber(v.saturation, defaults.saturation, 0, MAX_HUNGER),
    exhaustion: clampNumber(v.exhaustion, defaults.exhaustion, 0, EXHAUSTION_DECAY_THRESHOLD),
    lastVitalsAt: now,
    lastRegenAt: now,
    lastStarveAt: now,
    lastHeliosRegenAt: clampNumber(v.lastHeliosRegenAt, now, 0, Number.MAX_SAFE_INTEGER)
  };
}

export function assignVitals(target: VitalsCarrier, vitals: VitalsRuntime): void {
  target.health = vitals.health;
  target.hunger = vitals.hunger;
  target.saturation = vitals.saturation;
  target.exhaustion = vitals.exhaustion;
  target.lastVitalsAt = vitals.lastVitalsAt;
  target.lastRegenAt = vitals.lastRegenAt;
  target.lastStarveAt = vitals.lastStarveAt;
  target.lastHeliosRegenAt = vitals.lastHeliosRegenAt;
}

export function addMovementExhaustion(
  player: VitalsCarrier,
  distanceMeters: number,
  jumped: boolean
): boolean {
  let amount = Math.max(0, distanceMeters) * WALK_EXHAUSTION_PER_METER;
  if (jumped) amount += JUMP_EXHAUSTION;
  return addExhaustion(player, amount);
}

export function addMiningExhaustion(player: VitalsCarrier): boolean {
  return addExhaustion(player, MINING_EXHAUSTION);
}

export function addExhaustion(player: VitalsCarrier, amount: number): boolean {
  if (!Number.isFinite(amount) || amount <= 0) return false;
  const before = cloneVitals(player);
  player.exhaustion = clampNumber(
    (player.exhaustion ?? 0) + amount,
    amount,
    0,
    EXHAUSTION_DECAY_THRESHOLD * 2
  );
  return vitalsChanged(before, cloneVitals(player));
}

export function tickVitals(player: VitalsCarrier, now: number): boolean {
  const before = cloneVitals(player);
  player.lastVitalsAt = now;
  player.lastRegenAt = now;
  player.lastStarveAt = now;
  return vitalsChanged(before, cloneVitals(player));
}

export function applyFood(
  player: VitalsCarrier,
  nutrition: number,
  saturationModifier: number
): boolean {
  const before = cloneVitals(player);
  player.health = Math.min(MAX_HEALTH, (player.health ?? MAX_HEALTH) + nutrition);
  player.hunger = MAX_HUNGER;
  player.saturation = 0;
  player.exhaustion = 0;
  return vitalsChanged(before, cloneVitals(player));
}

function vitalsChanged(a: PlayerVitals, b: PlayerVitals): boolean {
  return (
    a.health !== b.health ||
    a.hunger !== b.hunger ||
    Math.abs(a.saturation - b.saturation) > 1e-6 ||
    Math.abs(a.exhaustion - b.exhaustion) > 1e-6
  );
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
