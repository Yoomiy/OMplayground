import type { WorldPort } from '../shared/engine-port.ts';
import type { ContentManifest } from '../shared/content.ts';
import type { Cell } from '../shared/protocol.ts';
import { inBounds } from '../shared/protocol.ts';
/** Voxel DDA with native shape tests inside each traversed cell. */
function resistance(
  world: WorldPort,
  content: ContentManifest,
  origin: readonly number[],
  target: readonly number[],
  excluded: Cell,
  rules: ReadonlyMap<string, ContentManifest['behavior'][number]>,
): number {
  const delta = target.map((value, axis) => value - origin[axis]),
    length = Math.hypot(...delta);
  if (length < 1e-8) return 0;
  const direction = delta.map((value) => value / length),
    cell = origin.map((value, axis) => Math.floor(value + direction[axis] * 1e-6));
  const step = direction.map(Math.sign),
    increment = direction.map((value) => (value === 0 ? Infinity : Math.abs(1 / value)));
  const next = cell.map((value, axis) =>
    direction[axis] === 0
      ? Infinity
      : (value + (step[axis] > 0 ? 1 : 0) - origin[axis]) / direction[axis],
  );
  let at = 0,
    total = 0;
  while (at < length - 1e-7) {
    const end = Math.min(length, ...next);
    if (!cell.every((value, axis) => value === excluded[axis])) {
      const state = world.get_block(cell[0], cell[1], cell[2]),
        block = content.blocks[state];
      if (!block) return Infinity;
      if (block.shape !== 'air') {
        if (block.breakable === false || block.shape === 'liquid') return Infinity;
        if (block.solid !== false) {
          const a = origin.map((value, axis) => value + direction[axis] * (at + 1e-6)),
            b = origin.map(
              (value, axis) => value + direction[axis] * Math.max(at + 1e-6, end - 1e-6),
            );
          if (!world.line_clear(a[0], a[1], a[2], b[0], b[1], b[2]))
            total += rules.get(block.name)?.blastResistance ?? 1;
        }
      }
    }
    at = end;
    for (let axis = 0; axis < 3; axis++)
      if (Math.abs(next[axis] - end) < 1e-7) {
        cell[axis] += step[axis];
        next[axis] += increment[axis];
      }
  }
  return total;
}
export function blastPlan(
  world: WorldPort,
  content: ContentManifest,
  position: readonly number[],
  radius: number,
): { cell: Cell; state: number; rule: ContentManifest['behavior'][number] }[] {
  const result = [];
  const rules = new Map(content.behavior.map((rule) => [rule.family, rule]));
  for (let y = Math.floor(position[1] - radius); y <= Math.floor(position[1] + radius); y++)
    for (let z = Math.floor(position[2] - radius); z <= Math.floor(position[2] + radius); z++)
      for (let x = Math.floor(position[0] - radius); x <= Math.floor(position[0] + radius); x++) {
        if (y === 0 || !inBounds(x, y, z)) continue;
        const target = [x + 0.5, y + 0.5, z + 0.5],
          distance = Math.hypot(...target.map((value, axis) => value - position[axis]));
        if (distance > radius) continue;
        const state = world.get_block(x, y, z),
          block = content.blocks[state],
          rule = rules.get(block?.name);
        if (
          !block ||
          !rule ||
          block.shape === 'air' ||
          block.shape === 'liquid' ||
          block.breakable === false
        )
          continue;
        const cell: Cell = [x, y, z];
        if (
          (rule.blastResistance ?? 1) + resistance(world, content, position, target, cell, rules) <=
          radius + 0.5 - distance
        )
          result.push({ cell, state, rule });
      }
  return result;
}
