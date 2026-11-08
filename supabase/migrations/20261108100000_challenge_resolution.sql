-- Keep invitation access records, but show only invitations still needing attention.
ALTER TABLE public.game_challenges
  ADD COLUMN fulfilled_at timestamptz,
  ADD COLUMN withdrawn_by uuid REFERENCES public.kid_profiles(id),
  ADD COLUMN withdrawn_at timestamptz,
  ADD COLUMN withdrawn_phase text;

UPDATE public.game_challenges c SET fulfilled_at=now()
FROM public.game_sessions s
WHERE s.id=c.session_id AND c.status='accepted'
  AND ((s.connected_player_ids @> ARRAY[c.from_kid_id,c.to_kid_id])
    OR (s.status IN ('playing','paused','completed') AND s.player_ids @> ARRAY[c.from_kid_id,c.to_kid_id]));

CREATE FUNCTION public.fulfill_entered_challenges() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE game_challenges SET fulfilled_at=now()
 WHERE session_id=NEW.id AND status='accepted' AND fulfilled_at IS NULL
   AND NEW.connected_player_ids @> ARRAY[from_kid_id,to_kid_id];
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.fulfill_entered_challenges() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER fulfill_entered_challenges AFTER UPDATE OF connected_player_ids ON public.game_sessions
FOR EACH ROW EXECUTE FUNCTION public.fulfill_entered_challenges();

-- Lock sessions before invitations everywhere (the entry trigger uses that order too).
CREATE OR REPLACE FUNCTION public.cleanup_game_challenges() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s game_sessions%ROWTYPE;
  previous_authority text := current_setting('playground.allow_game_session_authority_write',true);
BEGIN
 -- Runtime transaction-local settings work with the hosted migration role;
 -- function-level SET on custom parameters requires elevated privileges.
 PERFORM set_config('playground.allow_game_session_authority_write','true',true);
 FOR s IN SELECT gs.* FROM game_sessions gs
   WHERE EXISTS(SELECT 1 FROM game_challenges c WHERE c.session_id=gs.id
     AND ((c.status='pending' AND c.expires_at<=now())
       OR (gs.status='waiting' AND c.status IN ('declined','expired'))))
   ORDER BY gs.id FOR UPDATE OF gs SKIP LOCKED
 LOOP
   UPDATE game_challenges SET status='expired',withdrawn_at=now(),withdrawn_phase=s.status WHERE session_id=s.id AND status='pending' AND expires_at<=now();
   UPDATE game_sessions SET status='completed',ended_at=coalesce(ended_at,now())
   WHERE id=s.id AND status='waiting'
     AND NOT EXISTS(SELECT 1 FROM voxel_worlds w WHERE w.session_id=game_sessions.id)
     AND NOT EXISTS(SELECT 1 FROM game_challenges c WHERE c.session_id=s.id AND c.status IN ('pending','accepted'));
 END LOOP;
 PERFORM set_config('playground.allow_game_session_authority_write',coalesce(previous_authority,''),true);
END; $$;

CREATE OR REPLACE FUNCTION public.respond_game_challenge(p_id uuid,p_action text) RETURNS jsonb
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
   IF s.id IS NULL OR s.status<>'waiting' THEN RAISE EXCEPTION 'SESSION_UNAVAILABLE'; END IF;
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

-- Resolve the entire snapshot atomically before any card is removed from the UI.
CREATE FUNCTION public.resolve_game_challenges(p_ids uuid[]) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c game_challenges%ROWTYPE; affected integer := 0;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 PERFORM 1 FROM game_sessions s
 WHERE EXISTS(SELECT 1 FROM game_challenges invite WHERE invite.session_id=s.id AND invite.id=ANY(p_ids) AND auth.uid() IN (invite.from_kid_id,invite.to_kid_id))
 ORDER BY s.id FOR UPDATE;
 FOR c IN SELECT * FROM game_challenges WHERE id=ANY(p_ids) AND auth.uid() IN (from_kid_id,to_kid_id) ORDER BY session_id,id FOR UPDATE
 LOOP
   PERFORM public.respond_game_challenge(c.id,CASE WHEN c.from_kid_id=auth.uid() THEN 'cancel' ELSE 'decline' END);
   affected := affected + 1;
 END LOOP;
 RETURN affected;
END; $$;
REVOKE ALL ON FUNCTION public.resolve_game_challenges(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resolve_game_challenges(uuid[]) TO authenticated;

-- Used by all game routes, including tabs/devices missing a Realtime event.
CREATE FUNCTION public.challenge_departure(p_session_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('actor',withdrawn_by,'at',withdrawn_at,'closed_room',withdrawn_phase='waiting')
 FROM game_challenges WHERE session_id=p_session_id AND auth.uid() IN (from_kid_id,to_kid_id)
   AND withdrawn_at IS NOT NULL AND (withdrawn_by=auth.uid() OR withdrawn_phase='waiting')
 ORDER BY withdrawn_at DESC LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.challenge_departure(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.challenge_departure(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_game_challenges() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 PERFORM public.cleanup_game_challenges();
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(c)||jsonb_build_object(
   'partner_role',p.role,'partner_name',p.full_name,'game_name',g.name_he,
   'self_busy',EXISTS(SELECT 1 FROM player_game_claims claim JOIN game_sessions active ON active.id=claim.session_id WHERE claim.session_id<>c.session_id AND claim.user_id=auth.uid() AND claim.expires_at>now() AND active.status IN ('waiting','playing')),
   'partner_busy',EXISTS(SELECT 1 FROM player_game_claims claim JOIN game_sessions active ON active.id=claim.session_id WHERE claim.session_id<>c.session_id AND claim.user_id=p.id AND claim.expires_at>now() AND active.status IN ('waiting','playing')),
   'self_in_session',auth.uid()=ANY(gs.connected_player_ids) AND EXISTS(SELECT 1 FROM player_game_claims claim WHERE claim.user_id=auth.uid() AND claim.session_id=gs.id AND claim.expires_at>now()),
   'partner_in_session',p.id=ANY(gs.connected_player_ids) AND EXISTS(SELECT 1 FROM player_game_claims claim WHERE claim.user_id=p.id AND claim.session_id=gs.id AND claim.expires_at>now()),
   'can_cancel',true,'session_status',gs.status)
   ORDER BY c.created_at DESC,c.id DESC)
 FROM game_challenges c JOIN kid_profiles p ON p.id=CASE WHEN c.from_kid_id=auth.uid() THEN c.to_kid_id ELSE c.from_kid_id END
 JOIN games g ON g.id=c.game_id JOIN game_sessions gs ON gs.id=c.session_id
 WHERE auth.uid() IN (c.from_kid_id,c.to_kid_id) AND c.status IN ('pending','accepted')
   AND c.fulfilled_at IS NULL AND gs.status<>'completed'),'[]'::jsonb);
END; $$;

CREATE INDEX IF NOT EXISTS game_challenges_session_id ON public.game_challenges(session_id);

-- Voxel projections remain exclusively owned by the voxel service.
CREATE OR REPLACE FUNCTION public.prepare_challenge_entry(p_id uuid,p_leave_session uuid DEFAULT NULL) RETURNS uuid
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
   IF old.status='playing' THEN RAISE EXCEPTION 'CURRENT_GAME_STARTED'; END IF;
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
