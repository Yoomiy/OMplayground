import type { ClassroomDrawingSocketSync } from "./classroomDrawingState";

export {};

declare module "socket.io" {
  interface SocketData {
    userId?: string;
    displayName?: string;
    role?: string;
    gender?: "boy" | "girl";
    sessionId?: string;
    classroomDrawingSync?: ClassroomDrawingSocketSync;
    classroomDrawingAwarenessClientIds?: number[];
    classroomDrawing?: {
      sessionId: string;
      classroomId: string;
      roomCode: string;
      isHost: boolean;
    };
  }
}
