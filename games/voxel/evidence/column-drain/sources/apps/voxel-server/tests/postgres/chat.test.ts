import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { once } from "node:events";
import { PostgresTestDatabase, literal } from "../helpers/postgres.ts";
import { supabaseWire } from "../helpers/supabase-wire.ts";
import { schoolSqlFixture } from "../helpers/school-sql-fixture.ts";
import {
  createSupabaseServerClient,
  SupabasePersistence,
} from "../../src/supabase-persistence.ts";
import { SupabaseChat, schoolChatApi } from "../../src/school-chat.ts";
import { SupabaseSessions } from "../../src/supabase-sessions.ts";
import { schoolGatewayPolicy } from "../../src/school-admission.ts";
import { createGateway } from "../../../../games/voxel/src/server/gateway.ts";
import { SocketProbe } from "../../../../games/voxel/tests/fixtures/socket-probe.ts";
const db = new PostgresTestDatabase();
db.installSessionControls();
after(() => db.close());
const until = () => new Date(Date.now() + 4500).toISOString();
function fixture() {
  const room = db.session(),
    kid = randomUUID(),
    peer = randomUUID(),
    teacher = randomUUID(),
    game = randomUUID();
  db.exec(`INSERT INTO public.games(id,game_url) VALUES(${literal(game)},'minecraft');
    INSERT INTO public.kid_profiles(id,full_name,gender,grade,role) VALUES
    (${literal(kid)},'שם מהשרת','boy','ג','kid'),(${literal(peer)},'Peer','boy','ג','kid'),(${literal(teacher)},'Teacher','girl',NULL,'teacher');
    UPDATE public.game_sessions SET game_id=${literal(game)},host_id=${literal(kid)},gender='boy',status='playing',
      player_ids=ARRAY[${literal(kid)},${literal(peer)}]::uuid[],player_names=ARRAY['Kid','Peer'] WHERE id=${literal(room)}`);
  const lease = db.rpc("voxel_acquire_room", {
      p_session: room,
      p_owner: randomUUID(),
    }),
    own = {
      p_session: room,
      p_world: lease.worldId,
      p_owner: lease.owner,
      p_epoch: lease.epoch,
    };
  assert.equal(db.rpc("voxel_initialize_session", own), true);
  const sendArgs = (
    message = "שלום",
    id: string = randomUUID(),
    actor = kid,
  ) => ({
    ...own,
    p_actor: actor,
    p_revision: 0,
    p_request: id,
    p_message: message,
    p_authorized_until: until(),
  });
  const send = (message = "שלום", id: string = randomUUID()) =>
    db.rpc("voxel_chat_send", sendArgs(message, id));
  const history = (actor = kid, before: number | null = null) =>
    db.rpc("voxel_chat_history", {
      p_session: room,
      p_actor: actor,
      p_before: before,
      p_authorized_until: until(),
    });
  const moderate = (
    action = "delete",
    target: string | null = null,
    id: string = randomUUID(),
    actor = teacher,
  ) =>
    db.rpc("voxel_chat_moderate", {
      p_session: room,
      p_actor: actor,
      p_request: id,
      p_action: action,
      p_target: target,
      p_authorized_until: until(),
    });
  return {
    room,
    kid,
    peer,
    teacher,
    game,
    own,
    sendArgs,
    send,
    history,
    moderate,
  };
}
test("chat commits one canonical named message per request and rejects changed-content or actor replay", async () => {
  const f = fixture(),
    id = randomUUID(),
    first = f.send("שלום <b>עולם</b>", id);
  assert.deepEqual(first, {
    requestId: id,
    action: "send",
    messageId: id,
    applied: true,
    persisted: true,
  });
  assert.deepEqual(f.send("שלום <b>עולם</b>", id), first);
  assert.throws(() => f.send("changed", id), /conflict/);
  assert.throws(
    () => db.rpc("voxel_chat_send", f.sendArgs("שלום <b>עולם</b>", id, f.peer)),
    /conflict/,
  );
  assert.equal(f.history().messages[0].senderName, "שם מהשרת");
  assert.equal(f.history().messages[0].message, "שלום <b>עולם</b>");
  const requests = await Promise.all([
    db.rpcAsync("voxel_chat_send", f.sendArgs("שנייה")),
    db.rpcAsync("voxel_chat_send", f.sendArgs("שלישית")),
  ]);
  assert.equal(requests.length, 2);
  assert.deepEqual(
    f.history().messages.map((m: any) => m.sequence),
    [1, 2, 3],
  );
  for (const text of ["", "a".repeat(501)])
    assert.throws(() => f.send(text), /invalid/);
  assert.equal(f.send("🙂".repeat(500)).persisted, true);
  for (const text of ["\n\t", "bad\u0001"])
    assert.throws(() => f.send(text), /invalid/);
});
test("chat posting tolerates a paused world but rejects expired or replaced owner authority", () => {
  const f = fixture();
  db.exec(
    `UPDATE public.voxel_session_controls SET desired_state='paused' WHERE session_id=${literal(f.room)}`,
  );
  assert.equal(f.send("paused conversation").persisted, true);
  const old = f.sendArgs();
  db.rpc("voxel_release_room", f.own);
  assert.throws(() => db.rpc("voxel_chat_send", old), /unavailable/);
  db.rpc("voxel_acquire_room", { p_session: f.room, p_owner: randomUUID() });
  assert.throws(() => db.rpc("voxel_chat_send", f.sendArgs()), /unavailable/);
});
test("chat delete and clear are audited once; retrying an earlier clear cannot erase later messages", () => {
  const f = fixture(),
    a = f.send(),
    b = f.send("two"),
    deleteId = randomUUID(),
    clearId = randomUUID();
  f.moderate("delete", a.messageId, deleteId);
  f.moderate("delete", a.messageId, deleteId);
  assert.deepEqual(
    f.history().messages.map((m: any) => m.id),
    [b.messageId],
  );
  const cleared = f.moderate("clear", null, clearId);
  assert.equal(f.history().messages.length, 0);
  const later = f.send("later");
  assert.deepEqual(f.moderate("clear", null, clearId), cleared);
  assert.deepEqual(
    f.history().messages.map((m: any) => m.id),
    [later.messageId],
  );
  assert.throws(() => f.moderate("delete", randomUUID()), /unavailable/);
  assert.throws(
    () => f.moderate("clear", null, randomUUID(), f.kid),
    /forbidden/,
  );
  const other = fixture();
  assert.throws(() => other.moderate("delete", later.messageId), /unavailable/);
  assert.equal(
    db.value(
      `SELECT count(*) FROM public.audit_log WHERE entity_id=${literal(f.room)} AND action LIKE 'VOXEL_CHAT_%'`,
    ),
    2,
  );
  assert.doesNotMatch(
    JSON.stringify(
      db.value(
        `SELECT jsonb_agg(metadata) FROM public.audit_log WHERE entity_id=${literal(f.room)}`,
      ),
    ),
    /later|שלום/,
  );
});
test("chat keyset pages expose recent messages and support older history without a persisted-message cap", () => {
  const f = fixture();
  db.exec(`INSERT INTO public.voxel_chat_messages(session_id,id,sequence,sender_id,sender_name,message)
    SELECT ${literal(f.room)},gen_random_uuid(),i,${literal(f.kid)},'Kid',i::text FROM generate_series(1,205) i`);
  const last = f.history();
  assert.equal(last.messages.length, 100);
  assert.equal(last.before, 106);
  const middle = f.history(f.teacher, last.before);
  assert.equal(middle.messages.length, 100);
  assert.equal(middle.before, 6);
  const first = f.history(f.kid, middle.before);
  assert.equal(first.messages.length, 5);
  assert.equal(first.before, null);
  assert.equal(f.send("still allowed").persisted, true);
  assert.equal(f.history().messages.at(-1).sequence, 206);
});
test("chat locks recheck student cutoff, live owner, role precedence and terminal write policy", () => {
  const f = fixture(),
    old = f.sendArgs();
  db.rpc("voxel_moderate", {
    p_session: f.room,
    p_actor: f.teacher,
    p_target: f.kid,
    p_request: randomUUID(),
    p_action: "remove",
    p_authorized_until: until(),
  });
  assert.throws(() => f.history(), /forbidden/);
  assert.throws(() => db.rpc("voxel_chat_send", old), /forbidden/);
  assert.equal(
    db.rpc("voxel_accept_member_revision", {
      ...f.own,
      p_actor: f.kid,
      p_revision: 1,
      p_authorized_until: until(),
    }),
    true,
  );
  assert.throws(
    () => db.rpc("voxel_chat_send", { ...f.sendArgs(), p_revision: 0 }),
    /unavailable/,
  );
  assert.equal(
    db.rpc("voxel_chat_send", { ...f.sendArgs(), p_revision: 1 }).persisted,
    true,
  );
  db.exec(
    `INSERT INTO public.admin_profiles VALUES(${literal(f.teacher)});UPDATE public.kid_profiles SET is_active=false WHERE id=${literal(f.teacher)}`,
  );
  assert.throws(() => f.history(f.teacher), /forbidden/);
  assert.throws(() => f.moderate("clear"), /forbidden/);
  db.exec(
    `UPDATE public.kid_profiles SET is_active=true WHERE id=${literal(f.teacher)};UPDATE public.game_sessions SET status='completed' WHERE id=${literal(f.room)}`,
  );
  assert.throws(
    () => db.rpc("voxel_chat_send", { ...f.sendArgs(), p_revision: 1 }),
    /unavailable/,
  );
  assert.equal(f.history().messages.length, 1);
  assert.equal(f.moderate("clear").persisted, true);
  db.rpc("voxel_release_room", f.own);
  assert.throws(
    () => db.rpc("voxel_chat_send", { ...f.sendArgs(), p_revision: 1 }),
    /unavailable/,
  );
});
test("chat denies direct table access and private helper use; staff can inspect an unallocated room without allocation", () => {
  const f = fixture();
  for (const role of ["anon", "authenticated", "service_role"]) {
    for (const table of ["voxel_chat_messages", "voxel_chat_requests"])
      assert.throws(
        () => db.exec(`SELECT * FROM public.${table}`, role),
        /permission denied/,
      );
    assert.throws(
      () =>
        db.exec(
          `SELECT public.voxel_chat_authorize(${literal(f.room)},${literal(f.kid)},clock_timestamp()+interval '1 second')`,
          role,
        ),
      /permission denied/,
    );
  }
  for (const role of ["anon", "authenticated"])
    assert.throws(
      () =>
        db.rpc(
          "voxel_chat_history",
          {
            p_session: f.room,
            p_actor: f.kid,
            p_before: null,
            p_authorized_until: until(),
          },
          role,
        ),
      /permission denied/,
    );
  const room = db.session();
  db.exec(
    `UPDATE public.game_sessions SET game_id=${literal(f.game)},gender='boy' WHERE id=${literal(room)}`,
  );
  assert.deepEqual(
    db.rpc("voxel_chat_history", {
      p_session: room,
      p_actor: f.teacher,
      p_before: null,
      p_authorized_until: until(),
    }),
    { messages: [], before: null },
  );
  assert.equal(
    db.value(
      `SELECT count(*) FROM public.voxel_worlds WHERE session_id=${literal(room)}`,
    ),
    0,
  );
  assert.throws(
    () =>
      db.rpc("voxel_chat_history", {
        p_session: room,
        p_actor: f.kid,
        p_before: null,
        p_authorized_until: until(),
      }),
    /forbidden/,
  );
});
test("chat expiry after a session lock or audit wait rolls back messages and moderation", async () => {
  const f = fixture(),
    key = Math.floor(Math.random() * 1e6) + 1;
  const lock = db.execAsync(
    `BEGIN;SELECT id FROM public.game_sessions WHERE id=${literal(f.room)} FOR UPDATE;SELECT pg_advisory_xact_lock(${key});SELECT pg_sleep(0.2);COMMIT;`,
  );
  await db.waitForAdvisory(key);
  await assert.rejects(
    db.rpcAsync("voxel_chat_send", {
      ...f.sendArgs(),
      p_authorized_until: new Date(Date.now() + 80).toISOString(),
    }),
    /forbidden|expired/,
  );
  await lock;
  assert.equal(f.history().messages.length, 0);
  f.send();
  db.exec(`CREATE FUNCTION public.slow_chat_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(0.15);RETURN NEW;END $$;
    CREATE TRIGGER slow_chat_audit BEFORE INSERT ON public.audit_log FOR EACH ROW EXECUTE FUNCTION public.slow_chat_audit();`);
  try {
    await assert.rejects(
      db.rpcAsync("voxel_chat_moderate", {
        p_session: f.room,
        p_actor: f.teacher,
        p_request: randomUUID(),
        p_action: "clear",
        p_target: null,
        p_authorized_until: new Date(Date.now() + 80).toISOString(),
      }),
      /expired/,
    );
    assert.equal(f.history().messages.length, 1);
    assert.equal(
      db.value(
        `SELECT count(*) FROM public.audit_log WHERE entity_id=${literal(f.room)}`,
      ),
      0,
    );
  } finally {
    db.exec(
      "DROP TRIGGER slow_chat_audit ON public.audit_log;DROP FUNCTION public.slow_chat_audit()",
    );
  }
});
test("real SDK/native worker chat requires a live participant, recovers one lost write and supports hidden staff moderation", async () => {
  const f = fixture();
  // A formerly participating teacher remains on the roster. Their current
  // hidden connection must still be read-only even though SQL membership fits.
  db.exec(`UPDATE public.kid_profiles SET gender='boy' WHERE id=${literal(f.teacher)};
    UPDATE public.game_sessions SET player_ids=array_append(player_ids,${literal(f.teacher)}::uuid),
      player_names=array_append(player_names,'Teacher') WHERE id=${literal(f.room)}`);
  db.rpc("voxel_release_room", f.own);
  const wire = await supabaseWire(db),
    client = createSupabaseServerClient({
      SUPABASE_URL: wire.origin,
      SUPABASE_SECRET_KEY: wire.secret,
    }),
    school = schoolSqlFixture(db, f.room, [f.kid, f.teacher]),
    backend = new SupabasePersistence(client),
    sessions = new SupabaseSessions(client),
    chat = new SupabaseChat(client),
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
    ...schoolGatewayPolicy(school.access, sessions),
    persistence: { objects: backend, metadata: backend },
    api: schoolChatApi(school.access, chat, (name, context) =>
      events.push({ name, context }),
    ),
  });
  assert(gateway.address && typeof gateway.address === "object");
  const origin = `http://127.0.0.1:${gateway.address.port}`,
    probes: SocketProbe[] = [];
  const post = (path: string, actor: string, body: unknown) =>
    fetch(origin + "/api/voxel/" + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + school.token(actor),
      },
      body: JSON.stringify({ room: f.room, ...(body as object) }),
    });
  const connect = async (actor: string) => {
    const r = await post("admission", actor, {});
    assert.equal(r.status, 200);
    const p = new SocketProbe(
      origin.replace(/^http/, "ws") + "/voxel",
      content.blocks.length,
    );
    probes.push(p);
    await once(p.socket, "open");
    p.send({ type: "hello", ...(await r.json()) });
    await p.ready();
    return p;
  };
  try {
    await chat.verifyInstallation();
    assert.equal(
      (
        await post("chat-send", f.kid, {
          requestId: randomUUID(),
          message: "offline",
        })
      ).status,
      403,
    );
    assert.equal(gateway.rooms.size, 0);
    assert.equal(
      (await post("chat-history", f.teacher, { before: null })).status,
      200,
    );
    assert.equal(gateway.rooms.size, 0);
    await connect(f.teacher);
    const child = await connect(f.kid);
    const hidden = await post("chat-send", f.teacher, {
      requestId: randomUUID(),
      message: "hidden",
    });
    assert.equal(hidden.status, 403);
    assert.equal((await hidden.json()).error, "NOT_IN_ROOM");
    const id = randomUUID();
    wire.control.loseChatResponse = true;
    assert.equal(
      (
        await post("chat-send", f.kid, {
          requestId: id,
          message: "שלום מהדפדפן",
        })
      ).status,
      503,
    );
    const sent = await post("chat-send", f.kid, {
      requestId: id,
      message: "שלום מהדפדפן",
    });
    assert.equal(sent.status, 200);
    assert.equal(f.history().messages.length, 1);
    const clearId = randomUUID();
    wire.control.loseChatResponse = true;
    assert.equal(
      (
        await post("chat-moderate", f.teacher, {
          requestId: clearId,
          action: "clear",
          target: null,
        })
      ).status,
      503,
    );
    assert.equal(
      (
        await post("chat-moderate", f.teacher, {
          requestId: clearId,
          action: "clear",
          target: null,
        })
      ).status,
      200,
    );
    assert.equal(f.history().messages.length, 0);
    assert.doesNotMatch(JSON.stringify(events), /שלום מהדפדפן|sb_secret/);
    child.socket.terminate();
    await once(child.socket, "close");
    assert.equal(
      (
        await post("chat-send", f.kid, {
          requestId: randomUUID(),
          message: "after leave",
        })
      ).status,
      403,
    );
  } finally {
    for (const p of probes) p.socket.terminate();
    await gateway.close();
    await wire.close();
  }
});
