/**
 * Canonical item registry for voxel survival content. Numeric ids stay stable;
 * gameplay metadata is data-driven for server + UI.
 */

import type { ToolKind, ToolTier } from "./mining";

export type ItemCategory = "material" | "tool" | "food" | "blockItem";

export type EquipmentSlotKey = "head" | "chest" | "legs" | "feet" | "hotbar";

/** Filename under apps/web/public/minecraft-assets/ — client-only UX. */
const WEB_ICON_BASE = "/minecraft-assets/item/" as const;

export interface ItemToolSpec {
  readonly kind: ToolKind;
  readonly tier: ToolTier;
  readonly speed: number;
  readonly durability: number;
}

export interface ItemFoodSpec {
  readonly nutrition: number;
  readonly saturationModifier: number;
}

export interface ItemPerkSpec {
  readonly equipSlot: EquipmentSlotKey;
  readonly jumpBonus?: number;
  readonly speedBonus?: number;
  readonly healOnHit?: number;
  readonly fullBright?: boolean;
  readonly damageReduction?: number;
  readonly fallDamageImmune?: boolean;
  readonly sunRegen?: boolean;
}

export interface ItemDef {
  readonly id: number;
  readonly key: string;
  readonly category: ItemCategory;
  readonly maxStack: number;
  /** Optional UI icon asset (relative filename only). */
  readonly iconFilename?: string;
  readonly tool?: ItemToolSpec;
  readonly food?: ItemFoodSpec;
  readonly perk?: ItemPerkSpec;
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
    iconFilename: "../block/oak_planks.png"
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
  },
  {
    id: 109,
    key: "BUCKET",
    category: "material",
    maxStack: 1,
    iconFilename: "bucket.png"
  },
  {
    id: 110,
    key: "WATER_BUCKET",
    category: "material",
    maxStack: 1,
    iconFilename: "water_bucket.png"
  },
  {
    id: 111,
    key: "IRON_INGOT",
    category: "material",
    maxStack: 64,
    iconFilename: "iron_ingot.png"
  },
  {
    id: 112,
    key: "DIAMOND",
    category: "material",
    maxStack: 64,
    iconFilename: "diamond.png"
  },
  {
    id: 113,
    key: "COAL",
    category: "material",
    maxStack: 64,
    iconFilename: "coal.png"
  },
  {
    id: 114,
    key: "FLINT",
    category: "material",
    maxStack: 64,
    iconFilename: "flint.png"
  },
  {
    id: 115,
    key: "WHEAT",
    category: "material",
    maxStack: 64,
    iconFilename: "wheat.png"
  },
  {
    id: 116,
    key: "BREAD",
    category: "food",
    maxStack: 64,
    iconFilename: "bread.png",
    food: { nutrition: 5, saturationModifier: 6.0 }
  },
  {
    id: 117,
    key: "APPLE",
    category: "food",
    maxStack: 64,
    iconFilename: "apple.png",
    food: { nutrition: 4, saturationModifier: 2.4 }
  },
  {
    id: 118,
    key: "DIAMOND_PICKAXE",
    category: "tool",
    maxStack: 1,
    iconFilename: "diamond_pickaxe.png",
    tool: toolDef("pickaxe", 3)
  },
  {
    id: 119,
    key: "DIAMOND_AXE",
    category: "tool",
    maxStack: 1,
    iconFilename: "diamond_axe.png",
    tool: toolDef("axe", 3)
  },
  {
    id: 120,
    key: "SWIFT_PICKAXE",
    category: "tool",
    maxStack: 1,
    iconFilename: "gold_pickaxe.png",
    tool: { kind: "pickaxe", tier: 3, speed: 12, durability: 80 },
    perk: { equipSlot: "hotbar", speedBonus: 0.5 }
  },
  {
    id: 121,
    key: "FLINT_AND_STEEL",
    category: "tool",
    maxStack: 1,
    iconFilename: "flint_and_steel.png",
    tool: { kind: "hand", tier: 1, speed: 1, durability: 64 }
  },
  {
    id: 122,
    key: "HEAVY_SHIELD",
    category: "material",
    maxStack: 1,
    iconFilename: "empty_armor_slot_shield.png",
    perk: { equipSlot: "chest", damageReduction: 0.5, speedBonus: -0.2 }
  },
  {
    id: 123,
    key: "FEATHER_FALLING_TALISMAN",
    category: "material",
    maxStack: 1,
    iconFilename: "feather.png",
    perk: { equipSlot: "legs", fallDamageImmune: true }
  },
  {
    id: 124,
    key: "HELIOS_MEDALLION",
    category: "material",
    maxStack: 1,
    iconFilename: "gold_ingot.png",
    perk: { equipSlot: "head", sunRegen: true }
  },
  {
    id: 125,
    key: "HELIUM_BOOTS",
    category: "material",
    maxStack: 1,
    iconFilename: "diamond_boots.png",
    perk: { equipSlot: "feet", jumpBonus: 0.6 }
  },
  {
    id: 126,
    key: "GLOW_TALISMAN",
    category: "material",
    maxStack: 1,
    iconFilename: "glowstone_dust.png",
    perk: { equipSlot: "head", fullBright: true }
  },
  {
    id: 127,
    key: "GOLD_INGOT",
    category: "material",
    maxStack: 64,
    iconFilename: "gold_ingot.png"
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

export function itemFoodSpec(itemId: number): ItemFoodSpec | undefined {
  return ITEM_BY_ID.get(itemId)?.food;
}

export function itemPerkSpec(itemId: number): ItemPerkSpec | undefined {
  return ITEM_BY_ID.get(itemId)?.perk;
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
