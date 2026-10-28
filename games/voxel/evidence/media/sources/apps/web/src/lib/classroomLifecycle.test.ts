import { describe, expect, it } from "vitest";
import { shouldPublishClassroomMaterial } from "./classroomLifecycle";

describe("classroom collaboration lifecycle", () => {
  it("publishes a material only after that exact material finishes preparation", () => {
    const readyState = {
      canPresent: true,
      visible: true,
      isPublished: false,
      isPreparing: false,
      selectedMaterialId: "slides-2",
      preparedMaterialId: "slides-2"
    };

    expect(shouldPublishClassroomMaterial({ ...readyState, isPreparing: true })).toBe(false);
    expect(shouldPublishClassroomMaterial({ ...readyState, preparedMaterialId: null })).toBe(false);
    expect(shouldPublishClassroomMaterial({ ...readyState, preparedMaterialId: "slides-1" })).toBe(false);
    expect(shouldPublishClassroomMaterial(readyState)).toBe(true);
  });
});
