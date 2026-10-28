"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLASSROOM_BOARD_TOKEN_ROLES = void 0;
exports.createClassroomBoardToken = createClassroomBoardToken;
exports.verifyClassroomBoardToken = verifyClassroomBoardToken;
const crypto_1 = require("crypto");
exports.CLASSROOM_BOARD_TOKEN_ROLES = [
    "kid",
    "student",
    "teacher",
    "admin",
    "classroom_delegate",
];
function signature(payload, secret) {
    return (0, crypto_1.createHmac)("sha256", secret)
        .update(`classroom-board.${payload}`)
        .digest("base64url");
}
function createClassroomBoardToken(payload, secret, expiresInSeconds = 4 * 60 * 60) {
    const encoded = Buffer.from(JSON.stringify({
        ...payload,
        exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    })).toString("base64url");
    return `${encoded}.${signature(encoded, secret)}`;
}
function verifyClassroomBoardToken(token, secret) {
    const [encoded, suppliedSignature] = token.split(".", 2);
    if (!encoded || !suppliedSignature)
        return null;
    const expected = signature(encoded, secret);
    if (suppliedSignature.length !== expected.length)
        return null;
    if (!(0, crypto_1.timingSafeEqual)(Buffer.from(suppliedSignature), Buffer.from(expected)))
        return null;
    try {
        const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
        if (typeof payload.classroomId !== "string" ||
            typeof payload.roomCode !== "string" ||
            typeof payload.identity !== "string" ||
            typeof payload.participantKey !== "string" ||
            typeof payload.displayName !== "string" ||
            !exports.CLASSROOM_BOARD_TOKEN_ROLES.includes(payload.role) ||
            typeof payload.isHost !== "boolean" ||
            typeof payload.exp !== "number" ||
            payload.classroomId.length > 128 ||
            payload.roomCode.length > 64 ||
            payload.identity.length > 160 ||
            payload.participantKey.length > 256 ||
            payload.displayName.length > 80 ||
            payload.exp <= Math.floor(Date.now() / 1000)) {
            return null;
        }
        return payload;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=classroomBoardToken.js.map