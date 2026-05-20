/** Cheap deterministic hash for procedural noise - not crypto-grade. */
export function hash3(x: number, y: number, z: number, seed: number): number {
  let h = seed | 0;
  h = Math.imul(h ^ (x | 0), 0x9e3779b1);
  h = Math.imul(h ^ (y | 0), 0x85ebca6b);
  h = Math.imul(h ^ (z | 0), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function smoothstep(min: number, max: number, value: number): number {
  if (min === max) return value >= max ? 1 : 0;
  const t = clamp((value - min) / (max - min), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Bilinear-smoothed 2D value noise in [0, 1]. */
export function smoothNoise01(x: number, z: number, seed: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const h00 = hash3(xi, 0, zi, seed);
  const h10 = hash3(xi + 1, 0, zi, seed);
  const h01 = hash3(xi, 0, zi + 1, seed);
  const h11 = hash3(xi + 1, 0, zi + 1, seed);
  const fx = smoothstep(0, 1, xf);
  const fz = smoothstep(0, 1, zf);
  const a = h00 * (1 - fx) + h10 * fx;
  const b = h01 * (1 - fx) + h11 * fx;
  return a * (1 - fz) + b * fz;
}

/** Bilinear-smoothed 2D value noise in [-1, 1]. */
export function noise2D(x: number, z: number, seed: number): number {
  return smoothNoise01(x, z, seed) * 2 - 1;
}
