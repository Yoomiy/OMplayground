import {
  BLOCK_REGISTRY,
  PLACEABLE_BLOCK_IDS,
  type HotbarSlot
} from "./protocol";

export const HOTBAR_SLOT_COUNT = 9;
export const MAX_STACK = 64;

export type HotbarState = HotbarSlot[];

export function createEmptyHotbar(): HotbarState {
  return Array.from({ length: HOTBAR_SLOT_COUNT }, () => ({
    blockId: BLOCK_REGISTRY.AIR,
    count: 0
  }));
}

export function cloneHotbar(slots: HotbarState): HotbarState {
  return slots.map((s) => ({ blockId: s.blockId, count: s.count }));
}

/** Blocks that never drop an item into the hotbar (fluid / air). */
export function blockDropsPickable(blockId: number): boolean {
  if (blockId === BLOCK_REGISTRY.AIR) return false;
  if (blockId === BLOCK_REGISTRY.WATER) return false;
  return true;
}

function findStackIndex(slots: HotbarState, blockId: number): number {
  return slots.findIndex(
    (s) => s.blockId === blockId && s.count > 0 && s.count < MAX_STACK
  );
}

function findEmptyIndex(slots: HotbarState): number {
  return slots.findIndex((s) => s.blockId === BLOCK_REGISTRY.AIR || s.count <= 0);
}

/** Add one block worth of drops; merges stacks, then first empty slot. */
export function addPickUp(slots: HotbarState, blockId: number): void {
  if (!PLACEABLE_BLOCK_IDS.includes(blockId)) return;
  const stack = findStackIndex(slots, blockId);
  if (stack >= 0) {
    slots[stack].count = Math.min(MAX_STACK, slots[stack].count + 1);
    return;
  }
  const empty = findEmptyIndex(slots);
  if (empty < 0) return;
  slots[empty].blockId = blockId;
  slots[empty].count = 1;
}

/**
 * Best-effort consume for server sync: decrement if we have any; otherwise
 * no-op (client UX is trusted for this school deployment).
 */
export function consumeOneIfPresent(slots: HotbarState, blockId: number): void {
  const i = slots.findIndex((s) => s.blockId === blockId && s.count > 0);
  if (i < 0) return;
  const next = slots[i].count - 1;
  if (next <= 0) {
    slots[i].blockId = BLOCK_REGISTRY.AIR;
    slots[i].count = 0;
  } else {
    slots[i].count = next;
  }
}

export function hotbarFromPersisted(
  raw: unknown,
  fallback: HotbarState
): HotbarState {
  if (!Array.isArray(raw) || raw.length !== HOTBAR_SLOT_COUNT) {
    return cloneHotbar(fallback);
  }
  const out = createEmptyHotbar();
  for (let i = 0; i < HOTBAR_SLOT_COUNT; i++) {
    const cell = raw[i] as { blockId?: unknown; count?: unknown };
    const blockId = Number(cell?.blockId);
    const count = Number(cell?.count);
    if (!Number.isFinite(count)) continue;
    if (blockId === BLOCK_REGISTRY.AIR && count === 0) {
      out[i] = { blockId: BLOCK_REGISTRY.AIR, count: 0 };
      continue;
    }
    if (!PLACEABLE_BLOCK_IDS.includes(blockId)) continue;
    out[i] = {
      blockId,
      count: Math.max(0, Math.min(MAX_STACK, Math.floor(count)))
    };
  }
  return out;
}
