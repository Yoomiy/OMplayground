import type { BlockDefinition, ItemDefinition } from '../shared/content.ts';
import { WORLD_HZ } from '../shared/input.ts';
/** Content tuning is in seconds; only earned world ticks advance a mining job. */
export function miningPlan(
  block: Pick<BlockDefinition, 'mining'>,
  item: ItemDefinition | undefined,
): { allowed: boolean; ticks: number } {
  const tool = item?.tool,
    correct = !!tool && tool.kind === block.mining.tool && tool.tier >= (block.mining.tier ?? 0);
  return {
    allowed: !block.mining.requiresTool || correct,
    ticks: Math.max(1, Math.ceil((block.mining.seconds * WORLD_HZ) / (correct ? tool.speed : 1))),
  };
}
