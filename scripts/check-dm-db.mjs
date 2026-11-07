// Run with an installed @electric-sql/pglite module path as the optional first argument.
// This exercises PostgreSQL behavior with a minimal schema, never a deployed database.
const { PGlite } = await import(process.argv[2] ?? "@electric-sql/pglite");
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.user_id',true),'')::uuid $$;
CREATE TYPE user_role AS ENUM ('kid','teacher');
CREATE TYPE gender_type AS ENUM ('boy','girl');
CREATE TABLE kid_profiles(id uuid PRIMARY KEY, full_name text, grade int, gender gender_type, role user_role, is_active boolean);
CREATE TABLE kid_blocks(blocker_id uuid, blocked_id uuid);
CREATE TABLE games(id uuid PRIMARY KEY, name_he text, is_active boolean, is_multiplayer boolean, for_gender text);
CREATE TABLE game_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),game_id uuid,host_id uuid,host_name text,host_grade int, player_ids uuid[],player_names text[], status text, is_open boolean, invitation_code text,gender gender_type,connected_player_ids uuid[] DEFAULT '{}', ended_at timestamptz);
CREATE TYPE game_challenge_status AS ENUM ('pending','accepted','declined','expired');
CREATE TABLE game_challenges(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),from_kid_id uuid,to_kid_id uuid,session_id uuid,game_id uuid,status game_challenge_status DEFAULT 'pending',created_at timestamptz DEFAULT now(),expires_at timestamptz DEFAULT now()+interval '2 minutes');
CREATE UNIQUE INDEX game_challenges_one_pending_per_recipient ON game_challenges(to_kid_id) WHERE status='pending';
CREATE FUNCTION append_audit_log(uuid,text,text,text,uuid,jsonb,text) RETURNS void LANGUAGE sql AS $$ SELECT $$;
INSERT INTO kid_profiles SELECT ('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'Player '||i,3,'boy','kid',true FROM generate_series(1,4) i;
INSERT INTO games VALUES ('10000000-0000-0000-0000-000000000001','Test',true,true,'both');
`);
await db.exec(`
CREATE TABLE auth.users(id uuid PRIMARY KEY);
INSERT INTO auth.users SELECT id FROM kid_profiles;
INSERT INTO auth.users VALUES('00000000-0000-0000-0000-000000000005');
CREATE TABLE admin_profiles(id uuid PRIMARY KEY,full_name text);
CREATE TABLE moderation_reports(reported_kid_id uuid);
CREATE TABLE private_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),from_kid_id uuid,from_display_name text,to_kid_id uuid,to_display_name text,sender_gender gender_type,content text,is_from_admin boolean DEFAULT false,is_read boolean DEFAULT false,created_at timestamptz DEFAULT now());
GRANT INSERT,UPDATE ON private_messages TO authenticated;
GRANT UPDATE(is_read) ON private_messages TO authenticated;
UPDATE kid_profiles SET role='teacher' WHERE id='00000000-0000-0000-0000-000000000004';
INSERT INTO admin_profiles VALUES('00000000-0000-0000-0000-000000000005','Admin');
UPDATE kid_profiles SET gender='girl' WHERE id='00000000-0000-0000-0000-000000000003';
`);
await db.exec(
  await readFile(
    new URL("../supabase/migrations/20261106120000_direct_messaging.sql", import.meta.url),
    "utf8",
  ),
);
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const user = async (n) => db.query("SELECT set_config('test.user_id',$1,false)", [id(n)]);
const send = async (to, text = "hello", nonce = crypto.randomUUID()) =>
  (await db.query("SELECT send_private_message($1,$2,$3) AS result", [id(to), text, nonce])).rows[0]
    .result;
await user(2);
await assert.rejects(() => send(4), /DM_NOT_ALLOWED/);
await user(4);
const nonce = crypto.randomUUID();
const first = await send(1, "hello", nonce);
assert.equal(first.sender_role, "teacher");
assert.equal((await send(1, "hello", nonce)).id, first.id);
await assert.rejects(() => send(1, "different", nonce), /REQUEST_MISMATCH/);
await assert.rejects(() => send(3), /DM_NOT_ALLOWED/);
await user(1);
await send(4, "reply");
await assert.rejects(() => send(4, "x".repeat(301)), /INVALID_MESSAGE/);
await user(2);
await assert.rejects(() => db.query("SELECT get_private_thread($1)", [id(4)]), /DM_NOT_AVAILABLE/);
await user(5);
await send(1);
await send(3);
await assert.rejects(() => send(4), /DM_NOT_ALLOWED/);
await user(1);
await send(5, "reply to admin");
await db.exec("DELETE FROM admin_profiles");
await assert.rejects(() => send(5), /DM_NOT_ALLOWED/);
const retired = (await db.query("SELECT get_private_thread($1) AS result", [id(5)])).rows[0].result;
assert.equal(retired.partner.can_send, false);
await db.exec(`INSERT INTO admin_profiles VALUES('${id(5)}','Admin')`);
await user(2);
await assert.rejects(() => send(5), /DM_NOT_ALLOWED/);
await user(4);
await db.query("INSERT INTO kid_blocks VALUES($1,$2)", [id(1), id(4)]);
await assert.rejects(() => send(1), /DM_NOT_ALLOWED/);
await db.query("DELETE FROM kid_blocks");
await db.exec(
  `INSERT INTO private_messages(from_kid_id,to_kid_id,from_display_name,to_display_name,content,is_from_admin) VALUES(NULL,'${id(1)}','Admin','Kid','notice',true);`,
);
await user(1);
const notice = (await db.query("SELECT get_private_thread('__admin__') AS result")).rows[0].result;
assert.equal(notice.partner.can_send, false);
await db.query("SELECT mark_private_messages_read($1)", [[notice.messages[0].id, first.id]]);
assert.equal(
  (await db.query("SELECT is_read FROM private_messages WHERE id=$1", [first.id])).rows[0].is_read,
  true,
);
await db.exec("SET ROLE authenticated");
await assert.rejects(
  () => db.query("INSERT INTO private_messages(content) VALUES($1)", ["forged"]),
  /permission denied/,
);
await assert.rejects(
  () => db.query("UPDATE private_messages SET is_read=true"),
  /permission denied/,
);
await db.exec("RESET ROLE");
await db.exec(`INSERT INTO private_messages(from_kid_id,to_kid_id,from_display_name,to_display_name,content,sender_role,created_at)
SELECT '${id(4)}','${id(1)}','Teacher','Kid','history','teacher',now()-make_interval(secs=>i) FROM generate_series(1,75)i;`);
const page = (await db.query("SELECT get_private_thread($1) AS result", [id(4)])).rows[0].result;
assert.equal(page.messages.length, 51);
const cursor = page.messages[49];
const next = (
  await db.query("SELECT get_private_thread($1,$2,$3) AS result", [
    id(4),
    cursor.created_at,
    cursor.id,
  ])
).rows[0].result;
assert.ok(next.messages.length > 0);
assert.ok(!next.messages.some((m) => page.messages.slice(0, 50).some((p) => p.id === m.id)));
const summary = (await db.query("SELECT list_private_threads() AS result")).rows[0].result;
assert.equal(summary.unread_total, 76);
console.log(
  "PASS: DM migration, staff initiation/replies, visibility, identity, idempotency, size, blocks, legacy notices, read grants, pagination and unread totals",
);
await db.close();
