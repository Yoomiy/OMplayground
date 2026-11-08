// Run with an installed @electric-sql/pglite module path as the optional first argument.
// This exercises PostgreSQL behavior with a minimal schema, never a deployed database.
const { PGlite } = await import(process.argv[2] ?? '@electric-sql/pglite');
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db = new PGlite();
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.user_id',true),'')::uuid $$;
CREATE TYPE user_role AS ENUM ('kid','teacher','admin');
CREATE TYPE gender_type AS ENUM ('boy','girl');
CREATE TABLE kid_profiles(id uuid PRIMARY KEY, full_name text, grade int, gender gender_type, role user_role, is_active boolean);
CREATE TABLE kid_blocks(blocker_id uuid, blocked_id uuid);
CREATE TABLE games(id uuid PRIMARY KEY, name_he text, is_active boolean, is_multiplayer boolean, for_gender text);
CREATE TABLE game_sessions(game_state jsonb DEFAULT '{}',classroom_id uuid,id uuid PRIMARY KEY DEFAULT gen_random_uuid(),game_id uuid,host_id uuid,host_name text,host_grade int, player_ids uuid[],player_names text[], status text, is_open boolean, invitation_code text,gender gender_type,connected_player_ids uuid[] DEFAULT '{}', connected_player_names text[] DEFAULT '{}', ended_at timestamptz);
CREATE TABLE voxel_worlds(session_id uuid PRIMARY KEY);
CREATE TYPE game_challenge_status AS ENUM ('pending','accepted','declined','expired');
CREATE TABLE game_challenges(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),from_kid_id uuid,to_kid_id uuid,session_id uuid,game_id uuid,status game_challenge_status DEFAULT 'pending',created_at timestamptz DEFAULT now(),expires_at timestamptz DEFAULT now()+interval '2 minutes');
CREATE UNIQUE INDEX game_challenges_one_pending_per_recipient ON game_challenges(to_kid_id) WHERE status='pending';
CREATE FUNCTION append_audit_log(uuid,text,text,text,uuid,jsonb,text) RETURNS void LANGUAGE sql AS $$ SELECT $$;
INSERT INTO kid_profiles SELECT ('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'Player '||i,3,'boy','kid',true FROM generate_series(1,4) i;
INSERT INTO games VALUES ('10000000-0000-0000-0000-000000000001','Test',true,true,'both');
`);
await db.exec(await readFile(new URL('../supabase/migrations/20261105140000_challenge_lifecycle.sql', import.meta.url),'utf8'));
await db.exec(await readFile(new URL('../supabase/migrations/20261107120000_challenge_participant_presence.sql', import.meta.url),'utf8'));
await db.exec(await readFile(new URL('../supabase/migrations/20261107140000_challenge_entry_navigation.sql', import.meta.url),'utf8'));
// Include the production guard: omitting it previously hid the cancellation HTTP 400.
await db.exec("CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT false $$");
const security = await readFile(new URL('../supabase/migrations/20260824113504_classroom_owned_drawing_sessions.sql', import.meta.url),'utf8');
const guard = security.match(/CREATE OR REPLACE FUNCTION public\.guard_game_sessions_authoritative_columns[\s\S]*?\$\$;/)[0];
await db.exec(guard);
const voxelSecurity=await readFile(new URL('../supabase/migrations/20261025020000_voxel_session_projection.sql', import.meta.url),'utf8');
await db.exec(voxelSecurity.match(/CREATE FUNCTION public\.voxel_guard_session_write[\s\S]*?\$\$;/)[0]);
await db.exec('CREATE TRIGGER voxel_session_authoritative_write BEFORE UPDATE OR DELETE ON game_sessions FOR EACH ROW EXECUTE FUNCTION voxel_guard_session_write()');
await db.exec(`CREATE TRIGGER game_sessions_guard_authoritative BEFORE UPDATE ON game_sessions FOR EACH ROW EXECUTE FUNCTION guard_game_sessions_authoritative_columns();
GRANT USAGE ON SCHEMA public,auth TO authenticated,service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT UPDATE ON game_sessions TO authenticated;
SET ROLE authenticated;`);
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const user=async n=>db.query("SELECT set_config('test.user_id',$1,false)",[id(n)]);
const send=async n=>(await db.query('SELECT create_game_challenge($1,$2) AS result',[id(n),'10000000-0000-0000-0000-000000000001'])).rows[0].result;
const respond=(challenge,action)=>db.query('SELECT respond_game_challenge($1,$2)',[challenge,action]);
const list=async()=>(await db.query('SELECT list_game_challenges() AS result')).rows[0].result;
const service=async(sql,args=[])=>{
 await db.exec('BEGIN; SET LOCAL ROLE service_role;');
 try {const result=await db.query(sql,args);await db.exec('COMMIT');return result;}
 catch(error){await db.exec('ROLLBACK');throw error;}
};
await user(1);const legacy=await send(3);
await assert.rejects(()=>respond(legacy.challenge_id,'cancel'),/game_sessions_authoritative_field/);
// Hosted migration roles are not superusers. Apply the patch with equivalent restrictions.
await db.exec(`RESET ROLE;
CREATE ROLE migration_owner NOSUPERUSER;
GRANT CREATE,USAGE ON SCHEMA public TO migration_owner;
GRANT USAGE ON SCHEMA auth TO migration_owner;
DO $$ DECLARE obj record; BEGIN
 FOR obj IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
   EXECUTE format('ALTER TABLE public.%I OWNER TO migration_owner',obj.tablename);
 END LOOP;
 FOR obj IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace LOOP
   EXECUTE format('ALTER FUNCTION %s OWNER TO migration_owner',obj.signature);
 END LOOP;
END $$;
SET ROLE migration_owner;`);
await assert.rejects(()=>db.exec("CREATE FUNCTION migration_setting_probe() RETURNS void LANGUAGE sql SET playground.allow_game_session_authority_write='true' AS $$ SELECT $$"),/permission denied to set parameter/);
await db.exec(await readFile(new URL('../supabase/migrations/20261108100000_challenge_resolution.sql', import.meta.url),'utf8'));
await db.exec('SET ROLE authenticated; BEGIN');
await respond(legacy.challenge_id,'cancel');
// Check before COMMIT: a transaction-local flag must not leak into subsequent statements.
assert.notEqual((await db.query("SELECT current_setting('playground.allow_game_session_authority_write',true) AS value")).rows[0].value,'true');
await db.exec('COMMIT');
assert.equal((await list()).length,0);
assert.equal((await db.query('SELECT status FROM game_sessions WHERE id=$1',[legacy.session_id])).rows[0].status,'completed');
await respond(legacy.challenge_id,'cancel'); // repeated cancellation is idempotent
await assert.rejects(()=>db.query("UPDATE game_sessions SET status='playing' WHERE id=$1",[legacy.session_id]),/game_sessions_authoritative_field/);
assert.notEqual((await db.query("SELECT current_setting('playground.allow_game_session_authority_write',true) AS value")).rows[0].value,'true');
console.log('PASS: restricted-role migration, reproduced DDL permission error, cancellation fix, same-transaction setting restoration and direct-write protection');

// Multiple invitations remain independent. Every removal resolves the invitation for both users.
await user(1);const removed=await send(3);assert.deepEqual(await send(3),removed);
await user(2);const b=await send(3);
await user(3);assert.equal((await list()).length,2);
await db.query('SELECT resolve_game_challenges($1)',[[removed.challenge_id]]);
assert.deepEqual((await list()).map(row=>row.id),[b.challenge_id]);
await user(1);assert.ok(!(await list()).some(row=>row.id===removed.challenge_id));
assert.equal((await db.query('SELECT status FROM game_challenges WHERE id=$1',[removed.challenge_id])).rows[0].status,'declined');
await user(4);await assert.rejects(()=>respond(b.challenge_id,'decline'),/CHALLENGE_NOT_FOUND/);
assert.equal((await db.query('SELECT resolve_game_challenges($1) AS n',[[b.challenge_id]])).rows[0].n,0);
await user(1);const a=await send(3);

// Accepted invitations survive a missed redirect and an expired countdown, until both players enter together.
await user(3);await respond(a.challenge_id,'accept');await respond(a.challenge_id,'accept');
assert.ok((await list()).some(row=>row.id===a.challenge_id));
await service("UPDATE game_challenges SET expires_at=now()-interval '1 hour' WHERE id=$1",[a.challenge_id]);
await service("UPDATE game_sessions SET connected_player_ids=ARRAY[$1::uuid] WHERE id=$2",[id(1),a.session_id]);
assert.ok((await list()).some(row=>row.id===a.challenge_id));
await service("UPDATE game_sessions SET connected_player_ids='{}' WHERE id=$1",[a.session_id]);
assert.equal((await list()).find(row=>row.id===a.challenge_id).partner_in_session,false);
await service("UPDATE game_sessions SET connected_player_ids=ARRAY[$1::uuid,$2::uuid] WHERE id=$3",[id(1),id(3),a.session_id]);
assert.ok(!(await list()).some(row=>row.id===a.challenge_id));
assert.ok((await db.query('SELECT fulfilled_at FROM game_challenges WHERE id=$1',[a.challenge_id])).rows[0].fulfilled_at);
await service("UPDATE game_sessions SET connected_player_ids='{}' WHERE id=$1",[a.session_id]);
assert.ok(!(await list()).some(row=>row.id===a.challenge_id)); // no history and no reappearance on exit
await user(1);assert.ok(!(await list()).some(row=>row.id===a.challenge_id));
// Retain the accepted access record after fulfilling the invitation.
assert.equal((await db.query('SELECT status FROM game_challenges WHERE id=$1',[a.challenge_id])).rows[0].status,'accepted');

// Either participant can withdraw at every phase, even after acceptance or fulfillment.
for(const phase of ['waiting','playing','paused','completed']) {
 for(const actor of [1,3]) {
  await user(1);const c=await send(3);await user(3);await respond(c.challenge_id,'accept');
  await service("UPDATE game_sessions SET status=$1,connected_player_ids=ARRAY[$2::uuid] WHERE id=$3",[phase,id(3),c.session_id]);
  await user(actor);await respond(c.challenge_id,actor===1?'cancel':'decline');
  const withdrawn=(await db.query('SELECT * FROM game_challenges WHERE id=$1',[c.challenge_id])).rows[0];
  assert.equal(withdrawn.withdrawn_by,id(actor));assert.equal(withdrawn.withdrawn_phase,phase);
  const room=(await db.query('SELECT status FROM game_sessions WHERE id=$1',[c.session_id])).rows[0];
  assert.equal(room.status,phase==='waiting'?'completed':phase); // never pretend to stop a running runtime in SQL
  assert.ok(!(await list()).some(row=>row.id===c.challenge_id));
  const departure=(await db.query('SELECT challenge_departure($1) AS result',[c.session_id])).rows[0].result;
  assert.equal(departure.actor,id(actor));
  await user(actor===1?3:1);
  const peerDeparture=(await db.query('SELECT challenge_departure($1) AS result',[c.session_id])).rows[0].result;
  assert.equal(!!peerDeparture,phase==='waiting');
  await service("UPDATE game_sessions SET connected_player_ids='{}' WHERE id=$1",[c.session_id]);
 }
}

// Expiration closes an unstarted room even when its sender entered and is still waiting.
await user(1);const expired=await send(4);
await service("UPDATE game_sessions SET connected_player_ids=ARRAY[$1::uuid] WHERE id=$2",[id(1),expired.session_id]);
await service("UPDATE game_challenges SET expires_at=now()-interval '1 minute' WHERE id=$1",[expired.challenge_id]);
await list();
assert.equal((await db.query('SELECT status FROM game_sessions WHERE id=$1',[expired.session_id])).rows[0].status,'completed');
assert.equal((await db.query('SELECT challenge_departure($1) AS result',[expired.session_id])).rows[0].result.closed_room,true);

// Entry switching retains the old invitation and works through the real authoritative-field guard.
await user(1);const target=await send(4);await user(4);await respond(target.challenge_id,'accept');
await user(1);const old=await send(2);
await service("UPDATE game_sessions SET connected_player_ids=ARRAY[$1::uuid],connected_player_names=ARRAY['Player 1'] WHERE id=$2",[id(1),old.session_id]);
assert.equal((await db.query('SELECT prepare_challenge_entry($1,$2) AS id',[target.challenge_id,old.session_id])).rows[0].id,target.session_id);
assert.equal((await db.query('SELECT status FROM game_challenges WHERE id=$1',[old.challenge_id])).rows[0].status,'pending');
await service("UPDATE game_sessions SET status='playing' WHERE id=$1",[old.session_id]);
await assert.rejects(()=>db.query('SELECT prepare_challenge_entry($1,$2)',[target.challenge_id,old.session_id]),/CURRENT_GAME_STARTED/);
await service("UPDATE game_sessions SET status='paused' WHERE id=$1",[old.session_id]);
await db.query('SELECT prepare_challenge_entry($1,$2)',[target.challenge_id,old.session_id]);

// Clean a snapshot, not new invitations that arrive while the request is pending.
await user(1);const snapshot=(await list()).map(row=>row.id);const later=await send(3);
await db.query('SELECT resolve_game_challenges($1)',[snapshot]);
assert.deepEqual((await list()).map(row=>row.id),[later.challenge_id]);
await user(4);assert.ok(!(await list()).some(row=>row.id===target.challenge_id));
assert.equal((await db.query('SELECT status FROM game_challenges WHERE id=$1',[target.challenge_id])).rows[0].status,'expired');
await user(1);await respond(target.challenge_id,'cancel');
await assert.rejects(()=>db.query('SELECT prepare_challenge_entry($1)',[target.challenge_id]),/CHALLENGE_UNAVAILABLE/);
// Bulk resolution chooses decline vs cancellation per actor and rolls back the whole batch on failure.
await user(3);await db.query('SELECT resolve_game_challenges($1)',[[b.challenge_id,later.challenge_id]]);
assert.equal((await db.query('SELECT status FROM game_challenges WHERE id=$1',[later.challenge_id])).rows[0].status,'declined');
await user(1);const rollbackA=await send(3),rollbackB=await send(4);
const rollbackIds=[rollbackA.challenge_id,rollbackB.challenge_id];
const failId=(await db.query('SELECT id FROM game_challenges WHERE id=ANY($1) ORDER BY session_id DESC,id DESC LIMIT 1',[rollbackIds])).rows[0].id;
await db.exec(`RESET ROLE;
CREATE FUNCTION test_resolve_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.id::text=current_setting('test.fail_challenge',true) THEN RAISE EXCEPTION 'TEST_RESOLVE_FAILURE'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER test_resolve_failure BEFORE UPDATE ON game_challenges FOR EACH ROW EXECUTE FUNCTION test_resolve_failure();
SET ROLE authenticated;`);
await db.query("SELECT set_config('test.fail_challenge',$1,false)",[failId]);
await assert.rejects(()=>db.query('SELECT resolve_game_challenges($1)',[rollbackIds]),/TEST_RESOLVE_FAILURE/);
await db.query("SELECT set_config('test.fail_challenge','',false)");
assert.deepEqual((await db.query('SELECT status FROM game_challenges WHERE id=ANY($1)',[rollbackIds])).rows.map(row=>row.status),['pending','pending']);
assert.deepEqual((await db.query('SELECT status FROM game_sessions WHERE id=ANY($1)',[[rollbackA.session_id,rollbackB.session_id]])).rows.map(row=>row.status),['waiting','waiting']);
await db.query('SELECT resolve_game_challenges($1)',[rollbackIds]);
assert.deepEqual((await db.query('SELECT status FROM game_challenges WHERE id=ANY($1)',[rollbackIds])).rows.map(row=>row.status),['expired','expired']);
// An allocated voxel world retains its separate authority even before its first projection.
await user(1);const voxel=await send(4);await user(4);await respond(voxel.challenge_id,'accept');
await service('INSERT INTO voxel_worlds VALUES($1)',[voxel.session_id]);
await user(1);await respond(voxel.challenge_id,'cancel');
await list();
assert.equal((await db.query('SELECT status FROM game_sessions WHERE id=$1',[voxel.session_id])).rows[0].status,'waiting');
assert.equal((await db.query('SELECT challenge_departure($1) AS result',[voxel.session_id])).rows[0].result.closed_room,true);
await service("UPDATE game_sessions SET status='paused' WHERE id=$1",[voxel.session_id]);
const next=await send(3);await user(3);await respond(next.challenge_id,'accept');await user(1);
await db.query('SELECT prepare_challenge_entry($1,$2)',[next.challenge_id,voxel.session_id]);
await db.query("SELECT set_config('playground.allow_game_session_authority_write','true',false)");
try { await assert.rejects(()=>db.query("UPDATE game_sessions SET status='playing' WHERE id=$1",[voxel.session_id]),/voxel session changes require/); }
finally { await db.query("SELECT set_config('playground.allow_game_session_authority_write','false',false)"); }
console.log('PASS: independent invitations, resolved removal/atomic clean-all snapshots, durable missed redirects, entered-and-left presence, automatic fulfillment, no history, both-actor withdrawal at every phase, expiry, authorization and guarded switching');

await db.exec('SET ROLE migration_owner');
await db.exec(await readFile(new URL('../supabase/migrations/20261108130000_challenge_accept_and_enter.sql', import.meta.url),'utf8'));
await db.exec('DELETE FROM player_game_claims');
await db.exec('SET ROLE authenticated');
await user(3); const recipientRoom=await send(2);
await service("UPDATE game_sessions SET status='playing',connected_player_ids=ARRAY[$1::uuid],connected_player_names=ARRAY['Player 3'] WHERE id=$2",[id(3),recipientRoom.session_id]);
await user(1); const incoming=await send(3);
await user(3);
// Old clients cannot accept while remaining claimed in another room.
await assert.rejects(()=>respond(incoming.challenge_id,'accept'),/PLAYER_IN_ANOTHER_GAME/);
assert.equal((await db.query('SELECT status,accepted_at FROM game_challenges WHERE id=$1',[incoming.challenge_id])).rows[0].status,'pending');
await assert.rejects(()=>db.query('SELECT accept_game_challenge($1,$2)',[incoming.challenge_id,old.session_id]),/PLAYER_IN_ANOTHER_GAME/);
assert.equal((await db.query('SELECT accepted_at FROM game_challenges WHERE id=$1',[incoming.challenge_id])).rows[0].accepted_at,null);
await db.exec('SET ROLE migration_owner');
assert.equal((await db.query('SELECT session_id FROM player_game_claims WHERE user_id=$1',[id(3)])).rows[0].session_id,recipientRoom.session_id);
await db.exec('SET ROLE authenticated');
// Explicit acceptance can leave a playing room; its runtime owns final departure.
await db.exec('BEGIN');
assert.equal((await db.query('SELECT accept_game_challenge($1,$2) AS id',[incoming.challenge_id,recipientRoom.session_id])).rows[0].id,incoming.session_id);
assert.notEqual((await db.query("SELECT current_setting('playground.allow_game_session_authority_write',true) AS value")).rows[0].value,'true');
await db.exec('COMMIT');
const leftRoom=(await db.query('SELECT * FROM game_sessions WHERE id=$1',[recipientRoom.session_id])).rows[0];
assert.equal(leftRoom.status,'playing');
assert.ok(!leftRoom.connected_player_ids.includes(id(3)));
assert.equal((await db.query('SELECT status FROM game_challenges WHERE id=$1',[incoming.challenge_id])).rows[0].status,'accepted');
assert.equal((await db.query('SELECT accept_game_challenge($1) AS id',[incoming.challenge_id])).rows[0].id,incoming.session_id);
await assert.rejects(()=>db.query("SELECT respond_game_challenge_internal($1,'accept')",[incoming.challenge_id]),/permission denied/);
await assert.rejects(()=>db.query('SELECT prepare_challenge_entry_internal($1,NULL,true)',[incoming.challenge_id]),/permission denied/);
await user(1); const challengerRoom=await send(4);
await service("UPDATE game_sessions SET status='playing',connected_player_ids=ARRAY[$1::uuid],connected_player_names=ARRAY['Player 1'] WHERE id=$2",[id(1),challengerRoom.session_id]);
await assert.rejects(()=>db.query('SELECT prepare_challenge_entry($1,$2)',[incoming.challenge_id,challengerRoom.session_id]),/CURRENT_GAME_STARTED/);
await assert.rejects(()=>db.query('SELECT accept_game_challenge($1)',[incoming.challenge_id]),/CHALLENGE_NOT_FOUND/);
await respond(challengerRoom.challenge_id,'cancel');
const waitingTarget=await send(4);
await user(4); const waitingOld=await send(2);
await service("UPDATE game_sessions SET connected_player_ids=ARRAY[$1::uuid],connected_player_names=ARRAY['Player 4'] WHERE id=$2",[id(4),waitingOld.session_id]);
await db.query('SELECT accept_game_challenge($1,$2)',[waitingTarget.challenge_id,waitingOld.session_id]);
assert.equal((await db.query('SELECT status FROM game_challenges WHERE id=$1',[waitingOld.challenge_id])).rows[0].status,'pending');
assert.equal((await db.query('SELECT status FROM game_sessions WHERE id=$1',[waitingOld.session_id])).rows[0].status,'waiting');
await db.query('SELECT resolve_game_challenges($1)',[[waitingOld.challenge_id]]);
assert.equal((await db.query('SELECT status FROM game_challenges WHERE id=$1',[waitingOld.challenge_id])).rows[0].status,'expired');
await respond(waitingTarget.challenge_id,'decline');
await assert.rejects(()=>db.query('SELECT accept_game_challenge($1)',[waitingTarget.challenge_id]),/CHALLENGE_UNAVAILABLE/);
assert.equal((await db.query('SELECT status FROM game_challenges WHERE id=$1',[waitingTarget.challenge_id])).rows[0].status,'declined');
await user(1);await respond(incoming.challenge_id,'cancel');
assert.equal((await db.query('SELECT status FROM game_challenges WHERE id=$1',[incoming.challenge_id])).rows[0].status,'expired');
console.log('PASS: non-superuser acceptance migration, atomic accept/entry rollback, explicit active-room departure, preserved waiting invitation, legacy endpoint guard, private helpers and challenger protection');

await db.exec('SET ROLE migration_owner; DELETE FROM player_game_claims; SET ROLE authenticated');
await user(1);const rendezvous=await send(3);
await user(3);await db.query('SELECT accept_game_challenge($1)',[rendezvous.challenge_id]);
await service('UPDATE game_challenges SET fulfilled_at=now() WHERE id=$1',[rendezvous.challenge_id]);
assert.ok(!(await list()).some(row=>row.id===rendezvous.challenge_id));
await db.exec('SET ROLE migration_owner');
await db.exec(await readFile(new URL('../supabase/migrations/20261108160000_challenge_waiting_rendezvous.sql',import.meta.url),'utf8'));
await db.exec('SET ROLE authenticated');
assert.ok((await list()).some(row=>row.id===rendezvous.challenge_id)); // repair old false fulfillment
const presence=(session,players,status='waiting')=>service(
 "UPDATE game_sessions SET status=$3,connected_player_ids=$2::uuid[],connected_player_names=ARRAY(SELECT 'Player' FROM unnest($2::uuid[])) WHERE id=$1",
 [session,players.map(id),status]);
await user(1);const elsewhereA=await send(4);await presence(elsewhereA.session_id,[1]);
await presence(rendezvous.session_id,[3]); // B waits, A is elsewhere.
await user(1);assert.equal((await list()).find(row=>row.id===rendezvous.challenge_id).partner_in_session,true);
await presence(rendezvous.session_id,[]);
await user(3);const elsewhereB=await send(2);await presence(elsewhereB.session_id,[3],'playing');
await user(1);await db.query('SELECT prepare_challenge_entry($1,$2)',[rendezvous.challenge_id,elsewhereA.session_id]);
await presence(rendezvous.session_id,[1]);
await user(3);let returning=(await list()).find(row=>row.id===rendezvous.challenge_id);
assert.equal(returning.partner_in_session,true);assert.equal(returning.self_busy,true);
assert.equal(returning.fulfilled_at,null);
await user(1);assert.ok((await list()).some(row=>row.id===rendezvous.challenge_id));
// Reverse roles again: neither serial arrival consumes the invitation.
await presence(rendezvous.session_id,[]);await presence(elsewhereA.session_id,[1]);
await presence(elsewhereB.session_id,[],'paused');
await user(3);await db.query('SELECT prepare_challenge_entry($1,$2)',[rendezvous.challenge_id,elsewhereB.session_id]);
await presence(rendezvous.session_id,[3]);
await user(1);assert.equal((await list()).find(row=>row.id===rendezvous.challenge_id).partner_in_session,true);
await db.query('SELECT prepare_challenge_entry($1,$2)',[rendezvous.challenge_id,elsewhereA.session_id]);
await presence(rendezvous.session_id,[1,3]);
assert.ok(!(await list()).some(row=>row.id===rendezvous.challenge_id)); // both waiting: hide, not consume
assert.equal((await db.query('SELECT fulfilled_at FROM game_challenges WHERE id=$1',[rendezvous.challenge_id])).rows[0].fulfilled_at,null);
await user(3);await respond(rendezvous.challenge_id,'accept'); // legacy acceptance cannot force fulfillment
await service('UPDATE game_challenges SET fulfilled_at=now() WHERE id=$1',[rendezvous.challenge_id]);
assert.equal((await db.query('SELECT fulfilled_at FROM game_challenges WHERE id=$1',[rendezvous.challenge_id])).rows[0].fulfilled_at,null);
await presence(rendezvous.session_id,[1]);await presence(elsewhereB.session_id,[3]);
assert.ok((await list()).some(row=>row.id===rendezvous.challenge_id));
await presence(elsewhereB.session_id,[]);await presence(rendezvous.session_id,[1,3]);
await db.exec('SET ROLE migration_owner');
await db.query("UPDATE player_game_claims SET expires_at=now()-interval '1 second' WHERE user_id=$1",[id(3)]);
await db.exec('SET ROLE authenticated');
assert.ok((await list()).some(row=>row.id===rendezvous.challenge_id)); // stale projection is not live co-presence
await presence(rendezvous.session_id,[1,3]);
await presence(rendezvous.session_id,[1,3],'playing');
assert.ok((await db.query('SELECT fulfilled_at FROM game_challenges WHERE id=$1',[rendezvous.challenge_id])).rows[0].fulfilled_at);
await presence(rendezvous.session_id,[1],'paused');
assert.ok(!(await list()).some(row=>row.id===rendezvous.challenge_id)); // played games stay fulfilled
console.log('PASS: repaired waiting invitations, alternating arrivals, both-role recovery, reversible lobby overlap, stale leases and permanent fulfillment after play');

await db.exec('SET ROLE migration_owner');
await db.exec(await readFile(new URL('../supabase/migrations/20261108170000_challenge_confirmed_switch.sql',import.meta.url),'utf8'));
await db.exec('DELETE FROM player_game_claims; SET ROLE authenticated');
await user(1);const switchTarget=await send(3);
await user(3);await db.query('SELECT accept_game_challenge($1)',[switchTarget.challenge_id]);
for (const actor of [1,3]) {
 await user(actor);const source=await send(actor===1?4:2);
 await presence(source.session_id,[actor],'playing');
 await assert.rejects(()=>db.query('SELECT prepare_challenge_entry($1,$2)',[switchTarget.challenge_id,source.session_id]),/CURRENT_GAME_STARTED/);
 await assert.rejects(()=>db.query('SELECT prepare_challenge_entry($1,$2,false)',[switchTarget.challenge_id,source.session_id]),/CURRENT_GAME_STARTED/);
 await db.exec('BEGIN');
 assert.equal((await db.query('SELECT prepare_challenge_entry($1,$2,true) AS id',[switchTarget.challenge_id,source.session_id])).rows[0].id,switchTarget.session_id);
 assert.notEqual((await db.query("SELECT current_setting('playground.allow_game_session_authority_write',true) AS value")).rows[0].value,'true');
 await db.exec('COMMIT');
 const departed=(await db.query('SELECT * FROM game_sessions WHERE id=$1',[source.session_id])).rows[0];
 assert.equal(departed.status,'playing');assert.ok(!departed.connected_player_ids.includes(id(actor)));
 assert.equal((await db.query('SELECT status FROM game_challenges WHERE id=$1',[switchTarget.challenge_id])).rows[0].status,'accepted');
 await presence(switchTarget.session_id,[actor]);
 await presence(switchTarget.session_id,[]); // can leave and later make the same explicit return again
}
await user(4);
await assert.rejects(()=>db.query('SELECT prepare_challenge_entry($1,NULL,true)',[switchTarget.challenge_id]),/CHALLENGE_UNAVAILABLE/);
await user(1);await respond(switchTarget.challenge_id,'cancel');
await user(3);const stillPlaying=await send(2);await presence(stillPlaying.session_id,[3],'playing');
await assert.rejects(()=>db.query('SELECT prepare_challenge_entry($1,$2,true)',[switchTarget.challenge_id,stillPlaying.session_id]),/CHALLENGE_UNAVAILABLE/);
assert.deepEqual((await db.query('SELECT connected_player_ids FROM game_sessions WHERE id=$1',[stillPlaying.session_id])).rows[0].connected_player_ids,[id(3)]);
console.log('PASS: restricted-role switch migration, confirmed return for either participant, guarded automatic entry, repeated return, ownership and cancelled-target rollback');

// A waiting-room confirmation must not silently become active-game consent.
await user(1);const racingAccept=await send(3);
await user(3);
await assert.rejects(()=>db.query('SELECT accept_game_challenge($1,$2)',[racingAccept.challenge_id,stillPlaying.session_id]),/CURRENT_GAME_STARTED/);
assert.equal((await db.query('SELECT status FROM game_challenges WHERE id=$1',[racingAccept.challenge_id])).rows[0].status,'pending');
await db.query('SELECT accept_game_challenge($1,$2,true)',[racingAccept.challenge_id,stillPlaying.session_id]);

await db.exec('SET ROLE migration_owner');
await db.exec("ALTER TABLE games ADD COLUMN game_url text DEFAULT 'chess'; CREATE TABLE voxel_session_controls(session_id uuid PRIMARY KEY,desired_state text NOT NULL); GRANT ALL ON voxel_session_controls TO service_role");
const projectionSource=await readFile(new URL('../supabase/migrations/20261025020000_voxel_session_projection.sql',import.meta.url),'utf8');
await db.exec(projectionSource.match(/CREATE FUNCTION public\.voxel_session_policy\(p_session UUID\)[\s\S]*?END \$\$;/)[0]);
await db.exec('REVOKE ALL ON FUNCTION voxel_session_policy(uuid) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION voxel_session_policy(uuid) TO service_role');
await db.exec(await readFile(new URL('../supabase/migrations/20261108180000_challenge_destination_eligibility.sql',import.meta.url),'utf8'));
await db.exec('DELETE FROM player_game_claims; SET ROLE authenticated');
await user(1);const startedTarget=await send(3);await presence(startedTarget.session_id,[1],'playing');
await user(3);const sourceLive=await send(2);await presence(sourceLive.session_id,[3],'playing');
assert.equal((await db.query('SELECT accept_game_challenge($1,$2,true) AS id',[startedTarget.challenge_id,sourceLive.session_id])).rows[0].id,startedTarget.session_id);
assert.equal((await db.query('SELECT status FROM game_challenges WHERE id=$1',[startedTarget.challenge_id])).rows[0].status,'accepted');
await user(1);const pausedTarget=await send(3);await presence(pausedTarget.session_id,[],'paused');
await user(3);await presence(sourceLive.session_id,[3],'playing');
await assert.rejects(()=>db.query('SELECT accept_game_challenge($1,$2,true)',[pausedTarget.challenge_id,sourceLive.session_id]),/TARGET_GAME_PAUSED/);
assert.equal((await db.query('SELECT status FROM game_challenges WHERE id=$1',[pausedTarget.challenge_id])).rows[0].status,'pending');
assert.deepEqual((await db.query('SELECT connected_player_ids FROM game_sessions WHERE id=$1',[sourceLive.session_id])).rows[0].connected_player_ids,[id(3)]);
await presence(pausedTarget.session_id,[]);
await db.query('SELECT accept_game_challenge($1,$2,true)',[pausedTarget.challenge_id,sourceLive.session_id]);
await presence(pausedTarget.session_id,[],'paused');await presence(sourceLive.session_id,[3],'playing');
await assert.rejects(()=>db.query('SELECT prepare_challenge_entry($1,$2,true)',[pausedTarget.challenge_id,sourceLive.session_id]),/TARGET_GAME_PAUSED/);
assert.deepEqual((await db.query('SELECT connected_player_ids FROM game_sessions WHERE id=$1',[sourceLive.session_id])).rows[0].connected_player_ids,[id(3)]);
await presence(startedTarget.session_id,[],'paused');
await presence(pausedTarget.session_id,[1],'playing');
await db.query('SELECT prepare_challenge_entry($1,$2,true)',[pausedTarget.challenge_id,sourceLive.session_id]);
// Voxel's temporary public pause is not a deliberate pause; honor its current policy.
await db.exec('SET ROLE migration_owner');
await db.exec("INSERT INTO games VALUES ('10000000-0000-0000-0000-000000000002','Voxel',true,true,'both','minecraft')");
await db.exec('SET ROLE authenticated');
await user(1);const recovering=(await db.query('SELECT create_game_challenge($1,$2) AS result',[id(3),'10000000-0000-0000-0000-000000000002'])).rows[0].result;
await service('INSERT INTO voxel_worlds VALUES($1)',[recovering.session_id]);
await service("INSERT INTO voxel_session_controls VALUES($1,'playing')",[recovering.session_id]);
await presence(recovering.session_id,[],'paused');
await user(3);await db.query('SELECT accept_game_challenge($1)',[recovering.challenge_id]);
await presence(sourceLive.session_id,[3],'playing');
await service("UPDATE voxel_session_controls SET desired_state='paused' WHERE session_id=$1",[recovering.session_id]);
await assert.rejects(()=>db.query('SELECT prepare_challenge_entry($1,$2,true)',[recovering.challenge_id,sourceLive.session_id]),/TARGET_GAME_PAUSED/);
await service("UPDATE voxel_session_controls SET desired_state='playing' WHERE session_id=$1",[recovering.session_id]);
await db.query('SELECT prepare_challenge_entry($1,$2,true)',[recovering.challenge_id,sourceLive.session_id]);
await assert.rejects(()=>db.query('SELECT validate_challenge_target($1)',[recovering.session_id]),/permission denied/);
console.log('PASS: active-consent race rollback, late acceptance, paused-target preflight before departure, host resume recovery and actual voxel pause policy');
await user(1);const classroomTarget=await send(3);
await service('UPDATE game_sessions SET classroom_id=$2 WHERE id=$1',[classroomTarget.session_id,id(9)]);
await user(3);await presence(sourceLive.session_id,[3],'playing');
await assert.rejects(()=>db.query('SELECT accept_game_challenge($1,$2,true)',[classroomTarget.challenge_id,sourceLive.session_id]),/CLASSROOM_SESSION/);
assert.deepEqual((await db.query('SELECT connected_player_ids FROM game_sessions WHERE id=$1',[sourceLive.session_id])).rows[0].connected_player_ids,[id(3)]);
await user(1);const playgroundTarget=await send(4);await user(4);
await db.query('SELECT accept_game_challenge($1)',[playgroundTarget.challenge_id]);
await user(1);
await assert.rejects(()=>db.query('SELECT prepare_challenge_entry($1,$2,true)',[playgroundTarget.challenge_id,classroomTarget.session_id]),/CLASSROOM_SESSION/);
console.log('PASS: classroom-owned source and destination are excluded from playground challenge switching');
await db.close();
