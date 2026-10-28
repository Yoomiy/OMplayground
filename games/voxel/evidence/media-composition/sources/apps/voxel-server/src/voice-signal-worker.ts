import { parentPort, workerData } from "node:worker_threads";
import WebSocket from "ws";
import {
  browserSignal,
  providerSignal,
  providerSearch,
  leaveSignal,
  MAX_SIGNAL_BYTES,
} from "./voice-signal-protocol.ts";
import type {
  ToVoiceSignal,
  FromVoiceSignal,
} from "./voice-signal-messages.ts";
if (!parentPort) throw new Error("Voice signaling worker requires an owner");
const port = parentPort,
  endpoint = new URL(workerData.endpoint as string);
type Session = {
  socket: WebSocket;
  until: number;
  publish: boolean;
  sequence: number;
  pending: Map<number, number>;
  pendingBytes: number;
  queued: { sequence: number; bytes: Uint8Array }[];
  closed: boolean;
};
const sessions = new Map<string, Session>();
const post = (value: FromVoiceSignal) => port.postMessage(value);
function close(
  id: string,
  reason: Extract<FromVoiceSignal, { type: "closed" }>["reason"],
  upstreamStatus?: number,
) {
  const session = sessions.get(id);
  if (!session || session.closed) return;
  session.closed = true;
  sessions.delete(id);
  session.queued = [];
  session.pending.clear();
  if (session.socket.readyState === WebSocket.OPEN) {
    // The worker owns the authenticated upstream connection. It can end media
    // directly even while its parent/gateway event loop is blocked.
    session.socket.send(leaveSignal(), { binary: true });
    session.socket.close(1000, "media authority ended");
  } else session.socket.terminate();
  const timer = setTimeout(() => session.socket.terminate(), 1000);
  timer.unref();
  session.socket.once("close", () => clearTimeout(timer));
  post({ type: "closed", id, reason, upstreamStatus });
}
function valid(id: string, session: Session): boolean {
  if (session.closed) return false;
  if (performance.now() < session.until) return true;
  close(id, "EXPIRED");
  return false;
}
function input(
  id: string,
  session: Session,
  sequence: number,
  bytes: Uint8Array,
) {
  if (!valid(id, session)) return;
  try {
    const frame = providerSignal(bytes, session.publish);
    if (session.socket.bufferedAmount + frame.byteLength > 1024 * 1024) {
      close(id, "BACKPRESSURE");
      return;
    }
    session.socket.send(frame, { binary: true }, (error) => {
      if (error) close(id, "UPSTREAM");
      else post({ type: "input-ack", id, sequence });
    });
  } catch {
    close(id, "PROTOCOL");
  }
}
port.on("message", (message: ToVoiceSignal) => {
  if (message.type === "shutdown") {
    for (const id of [...sessions.keys()]) close(id, "CLOSED");
    clearInterval(expiry);
    port.close();
    return;
  }
  if (message.type === "start") {
    if (
      sessions.has(message.id) ||
      !Number.isFinite(message.until) ||
      message.until <= performance.now() ||
      message.until > performance.now() + 5000 ||
      !["/rtc", "/rtc/v1"].includes(message.path)
    ) {
      post({ type: "closed", id: message.id, reason: "EXPIRED" });
      return;
    }
    const url = new URL(endpoint);
    url.pathname = url.pathname.replace(/\/$/, "") + message.path;
    let socket: WebSocket;
    try {
      url.search = providerSearch(message.search, message.publish);
      url.searchParams.set("access_token", message.token);
      socket = new WebSocket(url, {
        maxPayload: MAX_SIGNAL_BYTES,
        perMessageDeflate: false,
        handshakeTimeout: 5000,
      });
    } catch {
      post({ type: "closed", id: message.id, reason: "UPSTREAM" });
      return;
    }
    const session: Session = {
      socket,
      until: message.until,
      publish: message.publish,
      sequence: 0,
      pending: new Map(),
      pendingBytes: 0,
      queued: [],
      closed: false,
    };
    sessions.set(message.id, session);
    socket.on("unexpected-response", (_request, response) => {
      response.resume();
      close(message.id, "UPSTREAM", response.statusCode);
    });
    socket.on("error", () => close(message.id, "UPSTREAM"));
    socket.on("close", () => close(message.id, "UPSTREAM"));
    socket.on("open", () => {
      if (!valid(message.id, session)) return;
      for (const value of session.queued)
        input(message.id, session, value.sequence, value.bytes);
      session.queued = [];
    });
    socket.on("message", (bytes, binary) => {
      if (!valid(message.id, session)) return;
      if (!binary) {
        close(message.id, "PROTOCOL");
        return;
      }
      try {
        const source = Buffer.isBuffer(bytes)
            ? bytes
            : bytes instanceof ArrayBuffer
              ? Buffer.from(bytes)
              : Buffer.concat(bytes),
          frame = browserSignal(source);
        if (!frame) {
          post({ type: "token-filtered", id: message.id });
          return;
        }
        if (
          session.pendingBytes + frame.byteLength > 1024 * 1024 ||
          session.pending.size >= 128
        ) {
          close(message.id, "BACKPRESSURE");
          return;
        }
        const sequence = ++session.sequence;
        session.pending.set(sequence, frame.byteLength);
        session.pendingBytes += frame.byteLength;
        post({ type: "frame", id: message.id, sequence, bytes: frame });
      } catch {
        close(message.id, "PROTOCOL");
      }
    });
    return;
  }
  const session = sessions.get(message.id);
  if (!session || !valid(message.id, session)) return;
  if (message.type === "close") close(message.id, "CLOSED");
  else if (message.type === "renew") {
    if (
      Number.isFinite(message.until) &&
      message.until > performance.now() &&
      message.until <= performance.now() + 5000
    )
      session.until = message.until;
    else close(message.id, "EXPIRED");
  } else if (message.type === "ack") {
    session.pendingBytes -= session.pending.get(message.sequence) ?? 0;
    session.pending.delete(message.sequence);
  } else if (message.type === "input") {
    if (session.socket.readyState === WebSocket.CONNECTING) {
      if (
        session.queued.length >= 128 ||
        session.queued.reduce((n, v) => n + v.bytes.byteLength, 0) +
          message.bytes.byteLength >
          1024 * 1024
      )
        close(message.id, "BACKPRESSURE");
      else
        session.queued.push({
          sequence: message.sequence,
          bytes: message.bytes,
        });
    } else if (session.socket.readyState === WebSocket.OPEN)
      input(message.id, session, message.sequence, message.bytes);
  }
});
const expiry = setInterval(() => {
  for (const [id, session] of sessions) valid(id, session);
}, 25);
post({ type: "ready" });
