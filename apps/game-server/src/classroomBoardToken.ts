import { createHmac, timingSafeEqual } from "crypto";

const CLASSROOM_BOARD_TOKEN_ROLES = [
  "kid",
  "student",
  "teacher",
  "admin",
  "classroom_delegate"
] as const;

export type ClassroomBoardTokenRole = (typeof CLASSROOM_BOARD_TOKEN_ROLES)[number];

export interface ClassroomBoardTokenPayload {
  classroomId: string;
  roomCode: string;
  identity: string;
  displayName: string;
  role: ClassroomBoardTokenRole;
  isHost: boolean;
  exp: number;
}

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(`classroom-board.${payload}`).digest("base64url");
}

export function verifyClassroomBoardToken(
  token: string,
  secret: string
): ClassroomBoardTokenPayload | null {
  const [encoded, suppliedSignature] = token.split(".", 2);
  if (!encoded || !suppliedSignature) return null;
  const expected = signature(encoded, secret);
  if (suppliedSignature.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(suppliedSignature), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (
      typeof payload.classroomId !== "string" ||
      typeof payload.roomCode !== "string" ||
      typeof payload.identity !== "string" ||
      typeof payload.displayName !== "string" ||
      !CLASSROOM_BOARD_TOKEN_ROLES.includes(payload.role) ||
      typeof payload.isHost !== "boolean" ||
      typeof payload.exp !== "number" ||
      payload.classroomId.length > 128 ||
      payload.roomCode.length > 64 ||
      payload.identity.length > 160 ||
      payload.displayName.length > 80 ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload as ClassroomBoardTokenPayload;
  } catch {
    return null;
  }
}

export function shouldEnforceRecessForSocket(
  role: string,
  capability: ClassroomBoardTokenPayload | null
): boolean {
  return role === "kid" && capability === null;
}

export function matchesClassroomBoardCapability(
  capability: ClassroomBoardTokenPayload | undefined,
  classroom: { classroomId: string; roomCode: string },
  identity: string
): boolean {
  return Boolean(
    capability &&
    capability.classroomId === classroom.classroomId &&
    capability.roomCode === classroom.roomCode &&
    capability.identity === identity
  );
}
