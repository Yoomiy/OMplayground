import { drawingModule, type DrawingState } from "./drawing";

const P1 = { userId: "u1", displayName: "A" };
const P2 = { userId: "u2", displayName: "B" };

function init() {
  return drawingModule.initialState([P1, P2]) as DrawingState;
}

describe("Drawing rules (Excalidraw)", () => {
  it("starts with empty canvas and seats players", () => {
    const s = init();
    expect(s.canvas.elements).toEqual([]);
    expect(s.canvas.files).toEqual({});
    expect(s.canvas.version).toBe(0);
    expect(s.seats?.[P1.userId]).toBe("p1");
    expect(s.seats?.[P2.userId]).toBe("p2");
    expect(drawingModule.isTerminal(s)).toBe(false);
  });

  it("accepts CHECKPOINT with newer version from any seated player", () => {
    let s = init();
    const r = drawingModule.applyIntent(s, P2.userId, {
      type: "CHECKPOINT",
      version: 1,
      elements: [{ id: "el1", type: "rectangle" }],
      files: {}
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    s = r.state as DrawingState;
    expect(s.canvas.version).toBe(1);
    expect(s.canvas.elements.length).toBe(1);
  });

  it("rejects stale version CHECKPOINT", () => {
    let s = init();
    // Advance version to 2
    const r1 = drawingModule.applyIntent(s, P1.userId, {
      type: "CHECKPOINT",
      version: 2,
      elements: [],
      files: {}
    });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    s = r1.state as DrawingState;

    // Send version 1 (stale)
    const r2 = drawingModule.applyIntent(s, P2.userId, {
      type: "CHECKPOINT",
      version: 1,
      elements: [],
      files: {}
    });
    expect(r2.ok).toBe(false);
    if (!r2.ok) {
      expect(r2.error.code).toBe("STALE_VERSION");
    }
  });

  it("rejects CHECKPOINT exceeding element limits", () => {
    const s = init();
    const tooManyElements = Array.from({ length: 5001 }, (_, i) => ({ id: `el${i}`, type: "point" }));
    const r = drawingModule.applyIntent(s, P1.userId, {
      type: "CHECKPOINT",
      version: 1,
      elements: tooManyElements,
      files: {}
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("BAD_CHECKPOINT");
    }
  });

  it("rejects CHECKPOINT with files exceeding byte size limits", () => {
    const s = init();
    const largeFileContent = "a".repeat(600 * 1024); // 600KB (limit is 512KB)
    const r = drawingModule.applyIntent(s, P1.userId, {
      type: "CHECKPOINT",
      version: 1,
      elements: [],
      files: {
        file1: largeFileContent
      }
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("BAD_CHECKPOINT");
    }
  });

  it("accepts CLEAR_CANVAS from any player and clears elements/files", () => {
    let s = init();
    // Setup some data
    const r1 = drawingModule.applyIntent(s, P1.userId, {
      type: "CHECKPOINT",
      version: 1,
      elements: [{ id: "el1" }],
      files: {}
    });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    s = r1.state as DrawingState;

    // Clear from P2
    const r2 = drawingModule.applyIntent(s, P2.userId, { type: "CLEAR_CANVAS" });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    s = r2.state as DrawingState;
    expect(s.canvas.elements).toEqual([]);
    expect(s.canvas.files).toEqual({});
    expect(s.canvas.version).toBe(2);
  });

  it("rejects intent from non-player stranger", () => {
    const s = init();
    const r = drawingModule.applyIntent(s, "stranger", {
      type: "CLEAR_CANVAS"
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("NOT_IN_ROOM");
    }
  });
});
