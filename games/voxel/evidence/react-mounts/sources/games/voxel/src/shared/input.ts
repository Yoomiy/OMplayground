/** One movement frame is exactly one 1/60 s step. No client clock or duration exists. */
export const MOVEMENT_HZ = 60;
export const WORLD_HZ = 30;
export const MOVEMENT_DT = 1 / MOVEMENT_HZ;
export const INPUT_QUEUE_LIMIT = 12;
export const INPUT_MAX_AGE_MS = 200;
export const HELD_INPUT_MS = 100;
export type Controls = Readonly<{
  x: number;
  z: number;
  yaw: number;
  pitch: number;
  jump: boolean;
  sneak: boolean;
  sprint: boolean;
}>;
export type InputFrame = Controls & Readonly<{ epoch: number; sequence: number }>;
export const NEUTRAL: Controls = Object.freeze({
  x: 0,
  z: 0,
  yaw: 0,
  pitch: 0,
  jump: false,
  sneak: false,
  sprint: false,
});
const keys = ['epoch', 'sequence', 'x', 'z', 'yaw', 'pitch', 'jump', 'sneak', 'sprint'];
export function isInputFrame(value: unknown): value is InputFrame {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).length !== keys.length || keys.some((k) => !Object.hasOwn(v, k))) return false;
  return (
    Number.isSafeInteger(v.epoch) &&
    (v.epoch as number) > 0 &&
    Number.isSafeInteger(v.sequence) &&
    (v.sequence as number) > 0 &&
    ['x', 'z', 'yaw', 'pitch'].every((k) => typeof v[k] === 'number' && Number.isFinite(v[k])) &&
    Math.abs(v.x as number) <= 1 &&
    Math.abs(v.z as number) <= 1 &&
    Math.abs(v.yaw as number) <= Math.PI &&
    Math.abs(v.pitch as number) <= Math.PI / 2 &&
    ['jump', 'sneak', 'sprint'].every((k) => typeof v[k] === 'boolean')
  );
}
/** Match on both client and server before calling the same Wasm movement primitive. */
export function movementWish(input: Controls): readonly [number, number] {
  const scale = Math.max(1, Math.hypot(input.x, input.z));
  const x = input.x / scale,
    z = input.z / scale;
  const c = Math.cos(input.yaw),
    s = Math.sin(input.yaw);
  return [x * c - z * s, x * s + z * c];
}
