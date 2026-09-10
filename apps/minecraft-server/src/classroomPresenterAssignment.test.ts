import {
  commitPresenterAssignment,
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
