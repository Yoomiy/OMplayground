export {};

declare module "socket.io" {
  interface SocketData {
    userId?: string;
    displayName?: string;
    role?: string;
    gender?: "boy" | "girl";
    sessionId?: string;
  }
}
