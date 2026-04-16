import {
  applyTicTacToeIntent,
  initialTicTacToeState,
  type TicTacToeState
} from "./tictactoe";

describe("TicTacToe rules", () => {
  it("declares winner on diagonal 0-4-8", () => {
    let s: TicTacToeState = initialTicTacToeState();
    const moves: [number, "X" | "O"][] = [
      [0, "X"],
      [1, "O"],
      [4, "X"],
      [2, "O"],
      [8, "X"]
    ];
    for (const [cell, player] of moves) {
      const r = applyTicTacToeIntent(s, {
        type: "MOVE",
        cellIndex: cell,
        player
      });
      expect(r.error).toBeUndefined();
      s = r.state;
    }
    expect(s.status).toBe("won");
    expect(s.winner).toBe("X");
    expect(s.winningLine).toEqual([0, 4, 8]);
  });

  it("returns draw when board is full and there is no winner", () => {
    let s = initialTicTacToeState();
    const seq: [number, "X" | "O"][] = [
      [0, "X"],
      [1, "O"],
      [2, "X"],
      [4, "O"],
      [3, "X"],
      [5, "O"],
      [7, "X"],
      [6, "O"],
      [8, "X"]
    ];
    for (const [cell, player] of seq) {
      const r = applyTicTacToeIntent(s, { type: "MOVE", cellIndex: cell, player });
      expect(r.error).toBeUndefined();
      s = r.state;
    }
    expect(s.status).toBe("draw");
  });

  it("rejects wrong player", () => {
    const s = initialTicTacToeState();
    const r = applyTicTacToeIntent(s, {
      type: "MOVE",
      cellIndex: 0,
      player: "O"
    });
    expect(r.error?.code).toBe("WRONG_PLAYER");
  });
});
