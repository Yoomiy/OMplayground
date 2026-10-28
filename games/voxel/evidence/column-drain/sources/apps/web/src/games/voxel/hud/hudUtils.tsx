/**
 * Shared pure utility functions used by multiple HUD overlay components.
 * Extracted from MinecraftClient.tsx to avoid duplication.
 */

import { itemMaxDurability } from "@playground/voxel-content";

/** Minecraft-like slot: raised inner bevel, dark rim. */
export function mcSlotClass(selected: boolean): string {
  return [
    "relative flex h-10 w-10 shrink-0 items-center justify-center",
    "border-2 border-[#2a2a2a]",
    "bg-[#8d8d8d]",
    "shadow-[inset_2px_2px_0_rgba(255,255,255,0.45),inset_-2px_-2px_0_rgba(0,0,0,0.35)]",
    selected ? "z-[1] ring-2 ring-[#f8e060] ring-offset-2 ring-offset-[#5e4f38]" : ""
  ].join(" ");
}

/** Durability bar below a tool icon. Returns null for non-tool items. */
export function toolDurabilityBar(itemId: number, durability?: number): JSX.Element | null {
  const max = itemMaxDurability(itemId);
  if (max <= 0) return null;
  const cur = Math.max(0, Math.min(max, durability ?? max));
  return (
    <span className="pointer-events-none absolute inset-x-0.5 bottom-0.5 h-0.5 overflow-hidden rounded-full bg-black/55">
      <span
        className="block h-full bg-lime-400"
        style={{ width: `${(cur / max) * 100}%` }}
      />
    </span>
  );
}

/** Convert a value/max pair to a CSS percentage string. */
export function vitalsPct(value: number, max: number): string {
  return `${Math.max(0, Math.min(100, (value / max) * 100))}%`;
}
