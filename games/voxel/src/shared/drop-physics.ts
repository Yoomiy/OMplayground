import type { EngineBlock } from './content.ts';
import type { WorldPort } from './engine-port.ts';
import { DROP_HALF_WIDTH, DROP_HEIGHT } from './gameplay.ts';

export type DropCollisionWorld = Pick<WorldPort, 'get_block' | 'target_boxes' | 'sweep_body'>;
const FULL_BOX = [0, 0, 0, 16, 16, 16];

/** Native sweeps prevent entry into terrain but deliberately allow escape from
 * an existing overlap. Resolve those first (old saves, scatter, or newly placed
 * blocks), using the authored solid shapes rather than treating slabs as cubes. */
export function sweepDrop(
  world: DropCollisionWorld,
  blocks: readonly EngineBlock[],
  x: number,
  y: number,
  z: number,
  dx: number,
  dy: number,
  dz: number,
): Float64Array {
  for (let pass = 0; pass < 10; pass++) {
    let moved = false;
    cells: for (let by = Math.floor(y); by <= Math.floor(y + DROP_HEIGHT); by++)
      for (let bz = Math.floor(z - DROP_HALF_WIDTH); bz <= Math.floor(z + DROP_HALF_WIDTH); bz++)
        for (
          let bx = Math.floor(x - DROP_HALF_WIDTH);
          bx <= Math.floor(x + DROP_HALF_WIDTH);
          bx++
        ) {
          const block = blocks[world.get_block(bx, by, bz)];
          if (
            block?.solid === false ||
            block?.shape === 'air' ||
            block?.shape === 'liquid' ||
            block?.shape === 'cross'
          )
            continue;
          const boxes =
            !block || block.shape === 'cube' ? FULL_BOX : world.target_boxes(bx, by, bz);
          for (let i = 0; i < boxes.length; i += 6) {
            const lx = bx + boxes[i] / 16,
              ly = by + boxes[i + 1] / 16,
              lz = bz + boxes[i + 2] / 16;
            const hx = bx + boxes[i + 3] / 16,
              hy = by + boxes[i + 4] / 16,
              hz = bz + boxes[i + 5] / 16;
            const ox = Math.min(x + DROP_HALF_WIDTH, hx) - Math.max(x - DROP_HALF_WIDTH, lx);
            const oy = Math.min(y + DROP_HEIGHT, hy) - Math.max(y, ly);
            const oz = Math.min(z + DROP_HALF_WIDTH, hz) - Math.max(z - DROP_HALF_WIDTH, lz);
            if (ox <= 1e-7 || oy <= 1e-7 || oz <= 1e-7) continue;
            if (ox < oy && ox < oz) x += (x < (lx + hx) / 2 ? -1 : 1) * (ox + 0.0012);
            else if (oy < oz) y += (y + DROP_HEIGHT / 2 < (ly + hy) / 2 ? -1 : 1) * (oy + 0.0012);
            else z += (z < (lz + hz) / 2 ? -1 : 1) * (oz + 0.0012);
            moved = true;
            break cells;
          }
        }
    if (!moved) break;
  }
  return world.sweep_body(x, y, z, dx, dy, dz, DROP_HALF_WIDTH, DROP_HEIGHT);
}
