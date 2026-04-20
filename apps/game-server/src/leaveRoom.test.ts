import { tictactoeModule } from "@playground/game-logic";
import { persistPlayerLeave } from "./sessionPersistence";
import {
  assignPlayer,
  getOrCreateRoom,
  removePlayerFromRoom
} from "./room";

/**
 * Layer 2 — LEAVE_ROOM intent must trigger the same persistence + host
 * transfer as a raw disconnect. We cover both legs:
 *   - host leaves with another player still connected -> write host_id
 *   - last player leaves -> write status='paused'
 */
describe("LEAVE_ROOM persistence (mirrors disconnect)", () => {
  function makeMockSupabase() {
    const eqGs = jest.fn().mockResolvedValue({ data: null, error: null });
    const updateGs = jest.fn().mockReturnValue({ eq: eqGs });
    const maybeSingleKp = jest
      .fn()
      .mockResolvedValue({ data: { grade: 4 }, error: null });
    const eqKp = jest.fn().mockReturnValue({ maybeSingle: maybeSingleKp });
    const selectKp = jest.fn().mockReturnValue({ eq: eqKp });
    const from = jest.fn((table: string) => {
      if (table === "kid_profiles") {
        return { select: selectKp };
      }
      return { update: updateGs };
    });
    return {
      supabase: { from } as unknown as Parameters<
        typeof persistPlayerLeave
      >[0]["supabase"],
      from,
      updateGs,
      eqGs,
      selectKp,
      eqKp,
      maybeSingleKp
    };
  }

  it("writes the new host_id when the host leaves with others remaining", async () => {
    const sessionId = "sess-leave-1";
    const room = getOrCreateRoom(sessionId, {
      gameId: "g1",
      gameKey: tictactoeModule.key,
      module: tictactoeModule,
      gender: "boy",
      hostId: "host-user"
    });
    assignPlayer(room, "host-user", "Host");
    assignPlayer(room, "guest-user", "Guest");

    const result = removePlayerFromRoom(sessionId, "host-user");
    expect(result.newHostId).toBe("guest-user");
    expect(result.roomEmpty).toBe(false);

    const m = makeMockSupabase();
    await persistPlayerLeave({ supabase: m.supabase, sessionId, result });

    expect(m.from).toHaveBeenCalledWith("kid_profiles");
    expect(m.selectKp).toHaveBeenCalledWith("grade");
    expect(m.from).toHaveBeenCalledWith("game_sessions");
    expect(m.updateGs).toHaveBeenCalledTimes(1);
    const payload = m.updateGs.mock.calls[0][0] as {
      host_id: string;
      host_grade: number;
    };
    expect(payload.host_id).toBe("guest-user");
    expect(payload.host_grade).toBe(4);
    expect(m.eqGs).toHaveBeenCalledWith("id", sessionId);
  });

  it("writes status='paused' when the last player leaves", async () => {
    const sessionId = "sess-leave-2";
    const room = getOrCreateRoom(sessionId, {
      gameId: "g1",
      gameKey: tictactoeModule.key,
      module: tictactoeModule,
      gender: "girl",
      hostId: "solo-user"
    });
    assignPlayer(room, "solo-user", "Solo");
    const result = removePlayerFromRoom(sessionId, "solo-user");
    expect(result.roomEmpty).toBe(true);

    const m = makeMockSupabase();
    await persistPlayerLeave({ supabase: m.supabase, sessionId, result });

    expect(m.updateGs).toHaveBeenCalledTimes(1);
    const payload = m.updateGs.mock.calls[0][0] as { status: string };
    expect(payload.status).toBe("paused");
  });
});
