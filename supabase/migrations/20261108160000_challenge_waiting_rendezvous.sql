-- A waiting-room rendezvous must never consume its durable invitation.
-- A stale or briefly overlapping presence projection cannot strand the other child.
CREATE FUNCTION public.guard_waiting_challenge_fulfillment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.fulfilled_at IS NOT NULL AND EXISTS(
   SELECT 1 FROM game_sessions WHERE id=NEW.session_id AND status='waiting'
 ) THEN NEW.fulfilled_at := NULL; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.guard_waiting_challenge_fulfillment() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_waiting_challenge_fulfillment BEFORE INSERT OR UPDATE OF fulfilled_at ON public.game_challenges
FOR EACH ROW EXECUTE FUNCTION public.guard_waiting_challenge_fulfillment();

-- Repair invitations previously consumed by a waiting-room presence overlap.
UPDATE public.game_challenges c SET fulfilled_at=NULL FROM public.game_sessions s
WHERE s.id=c.session_id AND s.status='waiting' AND c.status='accepted' AND c.fulfilled_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fulfill_entered_challenges() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status='waiting' THEN RETURN NEW; END IF;
 UPDATE game_challenges c SET fulfilled_at=now()
 WHERE c.session_id=NEW.id AND c.status='accepted' AND c.fulfilled_at IS NULL
   AND NEW.connected_player_ids @> ARRAY[c.from_kid_id,c.to_kid_id]
   AND (SELECT count(*) FROM player_game_claims claim
     WHERE claim.user_id IN (c.from_kid_id,c.to_kid_id) AND claim.session_id=NEW.id AND claim.expires_at>now())=2;
 RETURN NEW;
END; $$;
-- Claim maintenance must run first, so fulfillment sees the committed membership lease.
DROP TRIGGER fulfill_entered_challenges ON public.game_sessions;
CREATE TRIGGER zz_fulfill_entered_challenges AFTER UPDATE OF connected_player_ids,status ON public.game_sessions
FOR EACH ROW EXECUTE FUNCTION public.fulfill_entered_challenges();

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
   AND c.fulfilled_at IS NULL AND gs.status<>'completed'
   -- Waiting-room presence is reversible. Hide only while both are really here.
   AND NOT (gs.status='waiting' AND gs.connected_player_ids @> ARRAY[c.from_kid_id,c.to_kid_id]
     AND (SELECT count(*) FROM player_game_claims claim
       WHERE claim.user_id IN (c.from_kid_id,c.to_kid_id) AND claim.session_id=gs.id AND claim.expires_at>now())=2)),'[]'::jsonb);
END; $$;

