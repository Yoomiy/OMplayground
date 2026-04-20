import { tictactoeModule } from "@playground/game-logic";
import {
  assignPlayer,
  attachSpectator,
  getOrCreateRoom,
  removePlayerFromRoom,
  removeSpectatorFromRoom
} from "./room";

describe("teacher spectators (same-gender observers, not players)", () => {
  it("keeps the room in memory when the last player leaves but a spectator remains", () => {
    const sessionId = "sess-spec-1";
    const room = getOrCreateRoom(sessionId, {
      gameId: "g1",
      gameKey: tictactoeModule.key,
      module: tictactoeModule,
      gender: "boy",
      hostId: "host-user"
    });
    assignPlayer(room, "host-user", "Host");
    attachSpectator(room, "teacher-1", "Teacher");

    const result = removePlayerFromRoom(sessionId, "host-user");
    expect(result.roomEmpty).toBe(true);
    const r2 = getOrCreateRoom(sessionId, {
      gameId: "g1",
      gameKey: tictactoeModule.key,
      module: tictactoeModule,
      gender: "boy",
      hostId: "host-user"
    });
    expect(r2.spectators.size).toBe(1);
    removeSpectatorFromRoom(sessionId, "teacher-1");
    expect(getOrCreateRoom(sessionId, {
      gameId: "g1",
      gameKey: tictactoeModule.key,
      module: tictactoeModule,
      gender: "boy",
      hostId: "host-user"
    }).players.size).toBe(0);
  });

  it("deletes the room when both players and spectators are gone", () => {
    const sessionId = "sess-spec-2";
    const room = getOrCreateRoom(sessionId, {
      gameId: "g1",
      gameKey: tictactoeModule.key,
      module: tictactoeModule,
      gender: "girl",
      hostId: "h"
    });
    assignPlayer(room, "h", "H");
    removePlayerFromRoom(sessionId, "h");
    const r2 = getOrCreateRoom(sessionId, {
      gameId: "g1",
      gameKey: tictactoeModule.key,
      module: tictactoeModule,
      gender: "girl",
      hostId: "h"
    });
    expect(r2.players.size).toBe(0);
  });
});
