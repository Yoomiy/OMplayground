import type { BlockDefinition, ItemDefinition, Recipe } from '../src/shared/content.ts';
import { block, cube, recipe, COLORS } from './helpers.ts';
export const resourceBlocks: BlockDefinition[] = [
  ...(['coal', 'iron', 'gold', 'diamond', 'lapis'] as const).map((material, index) =>
    block(`${material}_ore`, cube(`${material}_ore`), {
      mining: {
        seconds: 2,
        tool: 'pickaxe',
        requiresTool: true,
        tier: material === 'coal' ? 1 : material === 'diamond' ? 3 : 2,
      },
      drops: [
        {
          itemType:
            material === 'coal'
              ? 'coal'
              : material === 'diamond'
                ? 'diamond'
                : material === 'lapis'
                  ? 'lapis'
                  : `${material}_ore`,
          count: 1,
        },
      ],
    }),
  ),
  ...(['iron', 'gold', 'diamond', 'lapis'] as const).map((material) =>
    block(`${material}_block`, cube(`${material}_block`), {
      mining: { seconds: 2, tool: 'pickaxe', requiresTool: true, tier: 1 },
      blastResistance: 3,
    }),
  ),
];
const material = (
  itemType: string,
  model: ItemDefinition['model'],
  surface: string,
  extra: Partial<ItemDefinition> = {},
): ItemDefinition => ({
  itemType,
  labelKey: `item.${itemType}`,
  maxStack: 64,
  model,
  material: surface,
  ...extra,
});
export const progressionItems: ItemDefinition[] = [
  material('bucket', 'bucket', 'iron_block', {
    maxStack: 1,
    collects: { family: 'water', result: 'water_bucket' },
  }),
  material('water_bucket', 'bucket', 'iron_block', {
    maxStack: 1,
    places: 'water',
    remainder: 'bucket',
  }),
  material('coal', 'powder', 'bedrock', { tags: ['fuel'] }),
  material('iron_ingot', 'ingot', 'iron_block'),
  material('gold_ingot', 'ingot', 'gold_block'),
  material('diamond', 'gem', 'diamond_block'),
  material('lapis', 'gem', 'lapis_block'),
  material('plant_fiber', 'fiber', 'oak_leaves'),
  material('wheat', 'grain', 'yellow_wool'),
  material('sugar', 'powder', 'white_concrete'),
  material('cocoa_beans', 'gem', 'brown_wool'),
  material('egg', 'potato', 'white_wool'),
  material('bread', 'loaf', 'oak_planks', { food: 5 }),
  material('cookie', 'cookie', 'brown_wool', { food: 2 }),
  material('melon_slice', 'melon', 'red_wool', { food: 2 }),
  material('carrot', 'carrot', 'orange_concrete', { food: 3 }),
  material('golden_carrot', 'carrot', 'gold_block', { food: 8 }),
  material('potato', 'potato', 'brown_wool', { food: 1 }),
  material('baked_potato', 'potato', 'oak_planks', { food: 5 }),
  material('cake', 'cake', 'white_wool', { food: 10, maxStack: 16 }),
  material('iron_vest', 'armor', 'iron_block', {
    maxStack: 1,
    durability: 240,
    equipment: 'body',
    modifiers: { armor: 0.2, speed: 0.95 },
  }),
  ...COLORS.map((color) => material(`${color}_pigment`, 'powder', `${color}_concrete`)),
  ...(['stone', 'iron', 'diamond'] as const).flatMap((grade, index) => {
    const tier = index + 2,
      durability = [132, 251, 400][index],
      surface = [undefined, 'iron_block', 'diamond_block'][index];
    return (['pickaxe', 'axe', 'shovel'] as const).flatMap((kind) =>
      grade === 'stone' && kind === 'pickaxe'
        ? []
        : [
            {
              itemType: `${grade}_${kind}`,
              labelKey: `item.${grade}_${kind}`,
              maxStack: 1,
              durability,
              tool: { kind, tier, speed: [5, 7, 9][index] },
              combat: {
                damage: kind === 'axe' ? [5, 6, 7][index] : [4, 5, 6][index],
                cooldown: kind === 'axe' ? 18 : 15,
                reach: 3,
              },
              model: kind,
              ...(surface ? { material: surface } : {}),
            },
          ],
    );
  }),
];
const mix = (key: string, a: string, b: string, out = key, count = 2) =>
  recipe(key, [a, b, null, null], out, count);
export const progressionRecipes: Recipe[] = [
  recipe(
    'bucket',
    ['iron_ingot', null, 'iron_ingot', null, 'iron_ingot', null, null, null, null],
    'bucket',
  ),
  recipe(
    'obsidian',
    ['stone', 'stone', 'stone', 'stone', '#fuel', 'stone', 'stone', 'stone', 'stone'],
    'obsidian',
  ),
  recipe(
    'glowstone',
    ['sand', '#fuel', 'sand', '#fuel', 'glass', '#fuel', 'sand', '#fuel', 'sand'],
    'glowstone',
    2,
  ),
  recipe('sponge', ['yellow_wool', 'plant_fiber', null, null], 'sponge'),
  recipe('blue_pigment_lapis', ['lapis', null, null, null], 'blue_pigment', 2),
  ...(['birch', 'spruce'] as const).map((wood) =>
    recipe(`${wood}_planks`, [`${wood}_log`, null, null, null], `${wood}_planks`, 4),
  ),
  recipe('glass', ['sand', '#fuel', null, null], 'glass', 2),
  recipe('cobblestone', ['stone', null, null, null], 'cobblestone'),
  recipe('bricks', ['sand', 'dirt', 'stone', '#fuel'], 'bricks', 4),
  recipe('sandstone', ['sand', 'sand', 'sand', 'sand'], 'sandstone', 4),
  recipe('stone_bricks', ['stone', 'stone', 'stone', 'stone'], 'stone_bricks', 4),
  mix('mossy_cobblestone', 'cobblestone', '#leaves', 'mossy_cobblestone', 1),
  mix('mossy_stone_bricks', 'stone_bricks', '#leaves', 'mossy_stone_bricks', 1),
  recipe('stone_slab', ['stone', 'stone', null, null], 'stone_slab', 4),
  recipe(
    'oak_stairs',
    ['#planks', null, null, '#planks', '#planks', null, '#planks', '#planks', '#planks'],
    'oak_stairs',
    4,
  ),
  recipe(
    'ladder',
    ['stick', null, 'stick', 'stick', 'stick', 'stick', 'stick', null, 'stick'],
    'ladder',
    3,
  ),
  recipe('torch', ['#fuel', null, 'stick', null], 'torch', 4),
  recipe(
    'paper',
    ['plant_fiber', 'plant_fiber', 'plant_fiber', null, null, null, null, null, null],
    'paper',
    3,
  ),
  recipe(
    'bookshelf',
    ['#planks', '#planks', '#planks', 'paper', 'paper', 'paper', '#planks', '#planks', '#planks'],
    'bookshelf',
  ),
  recipe(
    'white_wool',
    ['plant_fiber', 'plant_fiber', 'plant_fiber', 'plant_fiber'],
    'white_wool',
    2,
  ),
  recipe('white_concrete', ['sand', 'gravel', 'stone', null], 'white_concrete', 4),
  ...COLORS.flatMap((color) => [
    ...(color === 'white'
      ? []
      : [
          mix(`${color}_wool`, 'white_wool', `${color}_pigment`, `${color}_wool`, 1),
          mix(`${color}_concrete`, 'white_concrete', `${color}_pigment`, `${color}_concrete`, 1),
        ]),
    mix(`${color}_stained_glass`, 'glass', `${color}_pigment`, `${color}_stained_glass`, 1),
  ]),
  ...Object.entries({
    red: 'poppy',
    yellow: 'dandelion',
    blue: 'cornflower',
    green: 'oak_leaves',
    white: 'sand',
    black: 'charcoal',
    brown: 'dirt',
  }).map(([color, input]) =>
    recipe(`${color}_pigment`, [input, null, null, null], `${color}_pigment`, 2),
  ),
  ...[
    ['orange', 'red', 'yellow'],
    ['purple', 'red', 'blue'],
    ['pink', 'red', 'white'],
    ['gray', 'white', 'black'],
    ['light_gray', 'white', 'gray'],
    ['lime', 'green', 'white'],
    ['cyan', 'green', 'blue'],
    ['light_blue', 'blue', 'white'],
    ['magenta', 'purple', 'pink'],
  ].map(([out, a, b]) => mix(`${out}_pigment`, `${a}_pigment`, `${b}_pigment`)),
  recipe('iron_ingot', ['iron_ore', '#fuel', null, null], 'iron_ingot'),
  recipe('gold_ingot', ['gold_ore', '#fuel', null, null], 'gold_ingot'),
  ...(['iron', 'gold', 'diamond', 'lapis'] as const).flatMap((grade) => {
    const part = grade === 'iron' || grade === 'gold' ? `${grade}_ingot` : grade;
    return [
      recipe(`${grade}_block`, Array(9).fill(part), `${grade}_block`),
      recipe(`${grade}_block_to_material`, [`${grade}_block`, null, null, null], part, 9),
    ];
  }),
  ...(['stone', 'iron', 'diamond'] as const).flatMap((grade, index) => {
    const ingredient = grade === 'stone' ? 'stone' : grade === 'iron' ? 'iron_ingot' : 'diamond',
      durability = [132, 251, 400][index];
    return (['pickaxe', 'axe', 'shovel'] as const).flatMap((kind) =>
      grade === 'stone' && kind === 'pickaxe'
        ? []
        : [
            recipe(
              `${grade}_${kind}`,
              kind === 'pickaxe'
                ? [ingredient, ingredient, ingredient, null, 'stick', null, null, 'stick', null]
                : kind === 'axe'
                  ? [ingredient, ingredient, null, ingredient, 'stick', null, null, 'stick', null]
                  : [null, ingredient, null, null, 'stick', null, null, 'stick', null],
              `${grade}_${kind}`,
              1,
              durability,
            ),
          ],
    );
  }),
  recipe('bread', ['wheat', 'wheat', 'wheat', null, null, null, null, null, null], 'bread'),
  recipe('sugar', ['sugar_cane', null, null, null], 'sugar', 2),
  recipe(
    'cookie',
    ['wheat', 'cocoa_beans', 'wheat', 'sugar', null, null, null, null, null],
    'cookie',
    4,
  ),
  recipe('melon_block', Array(9).fill('melon_slice'), 'melon'),
  recipe('melon_slices', ['melon', null, null, null], 'melon_slice', 9),
  recipe('cake', ['wheat', 'wheat', 'sugar', 'egg'], 'cake'),
  recipe('golden_carrot', ['carrot', 'gold_ingot', null, null], 'golden_carrot'),
  recipe('baked_potato', ['potato', '#fuel', null, null], 'baked_potato'),
  recipe(
    'iron_vest',
    ['iron_ingot', null, 'iron_ingot', 'iron_ingot', 'iron_ingot', 'iron_ingot', null, null, null],
    'iron_vest',
    1,
    240,
  ),
];
// Paper is a material rather than a separate block/item identity.
progressionItems.push(material('paper', 'sheet', 'white_wool'));
