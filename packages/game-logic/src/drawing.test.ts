import { drawingModule, MAX_STROKES, type DrawingState } from "./drawing";

const P1 = { userId: "u1", displayName: "A" };
const P2 = { userId: "u2", displayName: "B" };

const VALID_STROKE = {
  color: "#ffffff",
  width: 3,
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 10 }
  ]
};

function init() {
  return drawingModule.initialState([P1, P2]) as DrawingState;
}

describe("Drawing rules", () => {
  it("starts with no strokes and seats players", () => {
    const s = init();
    expect(s.drawings).toEqual([]);
    expect(s.seats?.[P1.userId]).toBe("p1");
    expect(s.seats?.[P2.userId]).toBe("p2");
    expect(drawingModule.isTerminal(s)).toBe(false);
  });

  it("accepts ADD_STROKE from any player", () => {
    let s = init();
    const r = drawingModule.applyIntent(s, P2.userId, {
      type: "ADD_STROKE",
      stroke: VALID_STROKE
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    s = r.state as DrawingState;
    expect(s.drawings.length).toBe(1);
    expect(s.drawings[0].points.length).toBe(2);
  });

  it("rejects invalid stroke shape and color", () => {
    const s = init();
    const noPoints = drawingModule.applyIntent(s, P1.userId, {
      type: "ADD_STROKE",
      stroke: { color: "#fff", width: 3, points: [] }
    });
    expect(noPoints.ok).toBe(false);

    const badColor = drawingModule.applyIntent(s, P1.userId, {
      type: "ADD_STROKE",
      stroke: { color: "red", width: 3, points: VALID_STROKE.points }
    });
    expect(badColor.ok).toBe(false);
    if (!badColor.ok) expect(badColor.error.code).toBe("BAD_INTENT");

    const badWidth = drawingModule.applyIntent(s, P1.userId, {
      type: "ADD_STROKE",
      stroke: { color: "#fff", width: 999, points: VALID_STROKE.points }
    });
    expect(badWidth.ok).toBe(false);
  });

  it("CLEAR is host-only (seat p1)", () => {
    const s = init();
    const byGuest = drawingModule.applyIntent(s, P2.userId, { type: "CLEAR" });
    expect(byGuest.ok).toBe(false);
    if (!byGuest.ok) expect(byGuest.error.code).toBe("HOST_ONLY");

    const byHost = drawingModule.applyIntent(s, P1.userId, { type: "CLEAR" });
    expect(byHost.ok).toBe(true);
  });

  it("rejects non-player entirely", () => {
    const s = init();
    const r = drawingModule.applyIntent(s, "stranger", {
      type: "ADD_STROKE",
      stroke: VALID_STROKE
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_IN_ROOM");
  });

  it("caps drawings at MAX_STROKES (drops oldest)", () => {
    let s = init();
    for (let i = 0; i < MAX_STROKES + 5; i += 1) {
      const r = drawingModule.applyIntent(s, P1.userId, {
        type: "ADD_STROKE",
        stroke: {
          ...VALID_STROKE,
          points: [
            { x: i, y: 0 },
            { x: i + 1, y: 1 }
          ]
        }
      });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      s = r.state as DrawingState;
    }
    expect(s.drawings.length).toBe(MAX_STROKES);
    // oldest were dropped — first remaining stroke's x should be >=5
    expect(s.drawings[0].points[0].x).toBeGreaterThanOrEqual(5);
  });
});
