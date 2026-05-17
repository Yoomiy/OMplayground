/**
 * Canonical item registry for voxel survival content. Numeric ids stay stable;
 * gameplay metadata is data-driven for server + UI.
 */

export type ItemCategory = "material" | "tool" | "food" | "blockItem";

/** Filename under apps/web/public/minecraft-assets/ — client-only UX. */
const WEB_ICON_BASE = "/minecraft-assets/" as const;

export interface ItemDef {
  readonly id: number;
  readonly key: string;
  readonly category: ItemCategory;
  readonly maxStack: number;
  /** Optional UI icon asset (relative filename only). */
  readonly iconFilename?: string;
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
