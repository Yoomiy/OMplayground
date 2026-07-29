import {
  createClassroomDelegateGameToken,
  verifyClassroomDelegateGameToken
} from "./classroomDelegates";

describe("classroom delegate game capability", () => {
  const secret = "service-role-secret";
  const capability = {
    delegateId: "63c6a0a7-b1e2-4b86-b13e-657c854cf9e4",
    classroomId: "0d6f48a0-3af0-4145-8462-21a8c97f4ef5",
    roomCode: "weekly-teacher",
    identity: "delegate:63c6a0a7-b1e2-4b86-b13e-657c854cf9e4"
  };

  it("accepts a fresh signed capability", () => {
    const token = createClassroomDelegateGameToken(capability, secret);
    expect(verifyClassroomDelegateGameToken(token, secret)).toMatchObject(capability);
  });

  it("rejects a modified capability", () => {
    const token = createClassroomDelegateGameToken(capability, secret);
    const [payload, signature] = token.split(".");
    expect(verifyClassroomDelegateGameToken(`${payload}x.${signature}`, secret)).toBeNull();
  });
});
