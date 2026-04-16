import jwt from "jsonwebtoken";
import { verifySupabaseJwt } from "./verifySupabaseJwt";

describe("verifySupabaseJwt", () => {
  it("returns sub from a valid HS256 token", () => {
    const secret = "unit-test-secret";
    const token = jwt.sign(
      { sub: "11111111-1111-1111-1111-111111111111", role: "authenticated" },
      secret,
      { algorithm: "HS256" }
    );
    const v = verifySupabaseJwt(token, secret);
    expect(v.sub).toBe("11111111-1111-1111-1111-111111111111");
  });
});
