import {
  classroomDrawingSessionInsert,
  isPostgresUniqueViolation
} from "./classroomDrawingSession";

describe("classroom drawing session ownership", () => {
  it("uses the teacher when the classroom has one", () => {
    expect(classroomDrawingSessionInsert({
      id: "classroom-1",
      room_code: "class-abc",
      teacher_id: "teacher-1",
      teacher_name: "Teacher"
    }, "drawing-game")).toMatchObject({
      classroom_id: "classroom-1",
      host_id: "teacher-1",
      player_ids: [],
      invitation_code: "class-draw-class-abc"
    });
  });

  it("creates admin classrooms as classroom-owned infrastructure without a fake kid host", () => {
    expect(classroomDrawingSessionInsert({
      id: "classroom-admin",
      room_code: "class-admin",
      teacher_id: null,
      teacher_name: "Admin"
    }, "drawing-game")).toMatchObject({
      classroom_id: "classroom-admin",
      host_id: null,
      host_name: "Admin"
    });
  });

  it("recognizes the unique-index race used for idempotent reselect", () => {
    expect(isPostgresUniqueViolation({ code: "23505" })).toBe(true);
    expect(isPostgresUniqueViolation({ code: "42501" })).toBe(false);
  });
});
