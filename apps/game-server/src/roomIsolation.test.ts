import { createServer } from "node:http";
import { Server } from "socket.io";
import { io as ioc, type Socket as ClientSocket } from "socket.io-client";

/**
 * Layer 3 — room-scoped emits (no full auth stack; validates Socket.io room semantics).
 */
describe("Socket.io room isolation", () => {
  it("does not deliver emits to sockets joined to a different room", (done) => {
    const httpServer = createServer();
    const io = new Server(httpServer);

    io.on("connection", (socket) => {
      socket.on("join", (room: string) => {
        void socket.join(room);
      });
      socket.on("broadcast", (room: string) => {
        io.to(room).emit("room_event", { room });
      });
    });

    httpServer.listen(0, () => {
      const { port } = httpServer.address() as { port: number };
      const url = `http://127.0.0.1:${port}`;

      const a: ClientSocket = ioc(url, { transports: ["websocket"] });
      const b: ClientSocket = ioc(url, { transports: ["websocket"] });

      let bGot = false;
      b.on("room_event", () => {
        bGot = true;
      });

      a.on("connect", () => {
        a.emit("join", "room-a");
        b.on("connect", () => {
          b.emit("join", "room-b");
          setTimeout(() => {
            a.emit("broadcast", "room-a");
            setTimeout(() => {
              try {
                expect(bGot).toBe(false);
                a.disconnect();
                b.disconnect();
                io.close();
                httpServer.close(() => done());
              } catch (e) {
                a.disconnect();
                b.disconnect();
                io.close();
                httpServer.close(() => done(e));
              }
            }, 150);
          }, 50);
        });
      });
    });
  });
});
