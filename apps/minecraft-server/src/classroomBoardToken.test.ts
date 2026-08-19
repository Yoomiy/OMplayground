import {
  createClassroomBoardToken,
  verifyClassroomBoardToken
} from "./classroomBoardToken";

describe("classroom board capability", () => {
  const secret = "service-role-secret";
  const capability = {
    classroomId: "0d6f48a0-3af0-4145-8462-21a8c97f4ef5",
    roomCode: "weekly-teacher",
    identity: "kid-1",
    displayName: "Student",
    role: "kid" as const,
    isHost: false
  };

  it("accepts a fresh signed capability", () => {
    const token = createClassroomBoardToken(capability, secret);
    expect(verifyClassroomBoardToken(token, secret)).toMatchObject(capability);
  });

  it("rejects a modified capability", () => {
    const token = createClassroomBoardToken(capability, secret);
    const [payload, signature] = token.split(".");
    expect(verifyClassroomBoardToken(`${payload}x.${signature}`, secret)).toBeNull();
  });

  it("rejects an expired capability", () => {
    const token = createClassroomBoardToken(capability, secret, -1);
    expect(verifyClassroomBoardToken(token, secret)).toBeNull();
  });
});
