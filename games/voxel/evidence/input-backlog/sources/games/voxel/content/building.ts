import type { BlockDefinition } from '../src/shared/content.ts';
import { block, cube, COLORS } from './helpers.ts';
const stoneMining = { seconds: 1.5, tool: 'pickaxe' as const, requiresTool: true, tier: 1 };
const plant = (family: string, texture = family): BlockDefinition =>
  block(
    family,
    cube(texture, {
      shape: 'cross',
      solid: false,
      opaque: false,
      opacity: 0,
      layer: 1,
      replaceable: true,
    }),
    { soundGroup: 'grass', support: 'below', mining: { seconds: 0.25 } },
  );
export const buildingBlocks: BlockDefinition[] = [
  ...[
    'cobblestone',
    'bricks',
    'bookshelf',
    'mossy_cobblestone',
    'stone_bricks',
    'mossy_stone_bricks',
    'granite',
    'diorite',
    'andesite',
    'deepslate',
  ].map((family) =>
    block(family, cube(family), {
      mining: family === 'bookshelf' ? { seconds: 1, tool: 'axe' } : stoneMining,
      soundGroup: family === 'bookshelf' ? 'wood' : 'stone',
    }),
  ),
  block('gravel', cube('gravel'), {
    soundGroup: 'gravel',
    mining: { seconds: 0.6, tool: 'shovel' },
  }),
  block(
    'sandstone',
    {
      ...cube('sandstone'),
      textures: [
        'sandstone',
        'sandstone',
        'sandstone_top',
        'sandstone_top',
        'sandstone',
        'sandstone',
      ],
    },
    { mining: stoneMining },
  ),
  block('obsidian', cube('obsidian'), {
    mining: { seconds: 6, tool: 'pickaxe', requiresTool: true, tier: 4 },
    blastResistance: 100,
  }),
  block('snow', cube('snow'), { soundGroup: 'sand', mining: { seconds: 0.4, tool: 'shovel' } }),
  block('ice', cube('ice', { layer: 2, opaque: false, opacity: 1, cull_self: true }), {
    soundGroup: 'glass',
    mining: { seconds: 0.5, tool: 'pickaxe' },
  }),
  block(
    'snowy_grass',
    {
      ...cube('grass_snow_side'),
      textures: [
        'grass_snow_side',
        'grass_snow_side',
        'snow',
        'dirt',
        'grass_snow_side',
        'grass_snow_side',
      ],
    },
    {
      drops: [{ itemType: 'dirt', count: 1 }],
      soundGroup: 'grass',
      mining: { seconds: 0.5, tool: 'shovel' },
    },
  ),
  block('sponge', cube('sponge'), { soundGroup: 'cloth', mining: { seconds: 0.5 } }),
  block('pumpkin', cube('pumpkin'), { soundGroup: 'wood', mining: { seconds: 0.7, tool: 'axe' } }),
  block('melon', cube('melon'), {
    soundGroup: 'grass',
    mining: { seconds: 0.5, tool: 'axe' },
    drops: [{ itemType: 'melon_slice', count: 9 }],
  }),
  block(
    'cactus',
    {
      ...cube('cactus_side'),
      textures: [
        'cactus_side',
        'cactus_side',
        'cactus_top',
        'cactus_top',
        'cactus_side',
        'cactus_side',
      ],
    },
    { soundGroup: 'grass', support: 'below', mining: { seconds: 0.4 } },
  ),
  plant('sapling', 'fern'),
  plant('dandelion'),
  plant('poppy'),
  plant('cornflower'),
  plant('dead_bush'),
  plant('brown_mushroom'),
  plant('red_mushroom'),
  plant('sugar_cane'),
  ...(['birch', 'spruce'] as const).flatMap((wood) => [
    block(
      `${wood}_log`,
      {
        ...cube(`${wood}_log`),
        textures: [
          `${wood}_log`,
          `${wood}_log`,
          `${wood}_log_top`,
          `${wood}_log_top`,
          `${wood}_log`,
          `${wood}_log`,
        ],
      },
      { soundGroup: 'wood', mining: { seconds: 1, tool: 'axe' } },
    ),
    block(`${wood}_planks`, cube(`${wood}_planks`), { soundGroup: 'wood' }),
    block(
      `${wood}_leaves`,
      cube(`${wood}_leaves`, {
        layer: 1,
        opaque: false,
        opacity: 1,
        leaves: true,
        tint: wood !== 'birch',
      }),
      {
        soundGroup: 'grass',
        drops: [
          { itemType: `${wood}_leaves`, count: 1 },
          { itemType: 'apple', count: 1 },
        ],
      },
    ),
  ]),
  ...COLORS.flatMap((color) => [
    block(`${color}_wool`, cube(`${color}_wool`), {
      soundGroup: 'cloth',
      mining: { seconds: 0.6 },
    }),
    block(`${color}_concrete`, cube(`${color}_concrete`), { mining: stoneMining }),
    block(
      `${color}_stained_glass`,
      cube(`${color}_stained_glass`, {
        layer: 2,
        solid: true,
        opaque: false,
        opacity: 0,
        cull_self: true,
      }),
      { soundGroup: 'glass', mining: { seconds: 0.5 } },
    ),
  ]),
];
