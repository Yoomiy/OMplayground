import profile from '../../config/world.json' with { type: 'json' };

// One immutable build profile drives wire validation, authority and prediction.
// Chunk alignment keeps the centered square's edges on full 16-block columns.
if (
  Object.keys(profile).length !== 1 ||
  !Number.isSafeInteger(profile.size) ||
  profile.size < 64 ||
  profile.size > 65536 ||
  profile.size % 32 !== 0
)
  throw new Error('World size must be a multiple of 32 between 64 and 65536 blocks');

const half = profile.size / 2;
export const BOUNDS = Object.freeze({
  minX: -half,
  minZ: -half,
  maxX: half,
  maxZ: half,
  height: 256,
});
