ALTER TABLE public.game_challenges ADD COLUMN accepted_at timestamptz;
UPDATE public.game_challenges SET accepted_at=created_at WHERE status='accepted';
CREATE OR REPLACE FUNCTION public.respond_game_challenge(p_id uuid, p_action text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c game_challenges%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  PERFORM public.cleanup_game_challenges();
  SELECT * INTO c FROM game_challenges WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() NOT IN (c.from_kid_id,c.to_kid_id) THEN RAISE EXCEPTION 'CHALLENGE_NOT_FOUND'; END IF;
  IF p_action = 'accept' AND auth.uid() = c.to_kid_id THEN
    IF c.status = 'accepted' THEN RETURN to_jsonb(c); END IF;
    IF c.status <> 'pending' OR c.expires_at <= now() THEN RAISE EXCEPTION 'CHALLENGE_UNAVAILABLE'; END IF;
    IF EXISTS (SELECT 1 FROM kid_blocks WHERE (blocker_id=c.from_kid_id AND blocked_id=c.to_kid_id) OR (blocker_id=c.to_kid_id AND blocked_id=c.from_kid_id)) THEN RAISE EXCEPTION 'CHALLENGE_NOT_ALLOWED'; END IF;
    IF NOT EXISTS (SELECT 1 FROM kid_profiles sender JOIN kid_profiles recipient ON recipient.id=c.to_kid_id JOIN games game ON game.id=c.game_id WHERE sender.id=c.from_kid_id AND sender.is_active AND recipient.is_active AND sender.role IN ('kid','teacher') AND recipient.role='kid' AND sender.gender=recipient.gender AND game.is_active AND game.is_multiplayer AND (game.for_gender='both' OR game.for_gender::text=sender.gender::text)) THEN RAISE EXCEPTION 'CHALLENGE_NOT_ALLOWED'; END IF;
    IF NOT EXISTS (SELECT 1 FROM game_sessions WHERE id=c.session_id AND status='waiting') THEN RAISE EXCEPTION 'SESSION_UNAVAILABLE'; END IF;
    UPDATE game_challenges SET status='accepted', accepted_at=now(), expires_at=now()+interval '5 minutes' WHERE id=c.id RETURNING * INTO c;
  ELSIF p_action='decline' AND auth.uid()=c.to_kid_id AND c.status='pending' THEN
    UPDATE game_challenges SET status='declined' WHERE id=c.id RETURNING * INTO c;
  ELSIF p_action='cancel' AND auth.uid()=c.from_kid_id AND c.status IN ('pending','accepted') THEN
    IF EXISTS (SELECT 1 FROM game_sessions WHERE id=c.session_id AND (status <> 'waiting' OR cardinality(connected_player_ids)>0)) THEN RAISE EXCEPTION 'SESSION_ALREADY_ENTERED'; END IF;
    UPDATE game_challenges SET status='expired' WHERE id=c.id RETURNING * INTO c;
  ELSE RAISE EXCEPTION 'CHALLENGE_UNAVAILABLE'; END IF;
  PERFORM public.cleanup_game_challenges();
  RETURN to_jsonb(c);
END; $$;
-- An accepted invitation is a durable entry point, independent of redirect success.
CREATE OR REPLACE FUNCTION public.cleanup_game_challenges() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE game_challenges SET status='expired' WHERE status='pending' AND expires_at<=now();
 UPDATE game_sessions s SET status='completed',ended_at=now()
 WHERE s.status='waiting' AND cardinality(s.connected_player_ids)=0
 AND EXISTS(SELECT 1 FROM game_challenges c WHERE c.session_id=s.id AND c.status IN ('expired','declined'))
 AND NOT EXISTS(SELECT 1 FROM game_challenges c WHERE c.session_id=s.id AND c.status IN ('pending','accepted'));
END; $$;
CREATE OR REPLACE FUNCTION public.list_game_challenges() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 PERFORM public.cleanup_game_challenges();
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(c)||jsonb_build_object(
 'partner_role',p.role,'partner_name',p.full_name,'game_name',g.name_he,
 'self_busy',EXISTS(SELECT 1 FROM player_game_claims claim JOIN game_sessions active ON active.id=claim.session_id WHERE claim.session_id<>c.session_id AND claim.user_id=auth.uid() AND claim.expires_at>now() AND active.status IN ('waiting','playing')),
 'partner_busy',EXISTS(SELECT 1 FROM player_game_claims claim JOIN game_sessions active ON active.id=claim.session_id WHERE claim.session_id<>c.session_id AND claim.user_id=p.id AND claim.expires_at>now() AND active.status IN ('waiting','playing')),
 'self_in_session',auth.uid()=ANY(gs.connected_player_ids),'partner_in_session',p.id=ANY(gs.connected_player_ids),
 'withdrawn',c.accepted_at IS NOT NULL AND c.status<>'accepted','can_cancel',gs.status='waiting' AND cardinality(gs.connected_player_ids)=0,'session_status',CASE WHEN c.accepted_at IS NOT NULL AND c.status<>'accepted' THEN 'completed' ELSE gs.status::text END)
 ORDER BY c.created_at DESC,c.id DESC)
 FROM game_challenges c JOIN kid_profiles p ON p.id=CASE WHEN c.from_kid_id=auth.uid() THEN c.to_kid_id ELSE c.from_kid_id END
 JOIN games g ON g.id=c.game_id JOIN game_sessions gs ON gs.id=c.session_id
 WHERE auth.uid() IN (c.from_kid_id,c.to_kid_id) AND (c.status='accepted' OR c.accepted_at IS NOT NULL OR (c.status='pending' AND gs.status='waiting'))),'[]'::jsonb);
END; $$;
-- Lock and recheck the old room before releasing its admission. Its invitation stays intact.
CREATE FUNCTION public.prepare_challenge_entry(p_id uuid,p_leave_session uuid DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c game_challenges%ROWTYPE; old game_sessions%ROWTYPE; target game_sessions%ROWTYPE;
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
   IF old.status='playing' THEN RAISE EXCEPTION 'CURRENT_GAME_STARTED'; END IF;
   IF auth.uid()=ANY(old.player_ids) OR auth.uid()=ANY(old.connected_player_ids) THEN
     UPDATE game_sessions SET connected_player_ids=ARRAY(SELECT id FROM unnest(old.connected_player_ids) WITH ORDINALITY AS p(id,n) WHERE id<>auth.uid() ORDER BY n),
       connected_player_names=ARRAY(SELECT old.connected_player_names[n] FROM unnest(old.connected_player_ids) WITH ORDINALITY AS p(id,n) WHERE id<>auth.uid() ORDER BY n)
     WHERE id=old.id;
     DELETE FROM player_game_claims WHERE user_id=auth.uid() AND session_id=old.id;
   END IF;
 END IF;
 DELETE FROM player_game_claims claim WHERE claim.user_id=auth.uid() AND (claim.expires_at<=now() OR EXISTS(SELECT 1 FROM game_sessions s WHERE s.id=claim.session_id AND s.status NOT IN ('waiting','playing')));
 IF EXISTS(SELECT 1 FROM player_game_claims claim JOIN game_sessions s ON s.id=claim.session_id WHERE claim.user_id=auth.uid() AND claim.session_id<>c.session_id AND claim.expires_at>now() AND s.status IN ('waiting','playing')) THEN RAISE EXCEPTION 'PLAYER_IN_ANOTHER_GAME'; END IF;
 RETURN c.session_id;
END; $$;
REVOKE ALL ON FUNCTION public.prepare_challenge_entry(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepare_challenge_entry(uuid,uuid) TO authenticated;
-- Repair explicit terminal timestamps left behind by older lifecycle writers.
UPDATE public.game_sessions SET status='completed'
WHERE status IN ('playing','paused') AND ended_at IS NOT NULL;
