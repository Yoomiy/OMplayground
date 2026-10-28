export type Shape =
  | 'air'
  | 'cube'
  | 'cross'
  | 'liquid'
  | 'slab'
  | 'stairs'
  | 'torch'
  | 'wall_torch'
  | 'boxes'
  | 'fence'
  | 'pane'
  | 'post';
export type EngineState = {
  shape: Shape;
  textures: readonly string[];
  layer?: 0 | 1 | 2;
  solid?: boolean;
  opaque?: boolean;
  opacity?: number;
  emit?: number;
  top?: boolean;
  facing?: number;
  climbable?: boolean;
  tint?: boolean;
  leaves?: boolean;
  replaceable?: boolean;
  breakable?: boolean;
  placeable?: boolean;
  cull_self?: boolean;
  boxes?: readonly (readonly number[])[];
  double?: string;
};
export type BlockDefinition = {
  family: string;
  labelKey: string;
  soundGroup: string;
  mining: {
    seconds: number;
    tool?: 'pickaxe' | 'axe' | 'shovel';
    requiresTool?: boolean;
    tier?: number;
  };
  drops: readonly { itemType: string; count: number }[];
  forage?: Readonly<{
    none: number;
    entries: readonly { itemType: string; count: number; weight: number }[];
  }>;
  support: 'none' | 'below' | 'wall';
  interaction?: 'workbench' | 'container';
  blastResistance?: number;
  explosive?: ExplosiveRule;
  variants: Readonly<Record<string, EngineState>>;
};
export type ItemDefinition = {
  itemType: string;
  labelKey: string;
  maxStack: number;
  tags?: readonly string[];
  material?: string;
  color?: readonly [number, number, number];
  places?: string;
  collects?: Readonly<{ family: string; result: string }>;
  remainder?: string;
  durability?: number;
  equipment?: 'head' | 'body' | 'legs' | 'feet' | 'offhand';
  activation?: 'held';
  modifiers?: {
    speed?: number;
    gravity?: number;
    control?: number;
    jump?: number;
    fall?: number;
    armor?: number;
  };
  perks?: { fallImmune?: true; sunRegen?: true; vision?: true };
  food?: number;
  igniter?: boolean;
  combat?: { damage: number; cooldown: number; reach: number };
  tool?: { kind: 'pickaxe' | 'axe' | 'shovel'; speed: number; tier: number };
  model?:
    | 'pickaxe'
    | 'axe'
    | 'shovel'
    | 'stick'
    | 'boots'
    | 'apple'
    | 'shield'
    | 'talisman'
    | 'medallion'
    | 'powder'
    | 'igniter'
    | 'ingot'
    | 'gem'
    | 'fiber'
    | 'grain'
    | 'loaf'
    | 'cookie'
    | 'melon'
    | 'carrot'
    | 'potato'
    | 'cake'
    | 'sheet'
    | 'armor'
    | 'bucket';
};
export type ExplosiveRule = Readonly<{ fuse: number; radius: number; damage: number }>;
export type Stack = Readonly<{
  itemType: string;
  count: number;
  instance?: Readonly<{ durability?: number }>;
}>;
export type Recipe = {
  key: string;
  size: 2 | 3;
  ingredients: readonly (string | null)[];
  result: Stack;
};
export type ContentSource = {
  blocks: readonly BlockDefinition[];
  items: readonly ItemDefinition[];
  recipes: readonly Recipe[];
  terrainFallback: string;
  terrainAliases: Readonly<Record<string, string>>;
};
/** Artifact consumed directly by all instances; compilation is an offline tool concern. */
export type EngineBlock = Omit<EngineState, 'textures' | 'double'> & {
  name: string;
  state: string;
  tex: number[];
  double: number;
  turn?: number;
};
export type ContentManifest = {
  schema: number;
  height: number;
  hash: string;
  blocks: EngineBlock[];
  terrainFallback: number;
  terrain: Record<string, number>;
  behavior: Omit<BlockDefinition, 'variants'>[];
  items: ItemDefinition[];
  recipes: Recipe[];
};
