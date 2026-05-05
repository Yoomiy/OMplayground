import { createServer } from "node:http";
import { Server } from "socket.io";
import { io as ioc, type Socket as ClientSocket } from "socket.io-client";

/**
 * Layer 3 — verifies the user's "rooms separation" requirement at the
 * Socket.IO room level: BLOCK_DELTA / ROOM_SNAPSHOT emitted to one
 * voxel:${sessionId} room never leaks to a socket joined to a different
 * sessionId.
 *
 * This stays at the transport layer (no full auth/Supabase stack); the
 * higher-level guarantee that handlers route through `voxel:${sessionId}`
 * is enforced by the index.ts code path itself.
 */
describe("voxel room isolation", () => {
  it("BLOCK_DELTA and ROOM_SNAPSHOT do not cross sessions", (done) => {
    const httpServer = createServer();
    const io = new Server(httpServer);

    io.on("connection", (socket) => {
      socket.on("join", (room: string) => {
        void socket.join(room);
      });
      socket.on("placeBlock", (room: string) => {
        io.to(room).emit("BLOCK_DELTA", { pos: [0, 0, 0], blockId: 1, by: "u" });
      });
      socket.on("snapshot", (room: string) => {
        io.to(room).emit("ROOM_SNAPSHOT", { players: {} });
      });
    });

    httpServer.listen(0, () => {
      const { port } = httpServer.address() as { port: number };
      const url = `http://127.0.0.1:${port}`;

      const aHost: ClientSocket = ioc(url, { transports: ["websocket"] });
      const aGuest: ClientSocket = ioc(url, { transports: ["websocket"] });
      const b: ClientSocket = ioc(url, { transports: ["websocket"] });

      let aGuestBlock = 0;
      let aGuestSnap = 0;
      let bAny = 0;

      aGuest.on("BLOCK_DELTA", () => {
        aGuestBlock++;
      });
      aGuest.on("ROOM_SNAPSHOT", () => {
        aGuestSnap++;
      });
      b.on("BLOCK_DELTA", () => {
        bAny++;
      });
      b.on("ROOM_SNAPSHOT", () => {
        bAny++;
      });

      let connected = 0;
      function whenAllConnected(fn: () => void) {
        connected++;
        if (connected === 3) fn();
      }
      aHost.on("connect", () => whenAllConnected(start));
      aGuest.on("connect", () => whenAllConnected(start));
      b.on("connect", () => whenAllConnected(start));

      function cleanup(err?: unknown) {
        aHost.disconnect();
        aGuest.disconnect();
        b.disconnect();
        io.close();
        httpServer.close(() => done(err));
      }

      function start() {
        aHost.emit("join", "voxel:sess-A");
        aGuest.emit("join", "voxel:sess-A");
        b.emit("join", "voxel:sess-B");
        setTimeout(() => {
          aHost.emit("placeBlock", "voxel:sess-A");
          aHost.emit("snapshot", "voxel:sess-A");
          setTimeout(() => {
            try {
              expect(aGuestBlock).toBe(1);
              expect(aGuestSnap).toBe(1);
              expect(bAny).toBe(0);
              cleanup();
            } catch (e) {
              cleanup(e);
            }
          }, 150);
        }, 50);
      }
    });
  });
});
