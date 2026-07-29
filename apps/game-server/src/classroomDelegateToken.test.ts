import { createHmac } from "crypto";
import { verifyClassroomDelegateGameToken } from "./classroomDelegateToken";

describe("classroom delegate game capability verification", () => {
  const secret = "service-role-secret";
  const payload = {
    delegateId: "63c6a0a7-b1e2-4b86-b13e-657c854cf9e4",
    classroomId: "0d6f48a0-3af0-4145-8462-21a8c97f4ef5",
    roomCode: "weekly-teacher",
    identity: "delegate:63c6a0a7-b1e2-4b86-b13e-657c854cf9e4",
    exp: Math.floor(Date.now() / 1000) + 60
  };

  function sign(value: Record<string, unknown>): string {
    const encoded = Buffer.from(JSON.stringify(value)).toString("base64url");
    const signature = createHmac("sha256", secret)
      .update(`classroom-delegate.${encoded}`)
      .digest("base64url");
    return `${encoded}.${signature}`;
  }

  it("accepts a valid cross-service capability", () => {
    expect(verifyClassroomDelegateGameToken(sign(payload), secret)).toMatchObject(payload);
  });

  it("rejects a delegate identity that does not match the delegate id", () => {
    expect(
      verifyClassroomDelegateGameToken(sign({ ...payload, identity: "delegate:other" }), secret)
    ).toBeNull();
  });
});
