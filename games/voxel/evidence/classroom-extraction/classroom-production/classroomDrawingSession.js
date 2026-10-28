"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classroomDrawingSessionInsert = classroomDrawingSessionInsert;
exports.isPostgresUniqueViolation = isPostgresUniqueViolation;
function classroomDrawingSessionInsert(classroom, gameId) {
    return {
        game_id: gameId,
        classroom_id: classroom.id,
        host_id: classroom.teacher_id,
        host_name: classroom.teacher_name || "לוח כיתה",
        player_ids: [],
        player_names: [],
        status: "playing",
        is_open: true,
        invitation_code: `class-draw-${classroom.room_code}`,
        gender: "all",
    };
}
function isPostgresUniqueViolation(error) {
    return Boolean(error &&
        typeof error === "object" &&
        error.code === "23505");
}
//# sourceMappingURL=classroomDrawingSession.js.map