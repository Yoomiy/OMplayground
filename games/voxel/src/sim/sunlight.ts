import type { ContentManifest } from '../shared/content.ts';
import type { WorldPort } from '../shared/engine-port.ts';
/** Direct overhead sunlight: transparent glass passes; shaded solid shapes and liquids block. */
export function exposedToSun(
  world: WorldPort,
  content: ContentManifest,
  position: ArrayLike<number>,
  ceiling: number,
): boolean {
  const x = position[0],
    z = position[2],
    head = position[1] + 1.81;
  if (head >= 256 || !world.has_column(Math.floor(x / 16), Math.floor(z / 16))) return false;
  for (let y = Math.floor(head); y <= Math.min(255, ceiling); y++) {
    const block = content.blocks[world.get_block(Math.floor(x), y, Math.floor(z))];
    if (!block) return false;
    if (block.shape === 'air' || (block.opacity ?? (block.opaque === false ? 0 : 15)) === 0)
      continue;
    if (
      block.shape === 'liquid' ||
      !world.line_clear(x, Math.max(head, y + 1e-6), z, x, y + 1 - 1e-6, z)
    )
      return false;
  }
  return true;
}
