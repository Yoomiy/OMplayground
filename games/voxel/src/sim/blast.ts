import type { WorldPort } from '../shared/engine-port.ts';
import type { ContentManifest } from '../shared/content.ts';
import type { Cell } from '../shared/protocol.ts';
import { inBounds } from '../shared/protocol.ts';
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
          block.breakable === false ||
          block.name === 'obsidian'
        )
          continue;
        const cell: Cell = [x, y, z];
        result.push({ cell, state, rule });
      }
  return result;
}
