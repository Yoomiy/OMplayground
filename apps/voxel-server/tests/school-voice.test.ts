import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { TokenVerifier } from "livekit-server-sdk";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  SchoolVoice,
  schoolVoiceApi,
  voiceConfig,
} from "../src/school-voice.ts";
import { schoolFixture } from "./helpers/school-fixture.ts";
import type { GatewayApiContext } from "../../../games/voxel/src/server/gateway.ts";

const credentials = {
  endpoint: "wss://media.example",
  key: "fixture-key",
  secret: "fixture-private-key-for-tests-only",
};
function fixture() {
  const school = schoolFixture();
  school.setNow(Date.now());
  let current: ReturnType<GatewayApiContext["actor"]> = {
    connection: randomUUID(),
    role: "participant",
    admissionRevision: 0,
    expiresAt: Date.now() + 500,
    worldId: randomUUID(),
    owner: randomUUID(),
    epoch: 3,
  };
  const voice = new SchoolVoice(school.access, credentials);
  return {
    ...school,
    voice,
    context: { actor: () => current, revoke() {} },
    setActor(next: typeof current) {
      current = next;
    },
  };
}

test("joined players receive a reusable two-hour microphone token for direct LiveKit connection", async () => {
  const f = fixture(),
    before = Math.floor(Date.now() / 1000);
  const grant = await f.voice.issue(f.room, f.token(), f.context);
  assert.equal(grant.serverUrl, credentials.endpoint);
  assert.equal(grant.publish, true);
  assert.equal(grant.hidden, false);
  const claims = await new TokenVerifier(
    credentials.key,
    credentials.secret,
  ).verify(grant.token);
  assert.equal(claims.sub, f.kid);
  assert.equal(claims.exp! - claims.nbf!, 2 * 60 * 60);
  assert.ok(claims.exp! >= before + 2 * 60 * 60);
  assert.equal(claims.video?.room, `voxel-v13-${f.context.actor()!.worldId}-3`);
  assert.equal(claims.video?.canPublish, true);
  assert.deepEqual(claims.video?.canPublishSources, ["microphone"]);
  assert.equal(claims.video?.canSubscribe, true);
  assert.equal(claims.video?.canPublishData, false);
  // No session, recess, media-policy RPC or renewal is needed for voice admission.
  assert.deepEqual(
    f.requests.map((r) => r.path),
    ["user", "kid_profiles"],
  );
  f.setActor(null);
  assert.equal(
    (
      await new TokenVerifier(credentials.key, credentials.secret).verify(
        grant.token,
      )
    ).sub,
    f.kid,
  );
  await assert.rejects(
    f.voice.issue(f.room, f.token(), f.context),
    /NOT_IN_ROOM/,
  );
});

test("staff observation remains hidden and listen-only", async () => {
  const f = fixture();
  f.setActor({ ...f.context.actor()!, role: "observer" });
  const grant = await f.voice.issue(f.room, f.token(f.teacher), f.context);
  const claims = await new TokenVerifier(
    credentials.key,
    credentials.secret,
  ).verify(grant.token);
  assert.equal(claims.sub, f.teacher);
  assert.equal(grant.hidden, true);
  assert.equal(grant.publish, false);
  assert.equal(claims.video?.hidden, true);
  assert.equal(claims.video?.canPublish, false);
  assert.deepEqual(claims.video?.canPublishSources, []);
});

test("voice admission requires verified identity and current game membership", async () => {
  const f = fixture();
  f.state.authStatus = 401;
  await assert.rejects(
    f.voice.issue(f.room, f.token(), f.context),
    /UNAUTHORIZED/,
  );
  f.state.authStatus = 200;
  f.profiles.get(f.kid)!.is_active = false;
  await assert.rejects(
    f.voice.issue(f.room, f.token(), f.context),
    /FORBIDDEN/,
  );
  f.profiles.get(f.kid)!.is_active = true;
  f.setActor(null);
  await assert.rejects(
    f.voice.issue(f.room, f.token(), f.context),
    /NOT_IN_ROOM/,
  );
});

test("the voice API validates input, propagates errors without credentials, and issues direct tokens", async () => {
  const f = fixture(),
    events: unknown[] = [];
  const routes = schoolVoiceApi(f.voice, (name, context) =>
    events.push({ name, context }),
  );
  assert.deepEqual(Object.keys(routes), ["/api/voxel/voice-token"]);
  const handler = routes["/api/voxel/voice-token"]!;
  async function send(body: unknown, token: string | null = f.token()) {
    let status = 200,
      response = "";
    const req = {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    } as IncomingMessage;
    const res = {
      writeHead(code: number) {
        status = code;
      },
      end(body: string) {
        response = body;
      },
    } as unknown as ServerResponse;
    const value = await handler(req, body, res, f.context);
    return { status, value, response };
  }
  assert.equal((await send({ room: f.room })).status, 200);
  assert.equal((await send({ room: f.room }, null)).status, 401);
  for (const body of [
    null,
    [],
    {},
    { room: "invalid" },
    { room: f.room, publish: true },
  ])
    assert.equal((await send(body)).status, 400);
  f.setActor(null);
  assert.equal((await send({ room: f.room })).status, 403);
  f.state.authStatus = 503;
  const unavailable = await send({ room: f.room });
  assert.equal(unavailable.status, 503);
  assert.equal(JSON.parse(unavailable.response).error, "VOICE_UNAVAILABLE");
  assert.doesNotMatch(
    JSON.stringify(events),
    /fixture_signature|fixture-private|private-provider/,
  );
});

test("voice configuration requires secure endpoints and server credentials", () => {
  assert.equal(
    voiceConfig({
      LIVEKIT_URL: credentials.endpoint,
      LIVEKIT_API_KEY: credentials.key,
      LIVEKIT_API_SECRET: credentials.secret,
    }).endpoint,
    credentials.endpoint,
  );
  for (const endpoint of [
    "http://media.example",
    "wss://user:password@media.example",
    "wss://media.example?token=private",
  ])
    assert.throws(() =>
      voiceConfig({
        LIVEKIT_URL: endpoint,
        LIVEKIT_API_KEY: credentials.key,
        LIVEKIT_API_SECRET: credentials.secret,
      }),
    );
  assert.throws(() => voiceConfig({ LIVEKIT_URL: credentials.endpoint }));
});
