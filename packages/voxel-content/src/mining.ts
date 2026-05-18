import { blockDef } from "./blocks";
import { itemDef, type ItemToolSpec } from "./items";

export type ToolKind = "pickaxe" | "axe" | "shovel" | "hand";

export type ToolTier = 0 | 1 | 2 | 3;

/** Hand mining when no matching tool is equipped in item storage. */
export const HAND_TOOL_SPEED = 1;

export interface ResolvedTool {
  spec: ItemToolSpec;
  /** Where durability should be decremented after a break. */
  slot: { region: "hotbar" | "storage" | "craft"; index: number };
}

export interface ToolSlotRef {
  region: "hotbar" | "storage" | "craft";
  index: number;
  itemId: number;
  /** Remaining uses; omitted means full durability from def. */
  durability?: number;
}

function toolSpecFromItem(itemId: number): ItemToolSpec | undefined {
  return itemDef(itemId)?.tool;
}

function effectiveDurability(itemId: number, durability?: number): number {
  const max = itemDef(itemId)?.tool?.durability ?? 0;
  if (max <= 0) return 0;
  if (durability === undefined) return max;
  return Math.max(0, Math.min(max, durability));
}

function tierMeets(minTier: ToolTier, toolTier: ToolTier): boolean {
  return toolTier >= minTier;
}

/**
 * Tool held in the given slot(s) for breaking `blockId` (typically one hotbar cell).
 * Returns null when the held item is not a valid tool or is under-tier.
 */
export function resolveBreakTool(
  blockId: number,
  slots: ToolSlotRef[]
): ResolvedTool | null {
  const def = blockDef(blockId);
  if (!def?.breakable) return null;

  const speedKind = def.speedTool ?? def.requiredTool;

  for (const slot of slots) {
    const spec = toolSpecFromItem(slot.itemId);
    if (!spec) continue;
    if (speedKind && spec.kind !== speedKind) continue;
    if (def.requiredTool) {
      if (spec.kind !== def.requiredTool) continue;
      if (!tierMeets(def.minTier, spec.tier)) continue;
    }
    return { spec, slot: { region: slot.region, index: slot.index } };
  }

  if (def.requiredTool) return null;
  return null;
}

/** Break duration in ms at the given tool speed (1 = bare hand). */
export function breakDurationMs(hardness: number, toolSpeed: number): number {
  const h = Math.max(0, hardness);
  const speed = Math.max(0.05, toolSpeed);
  if (h <= 0) return 0;
  return Math.ceil((h / speed) * 1000);
}

export function breakDurationForBlock(
  blockId: number,
  tool: ResolvedTool | null
): number {
  const def = blockDef(blockId);
  if (!def) return 0;
  const speed = tool?.spec.speed ?? HAND_TOOL_SPEED;
  return breakDurationMs(def.hardness, speed);
}

export function isInstantBreak(blockId: number): boolean {
  const def = blockDef(blockId);
  return (def?.hardness ?? 0) <= 0;
}

/** Decrement durability on a tool stack; removes the stack at 0. */
export function applyToolWear(
  itemId: number,
  durability: number | undefined
): { durability?: number; broken: boolean } {
  const max = itemDef(itemId)?.tool?.durability ?? 0;
  if (max <= 0) return { broken: false };
  const cur = effectiveDurability(itemId, durability);
  const next = cur - 1;
  if (next <= 0) return { broken: true };
  return { durability: next, broken: false };
}
