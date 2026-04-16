import http from "http";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";
import { createClient } from "@supabase/supabase-js";
import { verifySupabaseJwt } from "./auth/verifySupabaseJwt";
import { isWithinRecess } from "./recess";
import {
  assignPlayer,
  applyMove,
  getOrCreateRoom,
  getRoom,
  removePlayerFromRoom
} from "./tictactoeRoom";

const PORT = Number(process.env.PORT ?? 8080);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET ?? "";

const app = express();
app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: CORS_ORIGIN.split(",").map((s) => s.trim()),
    credentials: true
  })
);
app.use(express.json());
app.use(morgan("combined"));

const httpLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(httpLimiter);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "playground-game-server" });
});

app.get("/ready", (_req, res) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_JWT_SECRET) {
    res.status(503).json({ ok: false, reason: "missing_env" });
    return;
  }
  res.json({ ok: true });
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN.split(",").map((s) => s.trim()),
    credentials: true
  }
});

const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      })
    : null;

let recessCache: {
  rows: { day_of_week: number; start_time: string; end_time: string; is_active: boolean }[];
  fetchedAt: number;
} = { rows: [], fetchedAt: 0 };

async function loadRecessSchedules() {
  if (!supabaseAdmin) return [];
  const now = Date.now();
  if (now - recessCache.fetchedAt < 60_000 && recessCache.rows.length) {
    return recessCache.rows;
  }
  const { data, error } = await supabaseAdmin
    .from("recess_schedules")
    .select("day_of_week, start_time, end_time, is_active")
    .eq("is_active", true);
  if (error) {
    console.error("recess_schedules", error.message);
    return recessCache.rows;
  }
  recessCache = { rows: data ?? [], fetchedAt: now };
  return recessCache.rows;
}

io.use(async (socket, next) => {
  try {
    const token =
      (socket.handshake.auth as { token?: string }).token ??
      socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) {
      next(new Error("UNAUTHORIZED"));
      return;
    }
    if (!SUPABASE_JWT_SECRET) {
      next(new Error("SERVER_CONFIG"));
      return;
    }
    const user = verifySupabaseJwt(token, SUPABASE_JWT_SECRET);
    if (!supabaseAdmin) {
      next(new Error("SERVER_CONFIG"));
      return;
    }
    const { data: profile, error } = await supabaseAdmin
      .from("kid_profiles")
      .select("id, role, gender, full_name, is_active")
      .eq("id", user.sub)
      .maybeSingle();
    if (error || !profile || !profile.is_active) {
      next(new Error("FORBIDDEN"));
      return;
    }
    if (profile.role === "kid") {
      const schedules = await loadRecessSchedules();
      if (schedules.length && !isWithinRecess(new Date(), schedules)) {
        next(new Error("RECESS_DENIED"));
        return;
      }
    }
    socket.data.userId = profile.id as string;
    socket.data.displayName = profile.full_name as string;
    socket.data.role = profile.role as string;
    socket.data.gender = profile.gender as "boy" | "girl";
    next();
  } catch {
    next(new Error("UNAUTHORIZED"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.data.userId as string;
  const displayName = socket.data.displayName as string;
  const gender = socket.data.gender as "boy" | "girl";

  socket.on(
    "JOIN_ROOM",
    async (
      payload: { sessionId: string },
      ack?: (r: unknown) => void
    ) => {
      const sessionId = payload?.sessionId;
      if (!sessionId) {
        ack?.({ ok: false, error: { code: "BAD_REQUEST", message: "sessionId required" } });
        return;
      }
      if (!supabaseAdmin) {
        ack?.({ ok: false, error: { code: "SERVER_CONFIG", message: "Supabase not configured" } });
        return;
      }
      const { data: session, error } = await supabaseAdmin
        .from("game_sessions")
        .select("id, game_id, gender, player_ids, host_id")
        .eq("id", sessionId)
        .maybeSingle();
      if (error || !session) {
        ack?.({ ok: false, error: { code: "NOT_FOUND", message: "Session not found" } });
        return;
      }
      if ((session.gender as string) !== gender) {
        ack?.({
          ok: false,
          error: { code: "GENDER_MISMATCH", message: "Wrong gender partition" }
        });
        return;
      }
      const room = getOrCreateRoom(sessionId, {
        gameId: session.game_id as string,
        gender,
        hostId: session.host_id as string
      });
      const assigned = assignPlayer(room, userId, displayName);
      if ("error" in assigned) {
        ack?.({ ok: false, error: assigned.error });
        return;
      }
      await socket.join(`session:${sessionId}`);
      socket.data.sessionId = sessionId;
      io.to(`session:${sessionId}`).emit("ROOM_SNAPSHOT", {
        sessionId,
        gameKey: "tictactoe",
        hostId: room.hostId,
        gameState: room.state,
        players: Array.from(room.players.values())
      });
      ack?.({ ok: true, player: assigned.player });
    }
  );

  socket.on(
    "INTENT_GAME",
    (payload: { sessionId: string; cellIndex: number }, ack?: (r: unknown) => void) => {
      const sessionId = payload?.sessionId;
      if (sessionId === undefined || payload.cellIndex === undefined) {
        ack?.({ ok: false, error: { code: "BAD_REQUEST", message: "sessionId and cellIndex required" } });
        return;
      }
      const room = getRoom(sessionId);
      if (!room) {
        ack?.({ ok: false, error: { code: "NOT_FOUND", message: "Room not loaded" } });
        return;
      }
      const res = applyMove(room, userId, payload.cellIndex);
      if ("error" in res) {
        ack?.({ ok: false, error: res.error });
        return;
      }
      if (
        supabaseAdmin &&
        (res.state.status === "won" || res.state.status === "draw")
      ) {
        void supabaseAdmin
          .from("game_sessions")
          .update({
            status: "completed",
            game_state: res.state as unknown as Record<string, unknown>,
            last_activity: new Date().toISOString()
          })
          .eq("id", sessionId);
      }
      io.to(`session:${sessionId}`).emit("ROOM_SNAPSHOT", {
        sessionId,
        gameKey: "tictactoe",
        hostId: room.hostId,
        gameState: res.state,
        players: Array.from(room.players.values())
      });
      ack?.({ ok: true, gameState: res.state });
    }
  );

  socket.on(
    "CHAT_MESSAGE",
    async (
      payload: { sessionId: string; message: string },
      ack?: (r: unknown) => void
    ) => {
      const sessionId = payload?.sessionId;
      const message = payload?.message;
      if (!sessionId || typeof message !== "string") {
        ack?.({
          ok: false,
          error: { code: "BAD_REQUEST", message: "sessionId and message required" }
        });
        return;
      }
      const text = message.trim().slice(0, 500);
      if (!text) {
        ack?.({ ok: false, error: { code: "BAD_REQUEST", message: "empty" } });
        return;
      }
      if (!supabaseAdmin) {
        ack?.({
          ok: false,
          error: { code: "SERVER_CONFIG", message: "Supabase not configured" }
        });
        return;
      }
      const { error: insErr } = await supabaseAdmin.from("chat_messages").insert({
        session_id: sessionId,
        sender_id: userId,
        sender_name: displayName,
        message: text,
        is_system: false
      });
      if (insErr) {
        ack?.({ ok: false, error: { code: "PERSIST_FAILED", message: insErr.message } });
        return;
      }
      io.to(`session:${sessionId}`).emit("CHAT_MESSAGE", {
        sessionId,
        senderId: userId,
        senderName: displayName,
        message: text,
        timestamp: new Date().toISOString()
      });
      ack?.({ ok: true });
    }
  );

  socket.on("disconnect", () => {
    const sessionId = socket.data.sessionId as string | undefined;
    if (sessionId && userId) {
      const result = removePlayerFromRoom(sessionId, userId);
      if (result.newHostId && supabaseAdmin) {
        void supabaseAdmin
          .from("game_sessions")
          .update({
            host_id: result.newHostId,
            last_activity: new Date().toISOString()
          })
          .eq("id", sessionId);
      }
      if (result.roomEmpty && supabaseAdmin) {
        void supabaseAdmin
          .from("game_sessions")
          .update({
            status: "paused",
            last_activity: new Date().toISOString()
          })
          .eq("id", sessionId);
      }
      const room = getRoom(sessionId);
      io.to(`session:${sessionId}`).emit("ROOM_SNAPSHOT", {
        sessionId,
        gameKey: "tictactoe",
        hostId: room?.hostId,
        gameState: room?.state,
        players: room ? Array.from(room.players.values()) : []
      });
    }
  });
});

server.listen(PORT, () => {
  console.log(`game-server listening on ${PORT}`);
});
