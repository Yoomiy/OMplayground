import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { once } from "node:events";
import { WebSocket, WebSocketServer } from "ws";
import { SignalResponse } from "@livekit/protocol";
import { TokenVerifier } from "livekit-server-sdk";
import { PostgresTestDatabase, literal } from "../helpers/postgres.ts";
import { supabaseWire } from "../helpers/supabase-wire.ts";
import { schoolSqlFixture } from "../helpers/school-sql-fixture.ts";
import {
  createSupabaseServerClient,
  SupabasePersistence,
} from "../../src/supabase-persistence.ts";
import { SupabaseSessions } from "../../src/supabase-sessions.ts";
import {
  SupabaseMedia,
  SchoolVoice,
  schoolMediaApi,
} from "../../src/school-media.ts";
import { VoiceSignaling } from "../../src/voice-signaling.ts";
import { schoolGatewayPolicy } from "../../src/school-admission.ts";
import { createGateway } from "../../../../games/voxel/src/server/gateway.ts";
import { SocketProbe } from "../../../../games/voxel/tests/fixtures/socket-probe.ts";
import {
  readVoiceTicket,
  readMediaReceipt,
} from "../../../../games/voxel/src/shared/media.ts";
const db = new PostgresTestDatabase();
db.installSessionControls();
after(() => db.close());
async function wait(check: () => boolean) {
  const until = Date.now() + 5000;
  while (!check()) {
    if (Date.now() > until)
      throw new Error("Media integration condition timed out");
    await new Promise((r) => setTimeout(r, 10));
  }
}
test(
  "real SDK/SQL and native actor authorize only opaque voice; lost committed mute revokes, retries preserve a fresh listener, staff remain hidden and leave ends media",
  { timeout: 30000 },
  async () => {
    const room = db.session(),
      kid = randomUUID(),
      teacher = randomUUID(),
      game = randomUUID();
    db.exec(`INSERT INTO public.games(id,game_url) VALUES(${literal(game)},'minecraft');
    INSERT INTO public.kid_profiles(id,full_name,gender,grade,role) VALUES(${literal(kid)},'Kid','boy','ג','kid'),(${literal(teacher)},'Teacher','girl',NULL,'teacher');
    UPDATE public.game_sessions SET game_id=${literal(game)},host_id=${literal(kid)},gender='boy',status='playing',
      player_ids=ARRAY[${literal(kid)}]::uuid[],player_names=ARRAY['Kid'] WHERE id=${literal(room)}`);
    const wire = await supabaseWire(db),
      client = createSupabaseServerClient({
        SUPABASE_URL: wire.origin,
        SUPABASE_SECRET_KEY: wire.secret,
      }),
      school = schoolSqlFixture(db, room, [kid, teacher]),
      backend = new SupabasePersistence(client),
      sessions = new SupabaseSessions(client),
      media = new SupabaseMedia(client),
      provider = new WebSocketServer({ port: 0, host: "127.0.0.1" }),
      claims: Array<Record<string, any>> = [],
      errors: string[] = [],
      events: unknown[] = [];
    await once(provider, "listening");
    const providerAddress = provider.address();
    assert(providerAddress && typeof providerAddress === "object");
    const credentials = {
        endpoint: "wss://media.invalid",
        key: "local_media_test",
        secret: "local_media_test_secret_at_least_32_characters",
      },
      verifier = new TokenVerifier(credentials.key, credentials.secret);
    provider.on("connection", (socket, request) => {
      void (async () => {
        const token = new URL(
          request.url!,
          "http://localhost",
        ).searchParams.get("access_token")!;
        assert(token.includes("."));
        const verified = await verifier.verify(token);
        claims.push(verified);
        socket.send(
          new SignalResponse({
            message: { case: "join", value: { serverVersion: "fixture" } },
          }).toBinary(),
        );
        socket.send(
          new SignalResponse({
            message: {
              case: "refreshToken",
              value: "private-refreshed-fixture-credential",
            },
          }).toBinary(),
        );
      })().catch(() => {
        errors.push("Test provider credential rejected");
        socket.close();
      });
    });
    const signal = new VoiceSignaling(
      `ws://127.0.0.1:${providerAddress.port}`,
      [],
      true,
    );
    await signal.ready;
    const voice = new SchoolVoice(school.access, media, signal, credentials),
      build = JSON.parse(
        readFileSync(
          new URL(
            "../../../../games/voxel/artifacts/build.json",
            import.meta.url,
          ),
          "utf8",
        ),
      ),
      content = JSON.parse(
        readFileSync(
          new URL(
            "../../../../games/voxel/artifacts/content.json",
            import.meta.url,
          ),
          "utf8",
        ),
      );
    const gateway = await createGateway({
      build,
      content,
      ...schoolGatewayPolicy(school.access, sessions),
      persistence: { objects: backend, metadata: backend },
      api: schoolMediaApi(
        school.access,
        media,
        voice,
        signal,
        (name, context) => events.push({ name, context }),
      ),
      upgradeClient: (request, socket, head) =>
        signal.upgrade(request, socket, head),
      handleClient: (request, response) => {
        if (!signal.handleHttp(request, response)) {
          response.writeHead(404);
          response.end();
        }
      },
    });
    assert(gateway.address && typeof gateway.address === "object");
    const origin = `http://127.0.0.1:${gateway.address.port}`,
      probes: SocketProbe[] = [],
      sockets: WebSocket[] = [];
    const post = (path: string, actor: string, body: unknown = {}) =>
      fetch(origin + "/api/voxel/" + path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + school.token(actor),
        },
        body: JSON.stringify({ room, ...(body as object) }),
      });
    const join = async (actor: string) => {
      const response = await post("admission", actor);
      assert.equal(response.status, 200);
      const probe = new SocketProbe(
        origin.replace(/^http/, "ws") + "/voxel",
        content.blocks.length,
      );
      probes.push(probe);
      await once(probe.socket, "open");
      probe.send({ type: "hello", ...(await response.json()) });
      await probe.ready();
      return probe;
    };
    const ticket = async (actor: string) => {
      const response = await post("voice-ticket", actor);
      assert.equal(response.status, 200);
      const value = readVoiceTicket(await response.json());
      assert(value);
      assert(!JSON.stringify(value).includes("eyJ"));
      return value;
    };
    const connect = async (
      value: NonNullable<ReturnType<typeof readVoiceTicket>>,
    ) => {
      const socket = new WebSocket(
          origin.replace(/^http/, "ws") +
            "/voxel-media/rtc?access_token=" +
            value.ticket,
        ),
        frames: Buffer[] = [];
      sockets.push(socket);
      socket.on("error", () => {});
      socket.on("message", (data) => frames.push(Buffer.from(data as Buffer)));
      await once(socket, "open");
      await wait(() => frames.length > 0);
      assert.equal(SignalResponse.fromBinary(frames[0]).message.case, "join");
      assert(!frames.some((f) => f.includes(Buffer.from("private-refreshed"))));
      return socket;
    };
    try {
      await media.verifyInstallation();
      assert.equal((await post("voice-ticket", kid)).status, 403);
      assert.equal(gateway.rooms.size, 0);
      assert.equal(
        (await post("voice-ticket", kid, { publish: true })).status,
        400,
      );
      assert.equal((await post("media-state", kid)).status, 403);
      assert.equal((await post("media-state", teacher)).status, 200);
      assert.equal(gateway.rooms.size, 0);
      await join(teacher);
      const player = await join(kid),
        initial = await ticket(kid),
        publisher = await connect(initial);
      assert(initial.publish && !initial.hidden);
      assert.equal(claims.at(-1)!.video.canPublish, true);
      assert.equal(JSON.parse(claims.at(-1)!.metadata).actorId, kid);
      assert.match(claims.at(-1)!.video.room, /^voxel-v13-/);
      assert(!claims.at(-1)!.video.room.includes(room));
      const ended = once(publisher, "close"),
        id = randomUUID(),
        command = { requestId: id, action: "mute", target: kid };
      wire.control.loseMediaResponse = true;
      assert.equal(
        (await post("media-moderate", teacher, command)).status,
        503,
      );
      await ended; // Fresh SQL renewal revokes even when the committed receipt was lost.
      const retry = await post("media-moderate", teacher, command);
      assert.equal(retry.status, 200);
      const receipt = readMediaReceipt(await retry.json());
      assert(
        receipt &&
          receipt.persisted &&
          !receipt.saved &&
          receipt.revocationRequested,
      );
      const fresh = await ticket(kid);
      assert(!fresh.publish);
      const listener = await connect(fresh);
      assert.equal(claims.at(-1)!.video.canPublish, false);
      assert.equal(
        (await post("media-moderate", teacher, command)).status,
        200,
      );
      assert.equal(listener.readyState, WebSocket.OPEN);
      assert.equal(
        db.value(
          `SELECT count(*) FROM public.audit_log WHERE entity_id=${literal(room)} AND action='VOXEL_MEDIA_MUTE'`,
        ),
        1,
      );
      const hidden = await ticket(teacher);
      assert(hidden.hidden && !hidden.publish);
      const observer = await connect(hidden);
      assert.equal(claims.at(-1)!.video.hidden, true);
      assert.equal(claims.at(-1)!.video.canPublish, false);
      assert.equal(
        (
          await post("media-moderate", teacher, {
            requestId: randomUUID(),
            action: "mute",
            target: null,
          })
        ).status,
        200,
      );
      assert.equal(observer.readyState, WebSocket.OPEN);
      const gone = once(listener, "close");
      player.socket.terminate();
      await gone;
      const denied = await post("voice-ticket", kid);
      assert.equal(denied.status, 403);
      assert.equal((await denied.json()).error, "NOT_IN_ROOM");
      assert.deepEqual(errors, []);
      assert(!JSON.stringify(events).includes("eyJ"));
      assert(!JSON.stringify(events).includes("secret"));
      assert(!JSON.stringify(events).includes("Teacher"));
    } finally {
      for (const p of probes) p.socket.terminate();
      for (const socket of sockets) socket.terminate();
      await signal.close();
      await gateway.close();
      for (const peer of provider.clients) peer.terminate();
      await new Promise<void>((r) => provider.close(() => r()));
      await wire.close();
    }
  },
);
