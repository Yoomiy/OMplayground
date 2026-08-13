import {
  breakoutMpModule,
  chessModule,
  connectfourModule,
  drawingModule,
  memoryModule,
  tictactoeModule,
  type AnyGameModule,
  type DrawingState,
  type TicTacToeState
} from "@playground/game-logic";
import {
  applyIntent,
  assignPlayer,
  canResumeGame,
  canStopGame,
  getOrCreateRoom,
  playersForRematch,
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

  it("preserves the original host when that host leaves a paused game", () => {
    const room = getOrCreateRoom("sess-paused-host", {
      gameId: "g1",
      gameKey: tictactoeModule.key,
      module: tictactoeModule,
      gender: "boy",
      hostId: "host-user",
      paused: true
    });
    assignPlayer(room, "host-user", "Host");
    assignPlayer(room, "guest-user", "Guest");

    const result = removePlayerFromRoom("sess-paused-host", "host-user");
    expect(result).toEqual({ roomEmpty: false });
    expect(room.hostId).toBe("host-user");
  });

  it("allows the paused host to resume with minPlayers, not the whole roster", () => {
    const room = getOrCreateRoom("sess-minimum-resume", {
      gameId: "g1",
      gameKey: tictactoeModule.key,
      module: tictactoeModule,
      gender: "boy",
      hostId: "host-user",
      minPlayers: 2,
      roster: [
        { userId: "host-user", displayName: "Host" },
        { userId: "guest-user", displayName: "Guest" },
        { userId: "absent-user", displayName: "Absent" }
      ],
      paused: true
    });
    assignPlayer(room, "host-user", "Host");
    expect(canResumeGame(room, "host-user").ok).toBe(false);

    assignPlayer(room, "guest-user", "Guest");
    expect(canResumeGame(room, "guest-user").ok).toBe(false);
    expect(canResumeGame(room, "host-user")).toEqual({ ok: true });
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

  it("adds late joiners into drawing seats when minPlayers is 1", () => {
    const room = getOrCreateRoom("sess-drawing-late-join", {
      gameId: "g-drawing",
      gameKey: drawingModule.key,
      module: drawingModule,
      gender: "boy",
      hostId: "a-user"
    });
    assignPlayer(room, "a-user", "A");
    assignPlayer(room, "b-user", "B");

    const state = room.state as DrawingState;
    expect(state.seats?.["a-user"]).toBe("p1");
    expect(state.seats?.["b-user"]).toBe("p2");

    const move = applyIntent(room, "b-user", {
      type: "CHECKPOINT",
      version: 1,
      elements: [],
      files: {}
    });
    expect(move.ok).toBe(true);
  });

  it("preserves drawing canvas elements when a new player joins", () => {
    const room = getOrCreateRoom("sess-drawing-preserve-canvas", {
      gameId: "g-drawing",
      gameKey: drawingModule.key,
      module: drawingModule,
      gender: "boy",
      hostId: "user-1"
    });
    assignPlayer(room, "user-1", "User 1");
    applyIntent(room, "user-1", {
      type: "CHECKPOINT",
      version: 1,
      elements: [{ id: "elem1", type: "rectangle" }],
      files: {}
    });

    assignPlayer(room, "user-2", "User 2");
    const state = room.state as DrawingState;
    expect(state.canvas.elements).toHaveLength(1);
    expect((state.canvas.elements[0] as any).id).toBe("elem1");
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

describe("rematch seat rotation", () => {
  const players = [
    { userId: "a-user", displayName: "A" },
    { userId: "b-user", displayName: "B" }
  ];

  const turnBasedModules: AnyGameModule[] = [
    chessModule as AnyGameModule,
    tictactoeModule as AnyGameModule,
    connectfourModule as AnyGameModule,
    memoryModule as AnyGameModule
  ];

  it.each(turnBasedModules)(
    "rotates starting roles for %s",
    (module) => {
      const room = getOrCreateRoom(`sess-rematch-${module.key}`, {
        gameId: "g1",
        gameKey: module.key,
        module,
        gender: "boy",
        hostId: "a-user"
      });
      assignPlayer(room, "a-user", "A");
      assignPlayer(room, "b-user", "B");

      expect(playersForRematch(room)).toEqual([...players].reverse());
    }
  );

  it("does not rotate roles for real-time Breakout", () => {
    const room = getOrCreateRoom("sess-rematch-breakout", {
      gameId: "g1",
      gameKey: breakoutMpModule.key,
      module: breakoutMpModule,
      gender: "boy",
      hostId: "a-user"
    });
    assignPlayer(room, "a-user", "A");
    assignPlayer(room, "b-user", "B");

    expect(playersForRematch(room)).toEqual(players);
  });
});
