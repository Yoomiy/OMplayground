import { createHmac, timingSafeEqual } from "crypto";

export interface ClassroomDelegateGameTokenPayload {
  delegateId: string;
  classroomId: string;
  roomCode: string;
  identity: string;
  exp: number;
}

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(`classroom-delegate.${payload}`).digest("base64url");
}

export function verifyClassroomDelegateGameToken(
  token: string,
  secret: string
): ClassroomDelegateGameTokenPayload | null {
  const [encoded, suppliedSignature] = token.split(".", 2);
  if (!encoded || !suppliedSignature) return null;
  const expected = signature(encoded, secret);
  if (suppliedSignature.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(suppliedSignature), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (
      typeof payload.delegateId !== "string" ||
      typeof payload.classroomId !== "string" ||
      typeof payload.roomCode !== "string" ||
      typeof payload.identity !== "string" ||
      typeof payload.exp !== "number" ||
      payload.identity !== `delegate:${payload.delegateId}` ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload as ClassroomDelegateGameTokenPayload;
  } catch {
    return null;
  }
}
