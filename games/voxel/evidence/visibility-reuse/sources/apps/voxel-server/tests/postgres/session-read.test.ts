import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { PostgresTestDatabase, literal } from "../helpers/postgres.ts";
import { schoolSqlFixture } from "../helpers/school-sql-fixture.ts";
import { supabaseWire } from "../helpers/supabase-wire.ts";
import { createSupabaseServerClient } from "../../src/supabase-persistence.ts";
import { schoolSessionApi } from "../../src/school-session.ts";
import { schoolGatewayPolicy } from "../../src/school-admission.ts";
import { createGateway } from "../../../../games/voxel/src/server/gateway.ts";
const db = new PostgresTestDatabase();
db.installSessionControls();
after(() => db.close());
test("scoped session API reads real metadata across staff partitions and completed rosters without allocating or exposing diagnostic payloads", async () => {
  const room = db.session(),
    host = randomUUID(),
    guest = randomUUID(),
    teacher = randomUUID(),
    game = randomUUID();
  db.exec(
    `INSERT INTO public.games(id,game_url) VALUES(${literal(game)},'minecraft');INSERT INTO public.kid_profiles(id,full_name,gender,grade,role) VALUES(${literal(host)},'Host','boy','ג','kid'),(${literal(guest)},'Guest','boy','ג','kid'),(${literal(teacher)},'Teacher','girl',NULL,'teacher');UPDATE public.game_sessions SET game_id=${literal(game)},host_id=${literal(host)},host_name='Host',gender='boy',status='playing',player_ids=ARRAY[${literal(host)}]::uuid[],player_names=ARRAY['Host'],connected_player_ids=ARRAY[${literal(host)}]::uuid[],connected_player_names=ARRAY['Host'] WHERE id=${literal(room)}`,
  );
  const wire = await supabaseWire(db),
    client = createSupabaseServerClient({
      SUPABASE_URL: wire.origin,
      SUPABASE_SECRET_KEY: wire.secret,
    }),
    school = schoolSqlFixture(db, room, [host, guest, teacher]),
    events: unknown[] = [];
  const build = JSON.parse(
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
    ...schoolGatewayPolicy(school.access),
    api: schoolSessionApi(school.access, client, (event, context) =>
      events.push({ event, context }),
    ),
  });
  assert.ok(gateway.address && typeof gateway.address === "object");
  const origin = `http://127.0.0.1:${gateway.address.port}`;
  const post = async (
    actor: string,
    path = "session",
    data: unknown = { room },
  ) => {
    const response = await fetch(origin + "/api/voxel/" + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + school.token(actor),
      },
      body: JSON.stringify(data),
    });
    return {
      status: response.status,
      data: (await response.json()) as Record<string, unknown>,
    };
  };
  try {
    const staff = await post(teacher);
    assert.equal(staff.status, 200);
    assert.equal(staff.data.host_id, host);
    assert.deepEqual(staff.data.connected_player_ids, [host]);
    assert.equal(Object.keys(staff.data).length, 7);
    assert.equal(gateway.rooms.size, 0);
    db.exec(
      `UPDATE public.game_sessions SET status='completed' WHERE id=${literal(room)}`,
    );
    assert.equal((await post(host)).status, 200);
    assert.equal((await post(teacher)).status, 200);
    assert.equal((await post(guest)).status, 403);
    const diagnostic = {
      room,
      operation: "replication",
      code: "RUNTIME_FAILURE",
      buildId: null,
      correlationId: randomUUID(),
    };
    assert.equal((await post(teacher, "diagnostics", diagnostic)).status, 200);
    assert.equal(events.length, 1);
    assert.doesNotMatch(
      JSON.stringify(events),
      /fixture_signature|sb_secret_|Teacher/,
    );
    assert.equal(
      (
        await post(teacher, "diagnostics", {
          ...diagnostic,
          token: "untrusted",
        })
      ).status,
      400,
    );
    assert.equal(events.length, 1);
    assert.equal(gateway.rooms.size, 0);
  } finally {
    await gateway.close();
    await wire.close();
  }
});
