import {
  commitPresenterAssignment,
  selectDefaultClassroomPresenter,
  shouldBootstrapClassroomPresenter,
  type PresentationRoomState
} from "./classroomPresenterAssignment";

const previous: PresentationRoomState = {
  presenterIdentity: null,
  presenterEpoch: 4,
  visible: true,
  title: "Lesson",
  mediaKind: "document"
};

function effects() {
  return {
    persist: jest.fn().mockResolvedValue(undefined),
    synchronizePermissions: jest.fn().mockResolvedValue(undefined),
    createCapability: jest.fn().mockReturnValue("capability"),
    broadcast: jest.fn().mockResolvedValue(undefined),
    sendCapability: jest.fn().mockResolvedValue(undefined)
  };
}

describe("commitPresenterAssignment", () => {
  it("persists admission bootstrap without contacting an unstarted LiveKit room", async () => {
    const assignmentEffects = effects();

    const next = await commitPresenterAssignment(
      previous,
      "teacher-1",
      false,
      "persist-only",
      assignmentEffects
    );

    expect(next).toEqual({
      presenterIdentity: "teacher-1",
      presenterEpoch: 5,
      visible: false,
      title: "Lesson",
      mediaKind: "document"
    });
    expect(assignmentEffects.persist).toHaveBeenCalledWith(next);
    expect(assignmentEffects.synchronizePermissions).not.toHaveBeenCalled();
    expect(assignmentEffects.createCapability).not.toHaveBeenCalled();
    expect(assignmentEffects.broadcast).not.toHaveBeenCalled();
    expect(assignmentEffects.sendCapability).not.toHaveBeenCalled();
  });

  it("keeps permission and data synchronization required for live handoffs", async () => {
    const assignmentEffects = effects();

    const next = await commitPresenterAssignment(
      previous,
      "student-1",
      true,
      "synchronize-room",
      assignmentEffects
    );

    expect(assignmentEffects.synchronizePermissions).toHaveBeenCalledWith(previous, next);
    expect(assignmentEffects.broadcast).toHaveBeenCalledWith(next);
    expect(assignmentEffects.sendCapability).toHaveBeenCalledWith(
      "student-1",
      "capability",
      next
    );
  });

  it("does not run room effects when required persistence fails", async () => {
    const assignmentEffects = effects();
    assignmentEffects.persist.mockRejectedValue(new Error("persistence failed"));

    await expect(commitPresenterAssignment(
      previous,
      "teacher-1",
      false,
      "synchronize-room",
      assignmentEffects
    )).rejects.toThrow("persistence failed");

    expect(assignmentEffects.synchronizePermissions).not.toHaveBeenCalled();
    expect(assignmentEffects.broadcast).not.toHaveBeenCalled();
    expect(assignmentEffects.sendCapability).not.toHaveBeenCalled();
  });
});

describe("shouldBootstrapClassroomPresenter", () => {
  it("selects the first visible host when the presenter slot is empty", () => {
    expect(shouldBootstrapClassroomPresenter(null, true, undefined)).toBe(true);
  });

  it("does not replace an existing presenter", () => {
    expect(shouldBootstrapClassroomPresenter("teacher-1", true, undefined)).toBe(false);
  });

  it("does not select students or invisible hosts", () => {
    expect(shouldBootstrapClassroomPresenter(null, false, undefined)).toBe(false);
    expect(shouldBootstrapClassroomPresenter(null, true, "invisible")).toBe(false);
  });
});

describe("selectDefaultClassroomPresenter", () => {
  const participants = [
    { identity: "student-1", isHost: false },
    { identity: "cohost-1", isHost: true },
    { identity: "creator-1", isHost: true }
  ];

  it("prefers the connected classroom creator", () => {
    expect(selectDefaultClassroomPresenter(participants, "creator-1")).toBe("creator-1");
  });

  it("falls back to the first connected host", () => {
    expect(selectDefaultClassroomPresenter(participants, "missing-creator")).toBe("cohost-1");
  });

  it("excludes a departing presenter and returns null without another host", () => {
    expect(selectDefaultClassroomPresenter(participants, "creator-1", "creator-1")).toBe("cohost-1");
    expect(selectDefaultClassroomPresenter([
      { identity: "student-1", isHost: false },
      { identity: "creator-1", isHost: true }
    ], "creator-1", "creator-1")).toBeNull();
  });
});
