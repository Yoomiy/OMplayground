import { useState } from "react";
import type { DrawingState, DrawingStroke } from "@playground/game-logic";
import { DrawingBoard } from "@/games/DrawingBoard";
import { useSoloAutoSave } from "@/hooks/useSoloAutoSave";
import {
  isJsonObject,
  type JsonValue,
  type SoloGameSaveControls
} from "@/lib/soloGameSaves";

/**
 * Solo drawing = same dumb board, local state instead of server snapshots.
 * No socket, no catalog row required (routed by key via /solo/drawing).
 */
export function DrawingSolo({ save }: { save: SoloGameSaveControls }) {
  const [gameState, setGameState] = useState<DrawingState>(() => {
    if (isJsonObject(save.savedState) && Array.isArray(save.savedState.drawings)) {
      return {
        drawings: save.savedState.drawings as unknown as DrawingStroke[],
        status: "playing",
        seats: { solo: "p1" }
      };
    }
    return {
      drawings: [],
      status: "playing",
      seats: { solo: "p1" }
    };
  });
  useSoloAutoSave(save, gameState as unknown as JsonValue);

  const handleIntent = (
    intent: { type: "ADD_STROKE"; stroke: DrawingStroke } | { type: "CLEAR" }
  ) => {
    setGameState((s) => {
      if (intent.type === "CLEAR") return { ...s, drawings: [] };
      const drawings = [...s.drawings, intent.stroke];
      return {
        ...s,
        drawings: drawings.length > 500 ? drawings.slice(-500) : drawings
      };
    });
  };

  return (
    <DrawingBoard
      gameState={gameState}
      mySeat="p1"
      onIntent={handleIntent}
    />
  );
}
