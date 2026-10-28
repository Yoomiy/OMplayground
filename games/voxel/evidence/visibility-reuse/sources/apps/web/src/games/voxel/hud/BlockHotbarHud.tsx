/**
 * BlockHotbarHud — hotbar display for both creative and survival modes.
 * Extracted from MinecraftClient.tsx and wrapped in React.memo.
 *
 * Shows 9 block/item slots at the bottom of the screen.
 * In creative mode: static block palette with selected highlight.
 * In survival mode: first 9 inventory slots with counts and durability.
 */
import React from "react";
import {
  BLOCK_REGISTRY,
  ITEM_ICON,
  type GameMode,
  type HotbarSlot,
} from "@/lib/voxelProtocol";
import { mcSlotClass, toolDurabilityBar } from "@/games/voxel/hud/hudUtils";
import {
  BLOCK_HOTBAR_ICON,
  BLOCK_HUD,
  ITEM_HUD,
  visibleCreativeHotbarBlocks,
} from "@/games/voxel/hud/hudConstants";

export interface BlockHotbarHudProps {
  /** Current game mode ("creative" | "survival"). */
  gameMode: GameMode;
  /** Whether the game is paused (hides the hotbar). */
  paused: boolean;
  /** Whether the teacher is in spectator mode (hides the hotbar). */
  isTeacherSpectator: boolean;
  /** Currently selected block in creative mode (ref snapshot). */
  selectedBlock: number;
  /** Currently selected creative slot index. */
  creativeSlotIdx: number;
  /** Currently selected survival slot index. */
  survivalSlot: number;
  /** First 9 survival inventory slots. */
  inventorySlots: HotbarSlot[];
}

/** Single slot wrapper with key label. */
function slotBox(active: boolean, keyNum: number, inner: JSX.Element): JSX.Element {
  return (
    <div key={keyNum} className={mcSlotClass(active)}>
      <span className="pointer-events-none absolute left-0.5 top-0.5 z-[2] text-[9px] font-black text-[#1a1510] drop-shadow-[0_1px_0_rgba(255,255,255,0.35)]">
        {keyNum}
      </span>
      {inner}
    </div>
  );
}

export const BlockHotbarHud = React.memo(function BlockHotbarHud({
  gameMode,
  paused,
  isTeacherSpectator,
  selectedBlock,
  creativeSlotIdx,
  survivalSlot,
  inventorySlots,
}: BlockHotbarHudProps): JSX.Element | null {
  if (paused || isTeacherSpectator) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center gap-1.5 px-2">
      {gameMode === "creative"
        ? visibleCreativeHotbarBlocks(selectedBlock).map((blockId, i) =>
            slotBox(
              i === creativeSlotIdx && blockId === selectedBlock,
              i + 1,
              <img
                src={BLOCK_HOTBAR_ICON[blockId]}
                alt=""
                title={BLOCK_HUD[blockId] ?? ""}
                className="h-9 w-9"
                style={{ imageRendering: "pixelated" }}
              />
            )
          )
        : inventorySlots.slice(0, 9).map((cell, i) => {
            const itemIcon =
              (cell.itemId ?? 0) > 0 && cell.count > 0
                ? ITEM_ICON[cell.itemId]
                : undefined;
            const blockIcon =
              cell.blockId !== BLOCK_REGISTRY.AIR && cell.count > 0
                ? BLOCK_HOTBAR_ICON[cell.blockId]
                : undefined;
            const icon = itemIcon ?? blockIcon;
            const hasStack = cell.count > 0 && icon !== undefined;
            return slotBox(
              i === survivalSlot,
              i + 1,
              <>
                {hasStack ? (
                  <img
                    src={icon}
                    alt=""
                    title={
                      itemIcon
                        ? `${ITEM_HUD[cell.itemId] ?? cell.itemId} ×${cell.count}`
                        : `${BLOCK_HUD[cell.blockId] ?? cell.blockId} ×${cell.count}`
                    }
                    className="h-9 w-9"
                    style={{ imageRendering: "pixelated" }}
                  />
                ) : (
                  <div className="h-9 w-9 rounded bg-black/40" aria-hidden />
                )}
                {itemIcon ? toolDurabilityBar(cell.itemId, cell.durability) : null}
                {hasStack && (cell.count > 1 || itemIcon) ? (
                  <span className="pointer-events-none absolute bottom-0.5 right-0.5 text-[10px] font-black leading-none text-white drop-shadow-md">
                    {cell.count}
                  </span>
                ) : null}
              </>
            );
          })}
    </div>
  );
});
