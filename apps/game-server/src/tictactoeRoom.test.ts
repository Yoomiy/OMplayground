import { tictactoeModule } from "@playground/game-logic";
import {
  applyIntent,
  assignPlayer,
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
});
