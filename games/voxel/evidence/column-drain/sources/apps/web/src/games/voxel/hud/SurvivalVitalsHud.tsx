/**
 * SurvivalVitalsHud — health bar overlay for survival mode.
 * Extracted from MinecraftClient.tsx and wrapped in React.memo
 * to avoid re-renders when unrelated parent state changes.
 */
import React from "react";
import type { PlayerVitals } from "@/lib/voxelProtocol";
import { vitalsPct } from "@/games/voxel/hud/hudUtils";

export interface SurvivalVitalsHudProps {
  /** Current game mode — only renders in "survival". */
  gameMode: string;
  /** Whether the game is paused (hides the HUD). */
  paused: boolean;
  /** Whether the teacher is in spectator mode (hides the HUD). */
  isTeacherSpectator: boolean;
  /** Local (interpolated) player vitals from the server. */
  localVitals: PlayerVitals;
}

export const SurvivalVitalsHud = React.memo(function SurvivalVitalsHud({
  gameMode,
  paused,
  isTeacherSpectator,
  localVitals,
}: SurvivalVitalsHudProps): JSX.Element | null {
  if (gameMode !== "survival" || paused || isTeacherSpectator) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-20 flex justify-center px-3">
      <div
        className="w-[min(94vw,11.5rem)] rounded-sm border-2 border-black/55 bg-neutral-950/70 p-2 shadow-[0_8px_20px_rgba(0,0,0,0.55)]"
        dir="rtl"
      >
        <div>
          <div className="mb-1 flex items-center justify-between text-[10px] font-black text-red-100">
            <span>חיים</span>
            <span>{Math.ceil(localVitals.health)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-sm bg-black/60">
            <div
              className="h-full bg-red-500"
              style={{ width: vitalsPct(localVitals.health, 20) }}
            />
          </div>
        </div>
      </div>
    </div>
  );
});
