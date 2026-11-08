-- Acceptance and entry preparation succeed together. Explicit recipient acceptance
-- may leave an active game; later automatic challenger entry may not.
CREATE OR REPLACE FUNCTION public.prepare_challenge_entry_internal(p_id uuid,p_leave_session uuid,p_allow_active boolean) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c game_challenges%ROWTYPE; old game_sessions%ROWTYPE; target game_sessions%ROWTYPE;
  previous_authority text := current_setting('playground.allow_game_session_authority_write',true);
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 SELECT * INTO c FROM game_challenges WHERE id=p_id AND auth.uid() IN (from_kid_id,to_kid_id) AND status='accepted';
 IF NOT FOUND THEN RAISE EXCEPTION 'CHALLENGE_UNAVAILABLE'; END IF;
 PERFORM 1 FROM game_sessions WHERE id IN (c.session_id,p_leave_session) ORDER BY id FOR UPDATE;
 SELECT * INTO target FROM game_sessions WHERE id=c.session_id;
 IF target.id IS NULL OR target.status='completed' THEN RAISE EXCEPTION 'SESSION_UNAVAILABLE'; END IF;
 IF p_leave_session IS NOT NULL AND p_leave_session<>c.session_id THEN
   SELECT * INTO old FROM game_sessions WHERE id=p_leave_session;
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

REVOKE ALL ON FUNCTION public.prepare_challenge_entry_internal(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.prepare_challenge_entry(p_id uuid,p_leave_session uuid DEFAULT NULL) RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT public.prepare_challenge_entry_internal(p_id,p_leave_session,false);
$$;

-- Keep cancellation/decline behavior, but prevent the old acceptance endpoint
-- from bypassing the entry checks (including for already-open browser tabs).
ALTER FUNCTION public.respond_game_challenge(uuid,text) RENAME TO respond_game_challenge_internal;
REVOKE ALL ON FUNCTION public.respond_game_challenge_internal(uuid,text) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.accept_game_challenge(p_id uuid,p_leave_session uuid DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c game_challenges%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 SELECT * INTO c FROM game_challenges WHERE id=p_id AND to_kid_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'CHALLENGE_NOT_FOUND'; END IF;
 -- Lock every affected session before the challenge, in the same order as cleanup.
 PERFORM 1 FROM game_sessions WHERE id IN (c.session_id,p_leave_session) ORDER BY id FOR UPDATE;
 PERFORM public.respond_game_challenge_internal(p_id,'accept');
 -- Any failed switch rolls back acceptance as well as old-room admission changes.
 RETURN public.prepare_challenge_entry_internal(p_id,p_leave_session,true);
END; $$;
REVOKE ALL ON FUNCTION public.accept_game_challenge(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.accept_game_challenge(uuid,uuid) TO authenticated;

CREATE FUNCTION public.respond_game_challenge(p_id uuid,p_action text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_action='accept' THEN
   PERFORM public.accept_game_challenge(p_id,NULL);
   RETURN (SELECT to_jsonb(c) FROM game_challenges c WHERE c.id=p_id AND c.to_kid_id=auth.uid());
 END IF;
 RETURN public.respond_game_challenge_internal(p_id,p_action);
END; $$;
REVOKE ALL ON FUNCTION public.respond_game_challenge(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.respond_game_challenge(uuid,text) TO authenticated;
