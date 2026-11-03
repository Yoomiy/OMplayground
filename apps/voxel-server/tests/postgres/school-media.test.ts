import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { TokenVerifier } from "livekit-server-sdk";
import { PostgresTestDatabase, literal } from "../helpers/postgres.ts";
import { supabaseWire } from "../helpers/supabase-wire.ts";
import { schoolSqlFixture } from "../helpers/school-sql-fixture.ts";
import {
  createSupabaseServerClient,
  SupabasePersistence,
} from "../../src/supabase-persistence.ts";
import { SupabaseSessions } from "../../src/supabase-sessions.ts";
import { SchoolVoice, schoolVoiceApi } from "../../src/school-voice.ts";
import { schoolGatewayPolicy } from "../../src/school-admission.ts";
import { createGateway } from "../../../../games/voxel/src/server/gateway.ts";
import { SocketProbe } from "../../../../games/voxel/tests/fixtures/socket-probe.ts";
import { readVoiceToken } from "../../../../games/voxel/src/shared/media.ts";
const db = new PostgresTestDatabase();
db.installSessionControls();
after(() => db.close());

test(
  "real game admission issues direct LiveKit tokens for participants and hidden staff",
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
      credentials = {
        endpoint: "wss://media.invalid",
        key: "local-test",
        secret: "local_media_test_secret_at_least_32_characters",
      },
      verifier = new TokenVerifier(credentials.key, credentials.secret),
      voice = new SchoolVoice(school.access, credentials),
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
      api: schoolVoiceApi(voice, () => {}),
    });
    assert(gateway.address && typeof gateway.address === "object");
    const origin = `http://127.0.0.1:${gateway.address.port}`,
      probes: SocketProbe[] = [];
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
    try {
      assert.equal((await post("voice-token", kid)).status, 403);
      assert.equal(gateway.rooms.size, 0);
      assert.equal(
        (await post("voice-token", kid, { publish: true })).status,
        400,
      );
      await join(kid);
      await join(teacher);
      for (const actor of [kid, teacher]) {
        const response = await post("voice-token", actor);
        assert.equal(response.status, 200);
        const grant = readVoiceToken(await response.json());
        assert(grant);
        const claims = await verifier.verify(grant.token);
        assert.equal(claims.sub, actor);
        assert.equal(claims.exp! - claims.nbf!, 7200);
        assert.equal(grant.serverUrl, credentials.endpoint);
        assert.equal(claims.video?.canPublish, actor === kid);
        assert.equal(claims.video?.hidden, actor === teacher);
      }
      assert.equal((await post("media-moderate", teacher)).status, 404);
      assert.equal((await post("media-state", teacher)).status, 404);
      assert.equal(
        (await fetch(origin + "/voxel-media/rtc/v1/validate")).status,
        404,
      );
    } finally {
      for (const probe of probes) probe.socket.terminate();
      await gateway.close();
      await wire.close();
    }
  },
);
