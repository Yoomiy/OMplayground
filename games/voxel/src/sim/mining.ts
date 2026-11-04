import type { BlockDefinition, ItemDefinition } from '../shared/content.ts';
import { preferredMiningTool } from '../shared/mining-rules.ts';
import { WORLD_HZ } from '../shared/input.ts';
/** Content tuning is in seconds; only earned world ticks advance a mining job. */
export function miningPlan(
  block: Pick<BlockDefinition, 'mining'> & Partial<Pick<BlockDefinition, 'family' | 'soundGroup'>>,
  item: ItemDefinition | undefined,
): { allowed: boolean; ticks: number } {
  const preferred = preferredMiningTool(block);
  const tool = item?.tool,
    correct = !!tool && tool.kind === preferred && tool.tier >= (block.mining.tier ?? 0);
  return {
    allowed: !block.mining.requiresTool || correct,
    // Bare hands/wrong tools are deliberately slow on tool-specific materials.
    // Starting resources remain obtainable; the proper wooden tool is ~9× faster.
    ticks: Math.max(
      1,
      Math.ceil((block.mining.seconds * WORLD_HZ) / (correct ? tool.speed : preferred ? 1 / 3 : 1)),
    ),
  };
}
