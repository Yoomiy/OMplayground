import { chessModule, initialChessState, applyChessIntent } from "@playground/game-logic";
import {
  applyIntent,
  assignPlayer,
  getOrCreateRoom,
  type Room
} from "./room";

function chessRoom(hostId = "host-user"): Room<unknown> {
  return getOrCreateRoom("sess-chess", {
    gameId: "g1",
    gameKey: "chess",
    module: chessModule,
    gender: "boy",
    hostId,
    roster: [
      { userId: hostId, displayName: "Host" },
      { userId: "guest-user", displayName: "Guest" }
    ]
  });
}

describe("chess room intents", () => {
  it("rejects set_time_control from non-host", () => {
    const room = chessRoom();
    assignPlayer(room, "host-user", "Host");
    assignPlayer(room, "guest-user", "Guest");
    room.state = chessModule.initialState([
      { userId: "host-user", displayName: "Host" },
      { userId: "guest-user", displayName: "Guest" }
    ]);

    const res = applyIntent(room, "guest-user", {
      type: "set_time_control",
      timeControl: { mode: "timed", initialMs: 60000 }
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("NOT_HOST");
    }
  });

  it("allows host to set time control before first move", () => {
    const room = chessRoom();
    assignPlayer(room, "host-user", "Host");
    assignPlayer(room, "guest-user", "Guest");
    room.state = chessModule.initialState([
      { userId: "host-user", displayName: "Host" },
      { userId: "guest-user", displayName: "Guest" }
    ]);

    const res = applyIntent(room, "host-user", {
      type: "set_time_control",
      timeControl: { mode: "timed", initialMs: 180000, incrementMs: 5000 }
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect((res.state as ReturnType<typeof initialChessState>).timeControl).toEqual({
        mode: "timed",
        initialMs: 180000,
        incrementMs: 5000
      });
    }
  });

  it("auto-expires clock on intent when time is up", () => {
    const room = chessRoom();
    assignPlayer(room, "host-user", "Host");
    assignPlayer(room, "guest-user", "Guest");
    let state = initialChessState({ mode: "timed", initialMs: 60000 });
    state.lastTickAt = Date.now() - 70000;
    state.seats = { "host-user": "w", "guest-user": "b" };
    room.state = state;

    const res = applyIntent(room, "guest-user", { type: "offer_draw" });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect((res.state as ReturnType<typeof initialChessState>).status).toBe("won");
      expect((res.state as ReturnType<typeof initialChessState>).timeoutWinner).toBe("b");
    }
  });

  it("swaps seat colors when player order is reversed on rematch", () => {
    const players = [
      { userId: "host-user", displayName: "Host" },
      { userId: "guest-user", displayName: "Guest" }
    ];
    const first = chessModule.initialState(players);
    const rematch = chessModule.initialState([...players].reverse());

    expect(first.seats?.["host-user"]).toBe("w");
    expect(first.seats?.["guest-user"]).toBe("b");
    expect(rematch.seats?.["host-user"]).toBe("b");
    expect(rematch.seats?.["guest-user"]).toBe("w");
  });
});
