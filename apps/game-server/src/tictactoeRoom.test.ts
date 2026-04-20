import { tictactoeModule, type TicTacToeState } from "@playground/game-logic";
import {
  applyIntent,
  assignPlayer,
  canStopGame,
  getOrCreateRoom,
  removePlayerFromRoom
} from "./room";

describe("Room / host transfer", () => {
  it("transfers host to the remaining player when host disconnects", () => {
    const room = getOrCreateRoom("sess-1", {
      gameId: "g1",
      gameKey: tictactoeModule.key,
      module: tictactoeModule,
      gender: "boy",
      hostId: "host-user"
    });
    const a = assignPlayer(room, "host-user", "Host");
    const b = assignPlayer(room, "guest-user", "Guest");
    expect("error" in a).toBe(false);
    expect("error" in b).toBe(false);
    expect(room.hostId).toBe("host-user");

    const r = removePlayerFromRoom("sess-1", "host-user");
    expect(r.roomEmpty).toBe(false);
    expect(r.newHostId).toBe("guest-user");
    expect(room.hostId).toBe("guest-user");
  });

  it("does not reset game state when a player leaves and rejoins mid-game", () => {
    const room = getOrCreateRoom("sess-refresh", {
      gameId: "g1",
      gameKey: tictactoeModule.key,
      module: tictactoeModule,
      gender: "boy",
      hostId: "a-user"
    });
    assignPlayer(room, "a-user", "A");
    assignPlayer(room, "b-user", "B");
    const mid = applyIntent(room, "a-user", { cellIndex: 0 });
    if (!mid.ok) throw new Error("expected move to apply");
    const stateAfterMove = mid.state;

    removePlayerFromRoom("sess-refresh", "b-user");
    assignPlayer(room, "b-user", "B");

    expect(room.state).toEqual(stateAfterMove);
  });

  it("does not re-seed when creating a room from a paused DB snapshot", () => {
    const saved: TicTacToeState = {
      board: ["X", null, null, null, null, null, null, null, null],
      next: "O",
      status: "playing",
      winner: null,
      winningLine: null,
      seats: { "a-user": "X", "b-user": "O" }
    };
    const room = getOrCreateRoom("sess-resume", {
      gameId: "g1",
      gameKey: tictactoeModule.key,
      module: tictactoeModule,
      gender: "boy",
      hostId: "a-user",
      resumedState: saved
    });
    assignPlayer(room, "a-user", "A");
    assignPlayer(room, "b-user", "B");
    expect(room.state).toEqual(saved);
  });
});

/**
 * REMATCH composes canStopGame + isTerminal + initialState(seats); same
 * signal as STOP_GAME guard without duplicating Socket.io wiring (see stopGame.test.ts).
 */
describe("REMATCH room logic (tic-tac-toe)", () => {
  function winOnFirstRow(room: ReturnType<typeof getOrCreateRoom>) {
    const moves = [0, 4, 1, 5, 2];
    const players = ["a-user", "b-user"] as const;
    for (let i = 0; i < moves.length; i++) {
      const r = applyIntent(room, players[i % 2], { cellIndex: moves[i] });
      if (!r.ok) throw new Error(r.error.message);
    }
  }

  it("rejects rematch guard for non-host (NOT_HOST)", () => {
    const room = getOrCreateRoom("sess-rematch-guard", {
      gameId: "g1",
      gameKey: tictactoeModule.key,
      module: tictactoeModule,
      gender: "boy",
      hostId: "a-user"
    });
    assignPlayer(room, "a-user", "A");
    assignPlayer(room, "b-user", "B");
    winOnFirstRow(room);
    expect(tictactoeModule.isTerminal(room.state as TicTacToeState)).toBe(true);

    const res = canStopGame(room, "b-user");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("NOT_HOST");
  });

  it("is not terminal mid-game (socket would answer NOT_TERMINAL)", () => {
    const room = getOrCreateRoom("sess-rematch-mid", {
      gameId: "g1",
      gameKey: tictactoeModule.key,
      module: tictactoeModule,
      gender: "boy",
      hostId: "a-user"
    });
    assignPlayer(room, "a-user", "A");
    assignPlayer(room, "b-user", "B");
    const mid = applyIntent(room, "a-user", { cellIndex: 0 });
    if (!mid.ok) throw new Error("move");
    expect(tictactoeModule.isTerminal(room.state as TicTacToeState)).toBe(
      false
    );
  });

  it("resets to fresh initialState after terminal; hasBeenActive stays true; next move applies", () => {
    const room = getOrCreateRoom("sess-rematch-reset", {
      gameId: "g1",
      gameKey: tictactoeModule.key,
      module: tictactoeModule,
      gender: "boy",
      hostId: "a-user"
    });
    assignPlayer(room, "a-user", "A");
    assignPlayer(room, "b-user", "B");
    winOnFirstRow(room);
    expect(room.hasBeenActive).toBe(true);

    const seats = Array.from(room.players.values()).map((p) => ({
      userId: p.userId,
      displayName: p.displayName
    }));
    room.state = tictactoeModule.initialState(seats);

    const st = room.state as TicTacToeState;
    expect(st.status).toBe("playing");
    expect(st.winner).toBeNull();

    const move = applyIntent(room, "a-user", { cellIndex: 4 });
    if (!move.ok) throw new Error(move.error.message);
    expect((move.state as TicTacToeState).board.filter(Boolean).length).toBe(
      1
    );
  });
});
