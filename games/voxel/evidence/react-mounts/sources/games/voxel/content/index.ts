import type { BlockDefinition, ContentSource } from '../src/shared/content.ts';
import { block, cube } from './helpers.ts';
import { buildingBlocks } from './building.ts';
import { resourceBlocks, progressionItems, progressionRecipes } from './progression.ts';
const blocks: BlockDefinition[] = [
  block(
    'air',
    cube('stone', {
      shape: 'air',
      solid: false,
      opaque: false,
      opacity: 0,
      replaceable: true,
      placeable: false,
      breakable: false,
    }),
    { drops: [] },
  ),
  block('bedrock', cube('bedrock', { breakable: false, placeable: false }), {
    drops: [],
    mining: { seconds: 0 },
  }),
  block('stone', cube('stone'), {
    mining: { seconds: 1.5, tool: 'pickaxe', requiresTool: true, tier: 1 },
    blastResistance: 1.5,
  }),
  block('dirt', cube('dirt'), {
    soundGroup: 'gravel',
    blastResistance: 0.4,
    mining: { seconds: 0.5, tool: 'shovel' },
  }),
  block(
    'grass_block',
    {
      ...cube('grass_side', { tint: true }),
      textures: ['grass_side', 'grass_side', 'grass_top', 'dirt', 'grass_side', 'grass_side'],
    },
    { drops: [{ itemType: 'dirt', count: 1 }], soundGroup: 'grass' },
  ),
  block('sand', cube('sand'), { soundGroup: 'sand' }),
  block(
    'water',
    cube('water', {
      shape: 'liquid',
      layer: 2,
      solid: false,
      opaque: false,
      opacity: 1,
      replaceable: true,
      breakable: false,
    }),
    { drops: [], soundGroup: 'water' },
  ),
  block(
    'lava',
    cube('lava', {
      shape: 'liquid',
      solid: false,
      opaque: false,
      opacity: 15,
      emit: 15,
      replaceable: true,
      breakable: false,
    }),
    { drops: [] },
  ),
  block('glass', cube('glass', { layer: 1, opaque: false, opacity: 0, cull_self: true }), {
    soundGroup: 'glass',
  }),
  block(
    'oak_log',
    {
      ...cube('oak_log'),
      textures: ['oak_log', 'oak_log', 'oak_log_top', 'oak_log_top', 'oak_log', 'oak_log'],
    },
    { soundGroup: 'wood', mining: { seconds: 1, tool: 'axe' } },
  ),
  block(
    'oak_leaves',
    cube('oak_leaves', { layer: 1, opaque: false, opacity: 1, leaves: true, tint: true }),
    {
      soundGroup: 'grass',
      drops: [
        { itemType: 'oak_leaves', count: 1 },
        { itemType: 'apple', count: 1 },
      ],
    },
  ),
  block('oak_planks', cube('oak_planks'), { soundGroup: 'wood' }),
  block('crafting_table', cube('oak_planks'), { soundGroup: 'wood', interaction: 'workbench' }),
  block('chest', cube('oak_planks'), { soundGroup: 'wood', interaction: 'container' }),
  block(
    'tnt',
    {
      ...cube('tnt_side'),
      textures: ['tnt_side', 'tnt_side', 'tnt_top', 'tnt_top', 'tnt_side', 'tnt_side'],
    },
    { soundGroup: 'wood', blastResistance: 0.1, explosive: { fuse: 120, radius: 3, damage: 18 } },
  ),
  block('glowstone', cube('glowstone', { emit: 15 })),
  block(
    'short_grass',
    cube('short_grass', {
      shape: 'cross',
      solid: false,
      opaque: false,
      opacity: 0,
      replaceable: true,
      layer: 1,
      tint: true,
    }),
    { support: 'below', drops: [], soundGroup: 'grass' },
  ),
  block('stone_slab', cube('stone'), {
    variants: {
      'half=bottom': cube('stone', { shape: 'slab', double: 'stone' }),
      'half=top': cube('stone', { shape: 'slab', top: true, double: 'stone', placeable: false }),
    },
  }),
  block('oak_stairs', cube('oak_planks'), {
    soundGroup: 'wood',
    variants: Object.fromEntries(
      ['north', 'east', 'south', 'west'].flatMap((name, facing) =>
        [false, true].map((top) => [
          `facing=${name},half=${top ? 'top' : 'bottom'}`,
          cube('oak_planks', { shape: 'stairs', facing, top, placeable: !top && facing === 0 }),
        ]),
      ),
    ),
  }),
  block('ladder', cube('oak_planks'), {
    support: 'wall',
    soundGroup: 'wood',
    variants: Object.fromEntries(
      ['north', 'east', 'south', 'west'].map((name, facing) => [
        `facing=${name}`,
        cube('oak_planks', {
          shape: 'boxes',
          solid: false,
          opaque: false,
          opacity: 0,
          climbable: true,
          boxes: [
            [1, 0, 14, 3, 16, 16],
            [13, 0, 14, 15, 16, 16],
            [1, 3, 14, 15, 5, 16],
            [1, 11, 14, 15, 13, 16],
          ],
          // Boxes rotate via the engine's quarter-turn field, emitted by the compiler.
          facing,
          placeable: facing === 0,
        }),
      ]),
    ),
  }),
  block('torch', cube('torch'), {
    support: 'below',
    variants: {
      '': cube('torch', {
        shape: 'torch',
        solid: false,
        opaque: false,
        opacity: 0,
        emit: 14,
        layer: 1,
      }),
    },
  }),
];
blocks.push(...buildingBlocks, ...resourceBlocks);
const baseSource: ContentSource = {
  blocks,
  items: [
    ...blocks
      .filter((b) => b.family !== 'air' && b.family !== 'bedrock')
      .map((b) => ({
        itemType: b.family,
        labelKey: `item.${b.family}`,
        maxStack: 64,
        places: b.family,
      })),
    { itemType: 'stick', labelKey: 'item.stick', maxStack: 64, model: 'stick' },
    { itemType: 'charcoal', labelKey: 'item.charcoal', maxStack: 64, model: 'powder' },
    { itemType: 'gunpowder', labelKey: 'item.gunpowder', maxStack: 64, model: 'powder' },
    {
      itemType: 'firestarter',
      labelKey: 'item.firestarter',
      maxStack: 1,
      durability: 64,
      igniter: true,
      model: 'igniter',
    },
    { itemType: 'apple', labelKey: 'item.apple', maxStack: 64, food: 4, model: 'apple' },
    {
      itemType: 'wooden_pickaxe',
      labelKey: 'item.wooden_pickaxe',
      maxStack: 1,
      durability: 60,
      tool: { kind: 'pickaxe', speed: 3, tier: 1 },
      combat: { damage: 3, cooldown: 15, reach: 3 },
      model: 'pickaxe',
    },
    {
      itemType: 'stone_pickaxe',
      labelKey: 'item.stone_pickaxe',
      maxStack: 1,
      durability: 132,
      tool: { kind: 'pickaxe', speed: 5, tier: 2 },
      combat: { damage: 4, cooldown: 15, reach: 3 },
      model: 'pickaxe',
    },
    {
      itemType: 'wooden_axe',
      labelKey: 'item.wooden_axe',
      maxStack: 1,
      durability: 60,
      tool: { kind: 'axe', speed: 3, tier: 1 },
      combat: { damage: 4, cooldown: 18, reach: 3 },
      model: 'axe',
    },
    {
      itemType: 'wooden_shovel',
      labelKey: 'item.wooden_shovel',
      maxStack: 1,
      durability: 60,
      tool: { kind: 'shovel', speed: 3, tier: 1 },
      combat: { damage: 3, cooldown: 15, reach: 3 },
      model: 'shovel',
    },
    {
      itemType: 'heavy_shield',
      labelKey: 'item.heavy_shield',
      maxStack: 1,
      durability: 120,
      equipment: 'offhand',
      modifiers: { armor: 0.5, speed: 0.8 },
      model: 'shield',
    },
    {
      itemType: 'trail_boots',
      labelKey: 'item.trail_boots',
      maxStack: 1,
      durability: 120,
      equipment: 'feet',
      modifiers: { speed: 1.1, fall: 0.25 },
      model: 'boots',
    },
    {
      itemType: 'swift_pickaxe',
      labelKey: 'item.swift_pickaxe',
      maxStack: 1,
      durability: 80,
      activation: 'held',
      modifiers: { speed: 1.5 },
      tool: { kind: 'pickaxe', speed: 8, tier: 2 },
      combat: { damage: 4, cooldown: 15, reach: 3 },
      model: 'pickaxe',
    },
    {
      itemType: 'feather_talisman',
      labelKey: 'item.feather_talisman',
      maxStack: 1,
      durability: 64,
      equipment: 'legs',
      perks: { fallImmune: true },
      model: 'talisman',
    },
    {
      itemType: 'helios_medallion',
      labelKey: 'item.helios_medallion',
      maxStack: 1,
      durability: 120,
      equipment: 'head',
      perks: { sunRegen: true },
      model: 'medallion',
    },
    {
      itemType: 'helium_boots',
      labelKey: 'item.helium_boots',
      maxStack: 1,
      durability: 120,
      equipment: 'feet',
      modifiers: { jump: 1.6 },
      model: 'boots',
    },
    {
      itemType: 'glow_talisman',
      labelKey: 'item.glow_talisman',
      maxStack: 1,
      durability: 120,
      equipment: 'head',
      perks: { vision: true },
      model: 'talisman',
    },
  ],
  recipes: [
    {
      key: 'swift_pickaxe',
      size: 3,
      ingredients: [
        'stone',
        'stone',
        'stone',
        null,
        'stick',
        null,
        'charcoal',
        'stick',
        'charcoal',
      ],
      result: { itemType: 'swift_pickaxe', count: 1, instance: { durability: 80 } },
    },
    {
      key: 'feather_talisman',
      size: 3,
      ingredients: [
        null,
        'oak_leaves',
        null,
        'oak_leaves',
        'apple',
        'oak_leaves',
        null,
        'oak_leaves',
        null,
      ],
      result: { itemType: 'feather_talisman', count: 1, instance: { durability: 64 } },
    },
    {
      key: 'helios_medallion',
      size: 3,
      ingredients: [null, 'sand', null, 'sand', 'charcoal', 'sand', null, 'sand', null],
      result: { itemType: 'helios_medallion', count: 1, instance: { durability: 120 } },
    },
    {
      key: 'helium_boots',
      size: 3,
      ingredients: [
        'oak_planks',
        null,
        'oak_planks',
        'oak_planks',
        null,
        'oak_planks',
        'oak_leaves',
        null,
        'oak_leaves',
      ],
      result: { itemType: 'helium_boots', count: 1, instance: { durability: 120 } },
    },
    {
      key: 'glow_talisman',
      size: 3,
      ingredients: [
        null,
        'charcoal',
        null,
        'charcoal',
        'stick',
        'charcoal',
        null,
        'charcoal',
        null,
      ],
      result: { itemType: 'glow_talisman', count: 1, instance: { durability: 120 } },
    },
    {
      key: 'charcoal',
      size: 2,
      ingredients: ['oak_log', 'oak_planks', null, null],
      result: { itemType: 'charcoal', count: 2 },
    },
    {
      key: 'gunpowder',
      size: 2,
      ingredients: ['charcoal', 'stone', null, null],
      result: { itemType: 'gunpowder', count: 3 },
    },
    {
      key: 'firestarter',
      size: 2,
      ingredients: ['stone', 'stick', null, null],
      result: { itemType: 'firestarter', count: 1, instance: { durability: 64 } },
    },
    {
      key: 'tnt',
      size: 3,
      ingredients: [
        'gunpowder',
        'sand',
        'gunpowder',
        'sand',
        'gunpowder',
        'sand',
        'gunpowder',
        'sand',
        'gunpowder',
      ],
      result: { itemType: 'tnt', count: 1 },
    },
    {
      key: 'heavy_shield',
      size: 3,
      ingredients: [
        'oak_planks',
        'stick',
        'oak_planks',
        'oak_planks',
        'oak_planks',
        'oak_planks',
        null,
        'oak_planks',
        null,
      ],
      result: { itemType: 'heavy_shield', count: 1, instance: { durability: 120 } },
    },
    {
      key: 'trail_boots',
      size: 3,
      ingredients: [
        'oak_planks',
        null,
        'oak_planks',
        'oak_planks',
        null,
        'oak_planks',
        null,
        null,
        null,
      ],
      result: { itemType: 'trail_boots', count: 1, instance: { durability: 120 } },
    },
    {
      key: 'stone_pickaxe',
      size: 3,
      ingredients: ['stone', 'stone', 'stone', null, 'stick', null, null, 'stick', null],
      result: { itemType: 'stone_pickaxe', count: 1, instance: { durability: 132 } },
    },
    {
      key: 'wooden_axe',
      size: 3,
      ingredients: [
        'oak_planks',
        'oak_planks',
        null,
        'oak_planks',
        'stick',
        null,
        null,
        'stick',
        null,
      ],
      result: { itemType: 'wooden_axe', count: 1, instance: { durability: 60 } },
    },
    {
      key: 'wooden_shovel',
      size: 3,
      ingredients: [null, 'oak_planks', null, null, 'stick', null, null, 'stick', null],
      result: { itemType: 'wooden_shovel', count: 1, instance: { durability: 60 } },
    },
    {
      key: 'oak_planks',
      size: 2,
      ingredients: ['oak_log', null, null, null],
      result: { itemType: 'oak_planks', count: 4 },
    },
    {
      key: 'stick',
      size: 2,
      ingredients: ['oak_planks', null, 'oak_planks', null],
      result: { itemType: 'stick', count: 4 },
    },
    {
      key: 'crafting_table',
      size: 2,
      ingredients: ['oak_planks', 'oak_planks', 'oak_planks', 'oak_planks'],
      result: { itemType: 'crafting_table', count: 1 },
    },
    {
      key: 'chest',
      size: 3,
      ingredients: [
        'oak_planks',
        'oak_planks',
        'oak_planks',
        'oak_planks',
        null,
        'oak_planks',
        'oak_planks',
        'oak_planks',
        'oak_planks',
      ],
      result: { itemType: 'chest', count: 1 },
    },
    {
      key: 'wooden_pickaxe',
      size: 3,
      ingredients: [
        'oak_planks',
        'oak_planks',
        'oak_planks',
        null,
        'stick',
        null,
        null,
        'stick',
        null,
      ],
      result: { itemType: 'wooden_pickaxe', count: 1, instance: { durability: 60 } },
    },
  ],
  terrainFallback: 'stone',
  terrainAliases: {
    oak_log: 'oak_log',
    birch_log: 'oak_log',
    spruce_log: 'oak_log',
    birch_leaves: 'oak_leaves',
    spruce_leaves: 'oak_leaves',
    podzol: 'dirt',
    snowy_grass: 'grass_block',
    gravel: 'sand',
    fern: 'short_grass',
    dandelion: 'short_grass',
    poppy: 'short_grass',
    cornflower: 'short_grass',
    dead_bush: 'short_grass',
    brown_mushroom: 'short_grass',
    red_mushroom: 'short_grass',
  },
};
const forage = {
  none: 695,
  entries: [
    { itemType: 'wheat', count: 1, weight: 150 },
    { itemType: 'carrot', count: 1, weight: 40 },
    { itemType: 'potato', count: 1, weight: 40 },
    { itemType: 'cocoa_beans', count: 1, weight: 20 },
    { itemType: 'sugar_cane', count: 1, weight: 20 },
    { itemType: 'egg', count: 1, weight: 10 },
    { itemType: 'melon_slice', count: 1, weight: 20 },
    { itemType: 'pumpkin', count: 1, weight: 5 },
  ],
};
export const source: ContentSource = {
  ...baseSource,
  blocks: blocks.map((block) =>
    block.family === 'short_grass'
      ? { ...block, drops: [{ itemType: 'plant_fiber', count: 1 }], forage }
      : block.family.endsWith('_leaves')
        ? {
            ...block,
            forage: { none: 95, entries: [{ itemType: 'sapling', count: 1, weight: 5 }] },
          }
        : block,
  ),
  items: [
    ...baseSource.items.map((item) => ({
      ...item,
      ...(item.places?.endsWith('_planks')
        ? { tags: ['planks'] }
        : item.places?.endsWith('_log')
          ? { tags: ['logs'] }
          : item.places?.endsWith('_leaves')
            ? { tags: ['leaves'] }
            : item.itemType === 'charcoal'
              ? { tags: ['fuel'] }
              : {}),
    })),
    ...progressionItems,
  ],
  recipes: [
    ...baseSource.recipes.map((recipe) => ({
      ...recipe,
      ingredients: recipe.ingredients.map((ingredient) =>
        ingredient === 'oak_planks'
          ? '#planks'
          : ingredient === 'oak_leaves'
            ? '#leaves'
            : recipe.key === 'charcoal' && ingredient === 'oak_log'
              ? '#logs'
              : ingredient === 'charcoal' && ['gunpowder'].includes(recipe.key)
                ? '#fuel'
                : ingredient,
      ),
    })),
    ...progressionRecipes,
  ],
  terrainAliases: {
    oak_log: 'oak_log',
    snow_block: 'snow',
    birch_log: 'birch_log',
    spruce_log: 'spruce_log',
    podzol: 'dirt',
    fern: 'short_grass',
    redstone_ore: 'stone',
  },
};
