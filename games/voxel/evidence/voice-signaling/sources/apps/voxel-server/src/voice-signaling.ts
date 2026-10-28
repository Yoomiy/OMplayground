import { randomBytes, randomUUID } from "node:crypto";
import { Worker } from "node:worker_threads";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Duplex } from "node:stream";
import WebSocket, { WebSocketServer } from "ws";
import { MAX_SIGNAL_BYTES, terminalSignal } from "./voice-signal-protocol.ts";
import type {
  ToVoiceSignal,
  FromVoiceSignal,
} from "./voice-signal-messages.ts";
/** Constructed by a verified service adapter, never decoded from browser claims. */
export type VoiceSignalGrant = Readonly<{
  scope: string;
  token: string;
  publish: boolean;
  expiresAt: number;
  policy?: Readonly<{ room: string; actor: string; revision: number }>;
  revalidate: () => Promise<Readonly<{ expiresAt: number }> | null>;
}>;
type Ticket = {
  grant: VoiceSignalGrant;
  until: number;
  timer: ReturnType<typeof setTimeout>;
};
type Session = {
  id: string;
  grant: VoiceSignalGrant;
  client: WebSocket;
  until: number;
  timer: ReturnType<typeof setTimeout> | null;
  sequence: number;
  pending: Map<number, number>;
  pendingBytes: number;
};
const bytes = (data: WebSocket.RawData) =>
  Buffer.isBuffer(data)
    ? data
    : data instanceof ArrayBuffer
      ? Buffer.from(data)
      : Buffer.concat(data);
/** Browser tickets are single-use; reusable SFU credentials stay in the backend. */
export class VoiceSignaling {
  private worker: Worker;
  private sockets = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_SIGNAL_BYTES,
    perMessageDeflate: false,
  });
  private tickets = new Map<string, Ticket>();
  private sessions = new Map<string, Session>();
  private scopes = new Map<string, string>();
  private origins: readonly string[];
  private failed = false;
  private closing: Promise<void> | null = null;
  private filtered = 0;
  private protocolClosures = 0;
  private expired = 0;
  private closures: Partial<
    Record<Extract<FromVoiceSignal, { type: "closed" }>["reason"], number>
  > = {};
  private upstreamStatus: number | null = null;
  private startup: ReturnType<typeof setTimeout>;
  private rejectReady: (error: Error) => void;
  readonly ready: Promise<void>;
  constructor(
    endpoint: string,
    origins: readonly string[],
    allowInsecureLocal = false,
  ) {
    const url = new URL(endpoint);
    if (
      !["wss:", "https:"].includes(url.protocol) &&
      !(
        allowInsecureLocal &&
        ["ws:", "http:"].includes(url.protocol) &&
        ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
      )
    )
      throw new Error("Secure voice endpoint required");
    if (url.username || url.password || url.search || url.hash)
      throw new Error("Invalid voice endpoint");
    url.protocol =
      url.protocol === "https:"
        ? "wss:"
        : url.protocol === "http:"
          ? "ws:"
          : url.protocol;
    this.origins = origins;
    this.worker = new Worker(
      new URL("./voice-signal-worker.ts", import.meta.url),
      { workerData: { endpoint: url.href } },
    );
    let resolve!: () => void, reject!: (error: Error) => void;
    this.ready = new Promise<void>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    void this.ready.catch(() => {});
    this.rejectReady = reject;
    const startup = (this.startup = setTimeout(() => {
      reject(new Error("VOICE_WORKER_UNAVAILABLE"));
      this.failure();
    }, 5000));
    startup.unref();
    this.worker.on("message", (message: FromVoiceSignal) => {
      if (message.type === "ready") {
        clearTimeout(startup);
        resolve();
        return;
      }
      if (message.type === "token-filtered") {
        this.filtered++;
        return;
      }
      if (message.type === "closed") {
        this.closures[message.reason] =
          (this.closures[message.reason] ?? 0) + 1;
        if (message.upstreamStatus !== undefined)
          this.upstreamStatus = message.upstreamStatus;
        if (message.reason === "PROTOCOL") this.protocolClosures++;
        if (message.reason === "EXPIRED") this.expired++;
        const session = this.sessions.get(message.id);
        if (session) this.end(session);
        return;
      }
      const session = this.sessions.get(message.id);
      if (!session) return;
      if (message.type === "input-ack") {
        session.pendingBytes -= session.pending.get(message.sequence) ?? 0;
        session.pending.delete(message.sequence);
        return;
      }
      if (
        performance.now() >= session.until ||
        session.client.readyState !== WebSocket.OPEN ||
        session.client.bufferedAmount + message.bytes.byteLength > 1024 * 1024
      ) {
        this.end(session);
        return;
      }
      session.client.send(message.bytes, { binary: true }, (error) => {
        if (error) this.end(session);
        else
          this.post({
            type: "ack",
            id: session.id,
            sequence: message.sequence,
          });
      });
    });
    const lost = () => {
      clearTimeout(startup);
      reject(new Error("VOICE_WORKER_UNAVAILABLE"));
      this.failure();
    };
    this.worker.on("error", lost);
    this.worker.on("exit", () => {
      if (!this.closing) lost();
    });
  }
  private post(message: ToVoiceSignal) {
    if (!this.failed) this.worker.postMessage(message);
  }
  private allowed(request: IncomingMessage) {
    return (
      !request.headers.origin ||
      this.origins.includes(request.headers.origin) ||
      request.headers.origin === `http://${request.headers.host}` ||
      request.headers.origin === `https://${request.headers.host}`
    );
  }
  private until(
    expiresAt: number,
    started = performance.now(),
    wall = Date.now(),
  ) {
    const until = started + expiresAt - wall;
    if (
      !Number.isFinite(expiresAt) ||
      until <= performance.now() ||
      until > started + 5000
    )
      throw new Error("VOICE_PROOF_EXPIRED");
    return until;
  }
  issue(
    grant: VoiceSignalGrant,
  ): Readonly<{ ticket: string; expiresAt: number }> {
    if (this.failed || this.closing) throw new Error("VOICE_UNAVAILABLE");
    if (
      !grant.scope ||
      grant.scope.length > 128 ||
      !grant.token ||
      grant.token.length > 16384 ||
      typeof grant.publish !== "boolean" ||
      typeof grant.revalidate !== "function"
    )
      throw new Error("Invalid trusted voice grant");
    if (
      grant.policy &&
      (!grant.policy.room ||
        !grant.policy.actor ||
        !Number.isSafeInteger(grant.policy.revision) ||
        grant.policy.revision < 0)
    )
      throw new Error("Invalid trusted voice policy");
    const until = this.until(grant.expiresAt),
      ticket = randomBytes(32).toString("base64url");
    const timer = setTimeout(
      () => this.tickets.delete(ticket),
      Math.max(0, until - performance.now()),
    );
    timer.unref();
    const owned = Object.freeze({
      ...grant,
      policy: grant.policy ? Object.freeze({ ...grant.policy }) : undefined,
    });
    this.tickets.set(ticket, { grant: owned, until, timer });
    return { ticket, expiresAt: grant.expiresAt };
  }
  /** A historical command retry cannot disconnect a later fresh admission. */
  revoke(room: string, actor: string | null, revision: number): void {
    if (!Number.isSafeInteger(revision) || revision < 1)
      throw new Error("Invalid voice cutoff");
    const old = (grant: VoiceSignalGrant) =>
      grant.policy?.room === room &&
      (actor === null || grant.policy.actor === actor) &&
      grant.policy.revision < revision;
    for (const [id, ticket] of this.tickets)
      if (old(ticket.grant)) {
        clearTimeout(ticket.timer);
        this.tickets.delete(id);
      }
    for (const session of [...this.sessions.values()])
      if (old(session.grant)) this.end(session);
  }
  handleHttp(request: IncomingMessage, response: ServerResponse): boolean {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (!/^\/voxel-media\/rtc(?:\/v1)?\/validate$/.test(url.pathname))
      return false;
    const origin = request.headers.origin;
    if (origin && this.allowed(request))
      response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Cache-Control", "no-store");
    const token = url.searchParams.get("access_token") ?? "",
      ticket = this.tickets.get(token);
    const accepted =
      this.allowed(request) &&
      url.searchParams.getAll("access_token").length === 1 &&
      !!ticket &&
      performance.now() < ticket.until &&
      !this.failed &&
      !this.closing;
    response.writeHead(accepted ? 200 : 401, { "Content-Type": "text/plain" });
    response.end(accepted ? "OK" : "VOICE_UNAUTHORIZED");
    return true;
  }
  upgrade(request: IncomingMessage, socket: Duplex, head: Buffer): boolean {
    const url = new URL(request.url ?? "/", "http://localhost");
    const path =
      url.pathname === "/voxel-media/rtc"
        ? "/rtc"
        : url.pathname === "/voxel-media/rtc/v1"
          ? "/rtc/v1"
          : null;
    if (!path) return false;
    const deny = () => {
      if (!socket.destroyed)
        socket.end(
          "HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n",
        );
    };
    const token = url.searchParams.get("access_token") ?? "",
      ticket = this.tickets.get(token);
    if (
      !this.allowed(request) ||
      this.failed ||
      this.closing ||
      url.searchParams.getAll("access_token").length !== 1 ||
      !ticket ||
      performance.now() >= ticket.until
    ) {
      deny();
      return true;
    }
    this.tickets.delete(token);
    clearTimeout(ticket.timer);
    const started = performance.now(),
      wall = Date.now();
    const timeout = setTimeout(
      () => socket.destroy(),
      Math.max(0, ticket.until - started),
    );
    void ticket.grant
      .revalidate()
      .then((proof) => {
        clearTimeout(timeout);
        if (
          !proof ||
          socket.destroyed ||
          performance.now() >= ticket.until ||
          this.failed ||
          this.closing
        ) {
          deny();
          return;
        }
        const until = this.until(proof.expiresAt, started, wall);
        this.sockets.handleUpgrade(request, socket, head, (client) => {
          const old = this.scopes.get(ticket.grant.scope);
          if (old) {
            const session = this.sessions.get(old);
            if (session) this.end(session);
          }
          const session: Session = {
            id: randomUUID(),
            grant: ticket.grant,
            client,
            until,
            timer: null,
            sequence: 0,
            pending: new Map(),
            pendingBytes: 0,
          };
          this.sessions.set(session.id, session);
          this.scopes.set(session.grant.scope, session.id);
          url.searchParams.delete("access_token");
          url.searchParams.delete("use_json");
          this.post({
            type: "start",
            id: session.id,
            path,
            search: url.search,
            token: session.grant.token,
            until,
            publish: session.grant.publish,
          });
          client.on("message", (data, binary) => {
            if (!binary || performance.now() >= session.until) {
              this.end(session);
              return;
            }
            const frame = bytes(data);
            if (
              session.pending.size >= 128 ||
              session.pendingBytes + frame.byteLength > 1024 * 1024
            ) {
              this.end(session);
              return;
            }
            const sequence = ++session.sequence;
            session.pending.set(sequence, frame.byteLength);
            session.pendingBytes += frame.byteLength;
            this.post({
              type: "input",
              id: session.id,
              sequence,
              bytes: frame,
            });
          });
          client.on("close", () => this.end(session));
          client.on("error", () => this.end(session));
          this.schedule(session);
        });
      })
      .catch(() => {
        clearTimeout(timeout);
        deny();
      });
    return true;
  }
  private schedule(session: Session) {
    session.timer = setTimeout(
      () => void this.renew(session),
      Math.max(1, (session.until - performance.now()) / 2),
    );
  }
  private async renew(session: Session) {
    if (!this.sessions.has(session.id)) return;
    if (performance.now() >= session.until) {
      this.end(session);
      return;
    }
    const started = performance.now(),
      wall = Date.now();
    try {
      const proof = await session.grant.revalidate();
      if (!this.sessions.has(session.id)) return;
      if (!proof || performance.now() >= session.until) {
        this.end(session);
        return;
      }
      session.until = this.until(proof.expiresAt, started, wall);
      this.post({ type: "renew", id: session.id, until: session.until });
      this.schedule(session);
    } catch {
      this.end(session);
    }
  }
  private end(session: Session) {
    if (!this.sessions.delete(session.id)) return;
    if (this.scopes.get(session.grant.scope) === session.id)
      this.scopes.delete(session.grant.scope);
    if (session.timer) clearTimeout(session.timer);
    session.pending.clear();
    this.post({ type: "close", id: session.id });
    if (session.client.readyState === WebSocket.OPEN) {
      session.client.send(terminalSignal(), { binary: true });
      session.client.close(1000, "media ended");
    } else session.client.terminate();
    const timer = setTimeout(() => session.client.terminate(), 1000);
    timer.unref();
    session.client.once("close", () => clearTimeout(timer));
  }
  private failure() {
    this.failed = true;
    for (const session of [...this.sessions.values()]) this.end(session);
  }
  get stats() {
    return {
      sessions: this.sessions.size,
      tickets: this.tickets.size,
      filteredTokens: this.filtered,
      protocolClosures: this.protocolClosures,
      expired: this.expired,
      closures: { ...this.closures },
      upstreamStatus: this.upstreamStatus,
      failed: this.failed,
      closed: !!this.closing,
    };
  }
  close(): Promise<void> {
    if (this.closing) return this.closing;
    clearTimeout(this.startup);
    this.rejectReady(new Error("VOICE_CLOSED"));
    for (const ticket of this.tickets.values()) clearTimeout(ticket.timer);
    this.tickets.clear();
    for (const session of [...this.sessions.values()]) this.end(session);
    this.post({ type: "shutdown" });
    this.closing = (async () => {
      await new Promise<void>((resolve) => this.sockets.close(() => resolve()));
      await this.worker.terminate();
    })();
    return this.closing;
  }
}
