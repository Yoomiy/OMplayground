import type { BlockDefinition } from './content.ts';
/** One tool preference for authority and player guidance. Required tier stays authored. */
export function preferredMiningTool(
  block: Pick<BlockDefinition, 'mining'> & Partial<Pick<BlockDefinition, 'family' | 'soundGroup'>>,
): 'pickaxe' | 'axe' | 'shovel' | undefined {
  return (
    block.mining.tool ??
    (block.soundGroup === 'wood'
      ? 'axe'
      : block.family === 'grass_block' || ['sand', 'gravel'].includes(block.soundGroup ?? '')
        ? 'shovel'
        : block.soundGroup === 'stone'
          ? 'pickaxe'
          : undefined)
  );
}
