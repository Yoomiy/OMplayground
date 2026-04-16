import jwt from "jsonwebtoken";

export interface VerifiedUser {
  sub: string;
  email?: string;
  role?: string;
}

export function verifySupabaseJwt(
  token: string,
  secret: string
): VerifiedUser {
  const decoded = jwt.verify(token, secret, {
    algorithms: ["HS256"]
  });
  if (typeof decoded === "string" || !decoded || typeof decoded !== "object") {
    throw new Error("Invalid token payload");
  }
  const sub = (decoded as jwt.JwtPayload).sub;
  if (!sub || typeof sub !== "string") {
    throw new Error("Missing sub");
  }
  return {
    sub,
    email: (decoded as jwt.JwtPayload).email as string | undefined,
    role: (decoded as jwt.JwtPayload).role as string | undefined
  };
}
