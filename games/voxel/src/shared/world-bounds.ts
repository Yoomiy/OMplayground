import profile from '../../config/world.json' with { type: 'json' };

if (Object.keys(profile).length !== 1 || profile.horizontal !== 'streamed')
  throw new Error('World profile must use streamed horizontal terrain');

// No configured gameplay square. Keep within the published native physics
// API's +/-1,000,000 coordinate contract, with a full column of margin. This
// also stays below the f32 terrain generator's integer precision horizon.
const horizontal = 1_000_000 - 16;
export const BOUNDS = Object.freeze({
  minX: -horizontal,
  minZ: -horizontal,
  maxX: horizontal,
  maxZ: horizontal,
  height: 256,
});

/** Existing finite test/school worlds expand without changing their seed/edits. */
export function compatibleCheckpointBounds(value: Record<string, unknown>): boolean {
  if (Object.entries(BOUNDS).every(([key, n]) => value[key] === n)) return true;
  const { minX, minZ, maxX, maxZ, height } = value;
  return (
    typeof maxX === 'number' &&
    Number.isInteger(maxX) &&
    maxX >= 32 &&
    maxX <= 32768 &&
    maxX % 16 === 0 &&
    minX === -maxX &&
    minZ === -maxX &&
    maxZ === maxX &&
    height === BOUNDS.height
  );
}
