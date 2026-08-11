import { createPresenterCapability, readPresenterCapability } from "./classroomPresentation";

describe("classroom presentation capabilities", () => {
  it("round-trips a scoped presenter capability", () => {
    const token = createPresenterCapability("abc", "teacher-1", 3, "secret", 60);
    expect(readPresenterCapability(token, "secret")).toMatchObject({ roomCode: "abc", identity: "teacher-1", epoch: 3 });
  });

  it("rejects tampering and the wrong secret", () => {
    const token = createPresenterCapability("abc", "teacher-1", 3, "secret", 60);
    expect(readPresenterCapability(`${token}x`, "secret")).toBeNull();
    expect(readPresenterCapability(token, "different")).toBeNull();
  });
});
