-- Manual return to an accepted invitation has the same explicit-departure policy
-- as acceptance. Existing two-argument callers remain guarded by default.
DROP FUNCTION public.prepare_challenge_entry(uuid,uuid);
CREATE FUNCTION public.prepare_challenge_entry(
 p_id uuid,p_leave_session uuid DEFAULT NULL,p_allow_active boolean DEFAULT false
) RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT public.prepare_challenge_entry_internal(p_id,p_leave_session,coalesce(p_allow_active,false));
$$;
REVOKE ALL ON FUNCTION public.prepare_challenge_entry(uuid,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prepare_challenge_entry(uuid,uuid,boolean) TO authenticated;

-- Acceptance needs the same explicit active-game consent. A room that starts
-- after a waiting-room confirmation must not be left without that consent.
DROP FUNCTION public.accept_game_challenge(uuid,uuid);
CREATE FUNCTION public.accept_game_challenge(
 p_id uuid,p_leave_session uuid DEFAULT NULL,p_allow_active boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c game_challenges%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 SELECT * INTO c FROM game_challenges WHERE id=p_id AND to_kid_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'CHALLENGE_NOT_FOUND'; END IF;
 PERFORM 1 FROM game_sessions WHERE id IN (c.session_id,p_leave_session) ORDER BY id FOR UPDATE;
 PERFORM public.respond_game_challenge_internal(p_id,'accept');
 RETURN public.prepare_challenge_entry_internal(p_id,p_leave_session,coalesce(p_allow_active,false));
END; $$;
REVOKE ALL ON FUNCTION public.accept_game_challenge(uuid,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.accept_game_challenge(uuid,uuid,boolean) TO authenticated;
