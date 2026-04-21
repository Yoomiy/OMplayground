import { useState } from "react";
import type { DrawingState, DrawingStroke } from "@playground/game-logic";
import { DrawingBoard } from "@/games/DrawingBoard";

/**
 * Solo drawing = same dumb board, local state instead of server snapshots.
 * No socket, no catalog row required (routed by key via /solo/drawing).
 */
export function DrawingSolo() {
  const [gameState, setGameState] = useState<DrawingState>({
    drawings: [],
    status: "playing",
    seats: { solo: "p1" }
  });

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
