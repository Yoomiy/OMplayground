/**
 * Canonical item registry for voxel survival content. Numeric ids stay stable;
 * gameplay metadata is data-driven for server + UI.
 */

import type { ToolKind, ToolTier } from "./mining";

export type ItemCategory = "material" | "tool" | "food" | "blockItem";

/** Filename under apps/web/public/minecraft-assets/ — client-only UX. */
const WEB_ICON_BASE = "/minecraft-assets/" as const;

export interface ItemToolSpec {
  readonly kind: ToolKind;
  readonly tier: ToolTier;
  readonly speed: number;
  readonly durability: number;
}

export interface ItemDef {
  readonly id: number;
  readonly key: string;
  readonly category: ItemCategory;
  readonly maxStack: number;
  /** Optional UI icon asset (relative filename only). */
  readonly iconFilename?: string;
  readonly tool?: ItemToolSpec;
}

const TOOL_SPEED: Record<ToolTier, number> = {
  0: 2,
  1: 4,
  2: 6,
  3: 8
};

const TOOL_DURABILITY: Record<ToolTier, number> = {
  0: 60,
  1: 132,
  2: 251,
  3: 400
};

function toolDef(kind: ToolKind, tier: ToolTier): ItemToolSpec {
  return {
    kind,
    tier,
    speed: TOOL_SPEED[tier],
    durability: TOOL_DURABILITY[tier]
  };
}

export const ITEM_DEFS = [
  {
    id: 100,
    key: "STICK",
    category: "material",
    maxStack: 64,
    iconFilename: "stick.png"
  },
  {
    id: 101,
    key: "PLANKS",
    category: "material",
    maxStack: 64,
    iconFilename: "oak_planks.png"
  },
  {
    id: 102,
    key: "WOODEN_PICKAXE",
    category: "tool",
    maxStack: 1,
    iconFilename: "wooden_pickaxe.png",
    tool: toolDef("pickaxe", 0)
  },
  {
    id: 103,
    key: "STONE_PICKAXE",
    category: "tool",
    maxStack: 1,
    iconFilename: "stone_pickaxe.png",
    tool: toolDef("pickaxe", 1)
  },
  {
    id: 104,
    key: "IRON_PICKAXE",
    category: "tool",
    maxStack: 1,
    iconFilename: "iron_pickaxe.png",
    tool: toolDef("pickaxe", 2)
  },
  {
    id: 105,
    key: "WOODEN_AXE",
    category: "tool",
    maxStack: 1,
    iconFilename: "wooden_axe.png",
    tool: toolDef("axe", 0)
  },
  {
    id: 106,
    key: "STONE_AXE",
    category: "tool",
    maxStack: 1,
    iconFilename: "stone_axe.png",
    tool: toolDef("axe", 1)
  },
  {
    id: 107,
    key: "WOODEN_SHOVEL",
    category: "tool",
    maxStack: 1,
    iconFilename: "wooden_shovel.png",
    tool: toolDef("shovel", 0)
  },
  {
    id: 108,
    key: "STONE_SHOVEL",
    category: "tool",
    maxStack: 1,
    iconFilename: "stone_shovel.png",
    tool: toolDef("shovel", 1)
  }
] as const satisfies readonly ItemDef[];

type ItemRegistryKey = (typeof ITEM_DEFS)[number]["key"];

/** Compile-time narrowed keys (`ITEM_REGISTRY.STICK`, …). */
export type ItemRegistry = { readonly [K in ItemRegistryKey]: number };

function buildItemRegistry(): ItemRegistry {
  const out = {} as Record<string, number>;
  const seenIds = new Set<number>();
  for (const def of ITEM_DEFS) {
    if (seenIds.has(def.id)) {
      throw new Error(`Duplicate item id: ${def.id}`);
    }
    seenIds.add(def.id);
    if (Object.prototype.hasOwnProperty.call(out, def.key)) {
      throw new Error(`Duplicate item key: ${def.key}`);
    }
    out[def.key] = def.id;
  }
  return out as ItemRegistry;
}

export const ITEM_REGISTRY = buildItemRegistry();

const ITEM_BY_ID = new Map<number, ItemDef>(
  ITEM_DEFS.map((d) => [d.id, d as ItemDef])
);

export const REGISTERED_ITEM_IDS = new Set<number>(ITEM_DEFS.map((d) => d.id));

export function itemDef(itemId: number): ItemDef | undefined {
  return ITEM_BY_ID.get(itemId);
}

export function itemToolSpec(itemId: number): ItemToolSpec | undefined {
  return ITEM_BY_ID.get(itemId)?.tool;
}

export function itemMaxDurability(itemId: number): number {
  return itemDef(itemId)?.tool?.durability ?? 0;
}

/** Max stack for a registered survival item id; unknown / air → 0. */
export function itemMaxStack(itemId: number): number {
  if (itemId === 0) return 0;
  return ITEM_BY_ID.get(itemId)?.maxStack ?? 0;
}

/** Hotbar-relative URLs for vite public assets (client). */
export function webItemIcons(): Record<number, string> {
  const icons: Record<number, string> = {};
  for (const def of ITEM_DEFS) {
    if (!def.iconFilename) continue;
    icons[def.id] = `${WEB_ICON_BASE}${def.iconFilename}`;
  }
  return icons;
}
