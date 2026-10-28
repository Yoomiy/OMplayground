import type { BlockDefinition, EngineState, Recipe } from '../src/shared/content.ts';
export const cube = (texture: string, extra: Partial<EngineState> = {}): EngineState => ({
  shape: 'cube',
  textures: [texture, texture, texture, texture, texture, texture],
  ...extra,
});
export function block(
  family: string,
  state: EngineState,
  extra: Partial<BlockDefinition> = {},
): BlockDefinition {
  return {
    family,
    labelKey: `block.${family}`,
    soundGroup: 'stone',
    mining: { seconds: 1 },
    support: 'none',
    drops: [{ itemType: family, count: 1 }],
    variants: { '': state },
    ...extra,
  };
}
export function recipe(
  key: string,
  ingredients: readonly (string | null)[],
  itemType: string,
  count = 1,
  durability?: number,
): Recipe {
  const size = ingredients.length === 4 ? 2 : 3;
  return {
    key,
    size,
    ingredients,
    result: { itemType, count, ...(durability ? { instance: { durability } } : {}) },
  };
}
export const COLORS = [
  'white',
  'orange',
  'magenta',
  'light_blue',
  'yellow',
  'lime',
  'pink',
  'gray',
  'light_gray',
  'cyan',
  'purple',
  'blue',
  'brown',
  'green',
  'red',
  'black',
] as const;
