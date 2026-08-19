import { createHmac } from "crypto";
import {
  matchesClassroomBoardCapability,
  shouldEnforceRecessForSocket,
  verifyClassroomBoardToken
} from "./classroomBoardToken";

describe("classroom board capability verification", () => {
  const secret = "service-role-secret";
  const payload = {
    classroomId: "0d6f48a0-3af0-4145-8462-21a8c97f4ef5",
    roomCode: "weekly-teacher",
    identity: "kid-1",
    displayName: "Student",
    role: "kid",
    isHost: false,
    exp: Math.floor(Date.now() / 1000) + 60
  };

  function sign(value: Record<string, unknown>): string {
    const encoded = Buffer.from(JSON.stringify(value)).toString("base64url");
    const signature = createHmac("sha256", secret)
      .update(`classroom-board.${encoded}`)
      .digest("base64url");
    return `${encoded}.${signature}`;
  }

  it("accepts a valid cross-service capability", () => {
    expect(verifyClassroomBoardToken(sign(payload), secret)).toMatchObject(payload);
  });

  it("rejects an unknown role", () => {
    expect(verifyClassroomBoardToken(sign({ ...payload, role: "owner" }), secret)).toBeNull();
  });

  it("rejects an expired capability", () => {
    expect(verifyClassroomBoardToken(sign({ ...payload, exp: 1 }), secret)).toBeNull();
  });

  it("keeps recess enforcement for ordinary kid sockets only", () => {
    const capability = verifyClassroomBoardToken(sign(payload), secret);
    expect(capability).not.toBeNull();
    expect(shouldEnforceRecessForSocket("kid", null)).toBe(true);
    expect(shouldEnforceRecessForSocket("kid", capability)).toBe(false);
    expect(shouldEnforceRecessForSocket("teacher", null)).toBe(false);
  });

  it("matches a capability only to its classroom and identity", () => {
    const capability = verifyClassroomBoardToken(sign(payload), secret) ?? undefined;
    expect(matchesClassroomBoardCapability(capability, {
      classroomId: payload.classroomId,
      roomCode: payload.roomCode
    }, payload.identity)).toBe(true);
    expect(matchesClassroomBoardCapability(capability, {
      classroomId: payload.classroomId,
      roomCode: "another-room"
    }, payload.identity)).toBe(false);
    expect(matchesClassroomBoardCapability(capability, {
      classroomId: payload.classroomId,
      roomCode: payload.roomCode
    }, "another-kid")).toBe(false);
  });
});
