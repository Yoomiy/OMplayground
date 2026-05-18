import {
  applyToolWear,
  blockBreakable,
  blockDef,
  breakDurationForBlock,
  isInstantBreak,
  resolveBreakTool,
  type ResolvedTool,
  type ToolSlotRef
} from "@playground/voxel-content";
import type { HotbarState } from "./inventory";
import { HOTBAR_SLOT_COUNT } from "./inventory";
import type { Vec3 } from "./protocol";
import { BLOCK_REGISTRY } from "./protocol";
import type { PlayerRuntime } from "./room";

export interface ActiveBreak {
  pos: Vec3;
  blockId: number;
  startedAt: number;
  durationMs: number;
  tool: ResolvedTool | null;
}

/** Tool in the selected hotbar cell only (must be held to mine with it). */
export function heldHotbarToolSlot(
  hotbar: HotbarState,
  hotbarIndex: number
): ToolSlotRef[] {
  if (hotbarIndex < 0 || hotbarIndex >= HOTBAR_SLOT_COUNT) return [];
  const cell = hotbar[hotbarIndex];
  if (!cell || cell.itemId === 0 || cell.count <= 0) return [];
  return [
    {
      region: "hotbar",
      index: hotbarIndex,
      itemId: cell.itemId,
      durability: cell.durability
    }
  ];
}

export function beginBreak(
  player: PlayerRuntime,
  pos: Vec3,
  blockId: number,
  nowMs: number
): { ok: true; durationMs: number } | { ok: false; code: string; message: string } {
  if (!blockBreakable(blockId)) {
    return { ok: false, code: "UNBREAKABLE_BLOCK", message: "אי אפשר לשבור את הבלוק הזה" };
  }
  if (!player.inventory) {
    return { ok: false, code: "NOT_IN_ROOM", message: "אין מלאי" };
  }

  const hotbarIndex = player.selectedHotbarIndex ?? 0;
  const toolSlots = heldHotbarToolSlot(player.inventory, hotbarIndex);
  const tool = resolveBreakTool(blockId, toolSlots);
  const def = blockDef(blockId);
  if (def?.requiredTool && !tool) {
    return { ok: false, code: "WRONG_TOOL", message: "צריך כלי מתאים בסרגל" };
  }

  const durationMs = breakDurationForBlock(blockId, tool);
  player.activeBreak = {
    pos: [...pos] as Vec3,
    blockId,
    startedAt: nowMs,
    durationMs,
    tool
  };
  return { ok: true, durationMs };
}

export function cancelBreak(player: PlayerRuntime): void {
  player.activeBreak = undefined;
}

export function finishBreak(
  player: PlayerRuntime,
  pos: Vec3,
  blockId: number,
  nowMs: number
): { ok: true } | { ok: false; code: string; message: string } {
  const active = player.activeBreak;
  if (!active) {
    return { ok: false, code: "NO_ACTIVE_BREAK", message: "אין שבירה פעילה" };
  }
  if (
    active.pos[0] !== pos[0] ||
    active.pos[1] !== pos[1] ||
    active.pos[2] !== pos[2] ||
    active.blockId !== blockId
  ) {
    return { ok: false, code: "BAD_INTENT", message: "מטרה השתנתה" };
  }
  const elapsed = nowMs - active.startedAt;
  if (elapsed + 40 < active.durationMs) {
    return { ok: false, code: "TOO_EARLY", message: "עדיין שוברים" };
  }

  if (active.tool && player.inventory) {
    applyWearToHotbarSlot(player, active.tool);
  }

  player.activeBreak = undefined;
  return { ok: true };
}

function applyWearToHotbarSlot(player: PlayerRuntime, tool: ResolvedTool): void {
  if (tool.slot.region !== "hotbar") return;
  const hotbar = player.inventory!;
  const cell = hotbar[tool.slot.index];
  if (!cell || cell.itemId === 0) return;

  const wear = applyToolWear(cell.itemId, cell.durability);
  if (wear.broken) {
    hotbar[tool.slot.index] = {
      blockId: BLOCK_REGISTRY.AIR,
      itemId: 0,
      count: 0
    };
    return;
  }
  hotbar[tool.slot.index] = {
    blockId: BLOCK_REGISTRY.AIR,
    itemId: cell.itemId,
    count: 1,
    durability: wear.durability
  };
}

export function shouldUseTimedBreak(blockId: number, gameMode: string | undefined): boolean {
  if ((gameMode ?? "creative") !== "survival") return false;
  return !isInstantBreak(blockId);
}
