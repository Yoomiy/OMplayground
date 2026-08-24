import { useCallback, useEffect, useMemo, useState } from "react";
import type { DrawingCanvasSnapshot, DrawingState } from "@playground/game-logic";
import { DrawingBoard } from "@/games/DrawingBoard";
import {
  isJsonObject,
  type JsonValue,
  type SoloGameSaveControls
} from "@/lib/soloGameSaves";

/**
 * Solo drawing using the high-performance Excalidraw whiteboard.
 * State is journaled in browser IndexedDB and checkpointed to Supabase.
 */
export function DrawingSolo({ save }: { save: SoloGameSaveControls }) {
  const [initialDraftUpdates, setInitialDraftUpdates] = useState<Uint8Array[] | null>(null);
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
            clearVersion: (saved.canvas.clearVersion as number) || 0,
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
        clearVersion: 0,
        updatedAt: Date.now(),
        elements: [],
        files: {}
      }
    };
  });

  const persistSnapshot = useCallback(async (canvas: DrawingCanvasSnapshot) => {
    const next: DrawingState = {
      status: "playing",
      seats: { solo: "p1" },
      canvas
    };
    setGameState(next);
    await save.saveState(next as unknown as JsonValue);
  }, [save]);

  useEffect(() => {
    let cancelled = false;
    if (!save.drawingDraftStore) {
      setInitialDraftUpdates([]);
      return;
    }
    void save.drawingDraftStore.load()
      .then((updates) => {
        if (!cancelled) setInitialDraftUpdates(updates);
      })
      .catch(() => {
        if (!cancelled) setInitialDraftUpdates([]);
      });
    return () => { cancelled = true; };
  }, [save.drawingDraftStore]);

  const drawingMode = useMemo(() => ({
    kind: "local" as const,
    persistSnapshot,
    draftStore: save.drawingDraftStore,
    initialUpdates: initialDraftUpdates ?? []
  }), [initialDraftUpdates, persistSnapshot, save.drawingDraftStore]);

  if (initialDraftUpdates === null) {
    return <div className="flex min-h-[320px] items-center justify-center text-sm font-medium text-white/40">טוען טיוטת ציור…</div>;
  }

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
        mode={drawingMode}
        mySeat="p1"
        myUserId="solo"
      />
    </div>
  );
}
