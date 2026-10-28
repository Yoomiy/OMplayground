import { describe, expect, it } from "vitest";
import { DIFFICULTY_LEVELS } from "./useStockfishEngine";

describe("chessEngine unit test", () => {
  it("defines the correct difficulty table as planned", () => {
    expect(DIFFICULTY_LEVELS[1]).toEqual({ label: "מתחיל", skillLevel: 0, depth: 1 });
    expect(DIFFICULTY_LEVELS[2]).toEqual({ label: "קל", skillLevel: 5, depth: 3 });
    expect(DIFFICULTY_LEVELS[3]).toEqual({ label: "בינוני", skillLevel: 10, depth: 6 });
    expect(DIFFICULTY_LEVELS[4]).toEqual({ label: "מתקדם", skillLevel: 15, depth: 10 });
    expect(DIFFICULTY_LEVELS[5]).toEqual({ label: "מומחה", skillLevel: 20, depth: 12 });
  });

  it("parses simulated bestmove lines correctly", () => {
    function parseBestMove(line: string) {
      if (line.startsWith("bestmove")) {
        const parts = line.split(" ");
        const moveStr = parts[1];
        if (moveStr && moveStr !== "(none)") {
          const from = moveStr.substring(0, 2);
          const to = moveStr.substring(2, 4);
          const rawPromo = moveStr.length > 4 ? moveStr.substring(4, 5) : undefined;
          
          let promotion: "q" | "r" | "b" | "n" | undefined = undefined;
          if (rawPromo === "q" || rawPromo === "r" || rawPromo === "b" || rawPromo === "n") {
            promotion = rawPromo;
          }
          return { from, to, promotion };
        }
      }
      return null;
    }

    expect(parseBestMove("bestmove e2e4")).toEqual({ from: "e2", to: "e4", promotion: undefined });
    expect(parseBestMove("bestmove e7e8q ponder d2d4")).toEqual({ from: "e7", to: "e8", promotion: "q" });
    expect(parseBestMove("bestmove a7a8n")).toEqual({ from: "a7", to: "a8", promotion: "n" });
    expect(parseBestMove("bestmove (none)")).toBeNull();
  });
});
