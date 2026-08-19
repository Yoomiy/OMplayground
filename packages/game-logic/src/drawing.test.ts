import { drawingModule, type DrawingState } from "./drawing";

const P1 = { userId: "u1", displayName: "A" };
const P2 = { userId: "u2", displayName: "B" };

function init() {
  return drawingModule.initialState([P1, P2]) as DrawingState;
}

describe("Drawing rules (Excalidraw)", () => {
  it("starts with an empty recovery snapshot and seats players", () => {
    const state = init();
    expect(state.canvas.elements).toEqual([]);
    expect(state.canvas.files).toEqual({});
    expect(state.canvas.version).toBe(0);
    expect(state.canvas.clearVersion).toBe(0);
    expect(state.seats?.[P1.userId]).toBe("p1");
    expect(state.seats?.[P2.userId]).toBe("p2");
  });

  it("accepts CLEAR_CANVAS from a seated player", () => {
    const state: DrawingState = {
      ...init(),
      canvas: {
        engine: "excalidraw",
        version: 4,
        clearVersion: 1,
        updatedAt: 1,
        elements: [{ id: "el1" }],
        files: { image: { id: "image" } }
      }
    };

    const result = drawingModule.applyIntent(state, P2.userId, { type: "CLEAR_CANVAS" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.state as DrawingState).canvas).toMatchObject({
      version: 5,
      clearVersion: 2,
      elements: [],
      files: {}
    });
  });

  it("rejects an intent from a non-player", () => {
    const result = drawingModule.applyIntent(init(), "stranger", { type: "CLEAR_CANVAS" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_IN_ROOM");
  });

  it("rejects obsolete checkpoint intents", () => {
    const result = drawingModule.applyIntent(
      init(),
      P1.userId,
      { type: "CHECKPOINT" } as never
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("BAD_INTENT");
  });
});
