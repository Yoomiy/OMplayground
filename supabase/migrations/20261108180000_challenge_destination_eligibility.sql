-- Validate a destination before releasing the actor's current admission.
-- A playing destination may support late entry; paused games retain their roster policy.
CREATE FUNCTION public.validate_challenge_target(p_session uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target game_sessions%ROWTYPE; policy jsonb;
BEGIN
 SELECT * INTO target FROM game_sessions WHERE id=p_session;
 IF target.id IS NULL OR target.status NOT IN ('waiting','playing','paused') THEN
   RAISE EXCEPTION 'SESSION_UNAVAILABLE';
 END IF;
 IF target.classroom_id IS NOT NULL THEN RAISE EXCEPTION 'CLASSROOM_SESSION'; END IF;
 IF target.status='paused' AND target.host_id IS DISTINCT FROM auth.uid()
   AND NOT coalesce(auth.uid()=ANY(target.player_ids),false) THEN
   IF EXISTS(SELECT 1 FROM voxel_worlds WHERE session_id=target.id) THEN
     -- An empty/recovering voxel worker also projects paused. Use its actual policy.
     policy:=public.voxel_session_policy(target.id);
     IF policy->>'state'='playing' THEN RETURN; END IF;
     IF policy->>'state'='ended' THEN RAISE EXCEPTION 'SESSION_UNAVAILABLE'; END IF;
     IF policy->>'state' IS DISTINCT FROM 'paused' THEN RAISE EXCEPTION 'CHALLENGE_POLICY_UNAVAILABLE'; END IF;
   END IF;
   RAISE EXCEPTION 'TARGET_GAME_PAUSED';
 END IF;
END; $$;
REVOKE ALL ON FUNCTION public.validate_challenge_target(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.prepare_challenge_entry_internal(p_id uuid,p_leave_session uuid,p_allow_active boolean) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c game_challenges%ROWTYPE; old game_sessions%ROWTYPE;
  previous_authority text := current_setting('playground.allow_game_session_authority_write',true);
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 SELECT * INTO c FROM game_challenges WHERE id=p_id AND auth.uid() IN (from_kid_id,to_kid_id) AND status='accepted';
 IF NOT FOUND THEN RAISE EXCEPTION 'CHALLENGE_UNAVAILABLE'; END IF;
 PERFORM 1 FROM game_sessions WHERE id IN (c.session_id,p_leave_session) ORDER BY id FOR UPDATE;
 PERFORM public.validate_challenge_target(c.session_id);
 IF p_leave_session IS NOT NULL AND p_leave_session<>c.session_id THEN
   SELECT * INTO old FROM game_sessions WHERE id=p_leave_session;
   IF old.classroom_id IS NOT NULL THEN RAISE EXCEPTION 'CLASSROOM_SESSION'; END IF;
   -- A deleted room has no progress or admission left to preserve.
   IF old.status='playing' AND NOT p_allow_active THEN RAISE EXCEPTION 'CURRENT_GAME_STARTED'; END IF;
   IF auth.uid()=ANY(old.player_ids) OR auth.uid()=ANY(old.connected_player_ids) THEN
     IF NOT EXISTS(SELECT 1 FROM voxel_worlds WHERE session_id=old.id) THEN
     PERFORM set_config('playground.allow_game_session_authority_write','true',true);
     UPDATE game_sessions SET connected_player_ids=ARRAY(SELECT id FROM unnest(old.connected_player_ids) WITH ORDINALITY AS p(id,n) WHERE id<>auth.uid() ORDER BY n),
       connected_player_names=ARRAY(SELECT old.connected_player_names[n] FROM unnest(old.connected_player_ids) WITH ORDINALITY AS p(id,n) WHERE id<>auth.uid() ORDER BY n)
     WHERE id=old.id;
     PERFORM set_config('playground.allow_game_session_authority_write',coalesce(previous_authority,''),true);
     END IF;
     DELETE FROM player_game_claims WHERE user_id=auth.uid() AND session_id=old.id;
   END IF;
 END IF;
 DELETE FROM player_game_claims claim WHERE claim.user_id=auth.uid() AND (claim.expires_at<=now() OR EXISTS(SELECT 1 FROM game_sessions s WHERE s.id=claim.session_id AND s.status NOT IN ('waiting','playing')));
 IF EXISTS(SELECT 1 FROM player_game_claims claim JOIN game_sessions s ON s.id=claim.session_id WHERE claim.user_id=auth.uid() AND claim.session_id<>c.session_id AND claim.expires_at>now() AND s.status IN ('waiting','playing')) THEN RAISE EXCEPTION 'PLAYER_IN_ANOTHER_GAME'; END IF;
 RETURN c.session_id;
END; $$;

CREATE OR REPLACE FUNCTION public.respond_game_challenge_internal(p_id uuid,p_action text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c game_challenges%ROWTYPE; s game_sessions%ROWTYPE;
  previous_authority text := current_setting('playground.allow_game_session_authority_write',true);
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 SELECT * INTO c FROM game_challenges WHERE id=p_id AND auth.uid() IN (from_kid_id,to_kid_id);
 IF NOT FOUND THEN RAISE EXCEPTION 'CHALLENGE_NOT_FOUND'; END IF;
 SELECT * INTO s FROM game_sessions WHERE id=c.session_id FOR UPDATE;
 SELECT * INTO c FROM game_challenges WHERE id=p_id FOR UPDATE;
 IF p_action='accept' AND auth.uid()=c.to_kid_id THEN
   IF c.status='accepted' AND s.status<>'completed' THEN RETURN to_jsonb(c); END IF;
   IF c.status<>'pending' OR c.expires_at<=now() THEN RAISE EXCEPTION 'CHALLENGE_UNAVAILABLE'; END IF;
   PERFORM public.validate_challenge_target(c.session_id);
   IF EXISTS(SELECT 1 FROM kid_blocks WHERE (blocker_id=c.from_kid_id AND blocked_id=c.to_kid_id) OR (blocker_id=c.to_kid_id AND blocked_id=c.from_kid_id)) THEN RAISE EXCEPTION 'CHALLENGE_NOT_ALLOWED'; END IF;
   IF NOT EXISTS(SELECT 1 FROM kid_profiles sender JOIN kid_profiles recipient ON recipient.id=c.to_kid_id JOIN games game ON game.id=c.game_id WHERE sender.id=c.from_kid_id AND sender.is_active AND recipient.is_active AND sender.role IN ('kid','teacher') AND recipient.role='kid' AND sender.gender=recipient.gender AND game.is_active AND game.is_multiplayer AND (game.for_gender='both' OR game.for_gender::text=sender.gender::text)) THEN RAISE EXCEPTION 'CHALLENGE_NOT_ALLOWED'; END IF;
   UPDATE game_challenges SET status='accepted',accepted_at=now(),expires_at=now()+interval '5 minutes' WHERE id=c.id RETURNING * INTO c;
   IF s.connected_player_ids @> ARRAY[c.from_kid_id,c.to_kid_id] THEN
     UPDATE game_challenges SET fulfilled_at=now() WHERE id=c.id RETURNING * INTO c;
   END IF;
 ELSIF (p_action='cancel' AND auth.uid()=c.from_kid_id) OR (p_action='decline' AND auth.uid()=c.to_kid_id) THEN
   -- Repeated withdrawal and expiry are successful no-ops, not HTTP 400 errors.
   IF c.status IN ('declined','expired') THEN RETURN to_jsonb(c); END IF;
   UPDATE game_challenges SET status=CASE WHEN auth.uid()=from_kid_id THEN 'expired'::game_challenge_status ELSE 'declined'::game_challenge_status END,
     withdrawn_by=auth.uid(),withdrawn_at=now(),withdrawn_phase=s.status
   WHERE id=c.id RETURNING * INTO c;
   -- A waiting invitation has no game progress to preserve. Close it for both participants.
   -- Running/paused games use the normal client/server leave path for the withdrawing player.
   IF s.status='waiting' THEN
     PERFORM set_config('playground.allow_game_session_authority_write','true',true);
     UPDATE game_sessions SET status='completed',ended_at=coalesce(ended_at,now()) WHERE id=s.id
       AND NOT EXISTS(SELECT 1 FROM voxel_worlds w WHERE w.session_id=game_sessions.id);
     PERFORM set_config('playground.allow_game_session_authority_write',coalesce(previous_authority,''),true);
   END IF;
 ELSE RAISE EXCEPTION 'CHALLENGE_UNAVAILABLE';
 END IF;
 RETURN to_jsonb(c);
END; $$;

