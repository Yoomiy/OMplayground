import { useState } from "react";
import type { DrawingState } from "@playground/game-logic";
import { DrawingBoard } from "@/games/DrawingBoard";
import { useSoloAutoSave } from "@/hooks/useSoloAutoSave";
import {
  isJsonObject,
  type JsonValue,
  type SoloGameSaveControls
} from "@/lib/soloGameSaves";

/**
 * Solo drawing using the high-performance Excalidraw whiteboard.
 * State is managed locally and autosaved in browser/localStorage/DB.
 */
export function DrawingSolo({ save }: { save: SoloGameSaveControls }) {
  const [showNotice, setShowNotice] = useState(() => {
    // Show warning notice if old SVG stroke format drawings exist
    return isJsonObject(save.savedState) && Array.isArray(save.savedState.drawings);
  });

  const [gameState, setGameState] = useState<DrawingState>(() => {
    const saved = save.savedState;
    if (isJsonObject(saved)) {
      if (saved.canvas && isJsonObject(saved.canvas)) {
        return {
          status: "playing",
          seats: { solo: "p1" },
          canvas: {
            engine: "excalidraw",
            version: (saved.canvas.version as number) || 0,
            updatedAt: (saved.canvas.updatedAt as number) || Date.now(),
            elements: (saved.canvas.elements as any[]) || [],
            files: (saved.canvas.files as Record<string, any>) || {}
          }
        };
      }
    }
    
    return {
      status: "playing",
      seats: { solo: "p1" },
      canvas: {
        engine: "excalidraw",
        version: 0,
        updatedAt: Date.now(),
        elements: [],
        files: {}
      }
    };
  });

  useSoloAutoSave(save, gameState as unknown as JsonValue);

  const handleIntent = (intent: any) => {
    setGameState((s) => {
      if (intent.type === "CLEAR_CANVAS") {
        return {
          ...s,
          canvas: {
            engine: "excalidraw",
            version: s.canvas.version + 1,
            updatedAt: Date.now(),
            elements: [],
            files: {}
          }
        };
      }
      if (intent.type === "CHECKPOINT") {
        return {
          ...s,
          canvas: {
            engine: "excalidraw",
            version: intent.version,
            updatedAt: Date.now(),
            elements: intent.elements,
            files: intent.files
          }
        };
      }
      return s;
    });
  };

  return (
    <div className="space-y-4">
      {showNotice && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-sm font-semibold text-amber-200 flex justify-between items-center backdrop-blur-md">
          <span>ציורים ישנים בפורמט קודם אינם נתמכים בלוח החדש.</span>
          <button
            type="button"
            className="text-xs text-amber-400 hover:text-amber-300 underline font-bold transition-colors"
            onClick={() => setShowNotice(false)}
          >
            הבנתי
          </button>
        </div>
      )}
      
      <DrawingBoard
        gameState={gameState}
        mySeat="p1"
        myUserId="solo"
        onIntent={handleIntent}
      />
    </div>
  );
}
