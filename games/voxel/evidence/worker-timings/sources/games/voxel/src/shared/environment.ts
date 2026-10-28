import { WORLD_HZ } from './input.ts';

export const ENVIRONMENT_VERSION = 1;
export const DAY_TICKS = WORLD_HZ * 20 * 60;
export const WEATHER_TICKS = WORLD_HZ * 3 * 60;
const TRANSITION_TICKS = WORLD_HZ * 15;
export type Environment = Readonly<{
  tick: number;
  seconds: number;
  dayFraction: number;
  daylight: number;
  sun: readonly [number, number, number];
  sky: readonly [number, number, number];
  rain: number;
  wind: readonly [number, number];
}>;
const smooth = (low: number, high: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
};
function hash(seed: number, period: number): number {
  let v = (seed ^ Math.imul(period, 0x9e3779b1)) >>> 0;
  v = Math.imul(v ^ (v >>> 16), 0x85ebca6b);
  v = Math.imul(v ^ (v >>> 13), 0xc2b2ae35);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
}
/** Presentational rain for the temperate preset. It never changes blocks or rules. */
const rainAt = (seed: number, period: number) =>
  period <= 0 ? 0 : hash(seed, period) < 0.28 ? 1 : 0;

/** Pure room-time model, shared with future server rules/checkpoints. Tick zero starts in daylight. */
export function sampleEnvironment(tick: number, seed: number): Environment {
  if (
    !Number.isFinite(tick) ||
    tick < 0 ||
    tick > Number.MAX_SAFE_INTEGER ||
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 0xffffffff
  )
    throw new Error('invalid environment clock/seed');
  const dayFraction = (tick / DAY_TICKS + 0.22) % 1;
  const angle = dayFraction * Math.PI * 2;
  const sunLength = Math.hypot(1, 0.3);
  const sun = [Math.cos(angle) / sunLength, Math.sin(angle) / sunLength, 0.3 / sunLength] as const;
  const daylight = 0.06 + 0.94 * smooth(-0.12, 0.22, sun[1]);
  const period = Math.floor(tick / WEATHER_TICKS);
  const blend = smooth(0, TRANSITION_TICKS, tick % WEATHER_TICKS);
  const rain = rainAt(seed, period - 1) * (1 - blend) + rainAt(seed, period) * blend;
  const dusk = (1 - smooth(0.02, 0.3, Math.abs(sun[1]))) * daylight;
  const sky = [
    0.025 + daylight * 0.565 + dusk * 0.13,
    0.04 + daylight * 0.72 - dusk * 0.08,
    0.09 + daylight * 0.79 - dusk * 0.18,
  ].map((v, i) => v * (1 - rain * 0.55) + [0.26, 0.3, 0.36][i] * daylight * rain * 0.55) as [
    number,
    number,
    number,
  ];
  const windAngle = hash(seed, 0) * Math.PI * 2;
  const windSpeed = 0.3 + rain * 0.8;
  return {
    tick,
    seconds: tick / WORLD_HZ,
    dayFraction,
    daylight,
    sun,
    sky,
    rain,
    wind: [Math.cos(windAngle) * windSpeed, Math.sin(windAngle) * windSpeed],
  };
}
