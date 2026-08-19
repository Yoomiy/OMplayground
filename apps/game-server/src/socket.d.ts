import type { CanonicalDrawingSocketSync } from "./canonicalDrawingState";
import type { ClassroomBoardTokenPayload } from "./classroomBoardToken";

export {};

declare module "socket.io" {
  interface SocketData {
    userId?: string;
    displayName?: string;
    role?: string;
    gender?: "boy" | "girl";
    sessionId?: string;
    canonicalDrawingSync?: CanonicalDrawingSocketSync;
    canonicalDrawingAwarenessClientIds?: number[];
    classroomBoardCapability?: ClassroomBoardTokenPayload;
    classroomDrawing?: {
      sessionId: string;
      classroomId: string;
      roomCode: string;
      isHost: boolean;
    };
  }
}
