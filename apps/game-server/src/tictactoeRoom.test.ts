import { tictactoeModule } from "@playground/game-logic";
import {
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
});
