import { persistDrawingCheckpoint } from "./sessionPersistence";

describe("persistDrawingCheckpoint", () => {
  it("persists the authoritative drawing state without changing the active session status", async () => {
    const inStatus = jest.fn().mockResolvedValue({ data: null, error: null });
    const eqId = jest.fn().mockReturnValue({ in: inStatus });
    const update = jest.fn().mockReturnValue({ eq: eqId });
    const from = jest.fn().mockReturnValue({ update });
    const supabase = { from } as unknown as Parameters<typeof persistDrawingCheckpoint>[0];
    const state = {
      status: "playing",
      canvas: { engine: "excalidraw", version: 4, clearVersion: 1, elements: [], files: {} }
    };

    await persistDrawingCheckpoint(supabase, "classroom-draw-session", state);

    expect(from).toHaveBeenCalledWith("game_sessions");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ game_state: state, last_activity: expect.any(String) })
    );
    expect(eqId).toHaveBeenCalledWith("id", "classroom-draw-session");
    expect(inStatus).toHaveBeenCalledWith("status", ["waiting", "playing", "paused"]);
  });
});
