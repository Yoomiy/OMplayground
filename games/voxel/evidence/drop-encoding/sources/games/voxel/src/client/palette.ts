import type { ContentManifest } from '../shared/content.ts';

/** One creative choice per placeable state. Container items do not add duplicate block choices. */
export function creativePalette(content: Pick<ContentManifest, 'blocks' | 'items'>) {
  const choices = new Map<
    number,
    {
      key: number;
      state: number;
      family: string;
      labelKey: string;
      slot: null;
      count: null;
    }
  >();
  for (const item of content.items) {
    if (!item.places) continue;
    const state = content.blocks.findIndex(
      (block) => block.name === item.places && block.placeable !== false,
    );
    if (state < 0 || choices.has(state)) continue;
    choices.set(state, {
      key: state,
      state,
      family: item.places,
      labelKey: item.labelKey,
      slot: null,
      count: null,
    });
  }
  return [...choices.values()];
}
