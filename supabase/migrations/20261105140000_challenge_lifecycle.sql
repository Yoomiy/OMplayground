-- Leased admission prevents stale presence after a service crash blocking a player forever.
CREATE TABLE public.player_game_claims (
  user_id uuid PRIMARY KEY REFERENCES public.kid_profiles(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
ALTER TABLE public.player_game_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.player_game_claims FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.player_game_claims TO service_role;
CREATE INDEX player_game_claims_session ON public.player_game_claims(session_id);
-- Invitation expiry is authoritative even when no client is connected.
CREATE OR REPLACE FUNCTION public.cleanup_game_challenges() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE game_challenges c SET status = 'expired'
  WHERE c.expires_at <= now() AND (c.status = 'pending' OR
    (c.status = 'accepted' AND EXISTS (SELECT 1 FROM game_sessions s WHERE s.id = c.session_id AND s.status = 'waiting' AND cardinality(s.connected_player_ids) = 0)));
  UPDATE game_sessions s SET status = 'completed', ended_at = now()
  WHERE s.status = 'waiting' AND cardinality(s.connected_player_ids) = 0
    AND EXISTS (SELECT 1 FROM game_challenges c WHERE c.session_id = s.id AND c.status IN ('expired','declined'))
    AND NOT EXISTS (SELECT 1 FROM game_challenges c WHERE c.session_id = s.id AND c.status IN ('pending','accepted'));
END; $$;
REVOKE ALL ON FUNCTION public.cleanup_game_challenges() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_game_challenges() TO service_role;
SELECT public.cleanup_game_challenges();
DROP INDEX IF EXISTS public.game_challenges_one_pending_per_recipient;
CREATE UNIQUE INDEX game_challenges_pending_pair_game ON public.game_challenges(from_kid_id, to_kid_id, game_id) WHERE status = 'pending';
CREATE OR REPLACE FUNCTION public.create_game_challenge(
  p_to_id uuid,
  p_game_id uuid,
  p_correlation_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor public.kid_profiles%ROWTYPE;
  v_target public.kid_profiles%ROWTYPE;
  v_game public.games%ROWTYPE;
  v_session_id uuid;
  v_challenge_id uuid;
  v_invitation_code text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_actor
  FROM public.kid_profiles
  WHERE id = auth.uid() AND is_active = true;

  SELECT * INTO v_target
  FROM public.kid_profiles
  WHERE id = p_to_id AND is_active = true;

  IF v_actor.id IS NULL OR v_target.id IS NULL THEN
    RAISE EXCEPTION 'PROFILE_NOT_AVAILABLE';
  END IF;
  IF v_actor.id = v_target.id THEN
    RAISE EXCEPTION 'CANNOT_CHALLENGE_SELF';
  END IF;
  IF v_target.role <> 'kid'
    OR v_actor.role NOT IN ('kid', 'teacher')
    OR v_actor.gender <> v_target.gender
  THEN
    RAISE EXCEPTION 'CHALLENGE_NOT_ALLOWED';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.kid_blocks block
    WHERE (block.blocker_id = v_actor.id AND block.blocked_id = v_target.id)
       OR (block.blocker_id = v_target.id AND block.blocked_id = v_actor.id)
  ) THEN
    RAISE EXCEPTION 'CHALLENGE_NOT_ALLOWED';
  END IF;

  SELECT * INTO v_game
  FROM public.games
  WHERE id = p_game_id
    AND is_active = true
    AND is_multiplayer = true;

  IF v_game.id IS NULL
    OR (v_game.for_gender <> 'both' AND v_game.for_gender::text <> v_actor.gender::text)
  THEN
    RAISE EXCEPTION 'GAME_NOT_AVAILABLE';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_actor.id::text || p_to_id::text || p_game_id::text, 0));
  PERFORM public.cleanup_game_challenges();
  SELECT id, session_id INTO v_challenge_id, v_session_id FROM public.game_challenges
    WHERE from_kid_id = v_actor.id AND to_kid_id = p_to_id AND game_id = p_game_id AND status = 'pending';
  IF FOUND THEN
    RETURN jsonb_build_object('session_id', v_session_id, 'challenge_id', v_challenge_id);
  END IF;
  INSERT INTO public.game_sessions (
    game_id,
    host_id,
    host_name,
    host_grade,
    player_ids,
    player_names,
    status,
    is_open,
    invitation_code,
    gender
  ) VALUES (
    v_game.id,
    v_actor.id,
    v_actor.full_name,
    v_actor.grade,
    ARRAY[v_actor.id],
    ARRAY[v_actor.full_name],
    'waiting',
    false,
    v_invitation_code,
    v_actor.gender
  )
  RETURNING id INTO v_session_id;

  INSERT INTO public.game_challenges (
    from_kid_id,
    to_kid_id,
    session_id,
    game_id
  ) VALUES (
    v_actor.id,
    v_target.id,
    v_session_id,
    v_game.id
  )
  RETURNING id INTO v_challenge_id;

  IF v_actor.role = 'teacher' THEN
    PERFORM public.append_audit_log(
      v_actor.id,
      'teacher',
      'teacher_game_challenge_created',
      'game_challenge',
      v_challenge_id,
      jsonb_build_object(
        'session_id', v_session_id,
        'target_profile_id', v_target.id,
        'game_id', v_game.id
      ),
      p_correlation_id
    );
  END IF;

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'challenge_id', v_challenge_id
  );
END;
$$;


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
    UPDATE game_challenges SET status='accepted', expires_at=now()+interval '5 minutes' WHERE id=c.id RETURNING * INTO c;
  ELSIF p_action='decline' AND auth.uid()=c.to_kid_id AND c.status='pending' THEN
    UPDATE game_challenges SET status='declined' WHERE id=c.id RETURNING * INTO c;
  ELSIF p_action='cancel' AND auth.uid()=c.from_kid_id AND c.status IN ('pending','accepted') THEN
    IF EXISTS (SELECT 1 FROM game_sessions WHERE id=c.session_id AND (status <> 'waiting' OR cardinality(connected_player_ids)>0)) THEN RAISE EXCEPTION 'SESSION_ALREADY_ENTERED'; END IF;
    UPDATE game_challenges SET status='expired' WHERE id=c.id RETURNING * INTO c;
  ELSE RAISE EXCEPTION 'CHALLENGE_UNAVAILABLE'; END IF;
  PERFORM public.cleanup_game_challenges();
  RETURN to_jsonb(c);
END; $$;
REVOKE ALL ON FUNCTION public.respond_game_challenge(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_game_challenge(uuid,text) TO authenticated;
REVOKE UPDATE ON public.game_challenges FROM anon, authenticated;

-- Read only participant information; never expose general teacher profiles.
CREATE OR REPLACE FUNCTION public.list_game_challenges() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  PERFORM public.cleanup_game_challenges();
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(c) || jsonb_build_object(
    'partner_role', p.role, 'partner_name', p.full_name, 'game_name', g.name_he,
    'self_busy', EXISTS (SELECT 1 FROM player_game_claims claim WHERE claim.session_id <> c.session_id AND claim.user_id=auth.uid() AND claim.expires_at > now()),
    'partner_busy', EXISTS (SELECT 1 FROM player_game_claims claim WHERE claim.session_id <> c.session_id AND claim.user_id=p.id AND claim.expires_at > now()),
    'partner_online', EXISTS (SELECT 1 FROM game_sessions s WHERE p.id=ANY(s.connected_player_ids)),
    'can_cancel', cardinality(gs.connected_player_ids)=0, 'session_status', gs.status))
    FROM game_challenges c JOIN kid_profiles p ON p.id=CASE WHEN c.from_kid_id=auth.uid() THEN c.to_kid_id ELSE c.from_kid_id END
    JOIN games g ON g.id=c.game_id JOIN game_sessions gs ON gs.id=c.session_id
    WHERE auth.uid() IN (c.from_kid_id,c.to_kid_id) AND c.status IN ('pending','accepted') AND gs.status='waiting'), '[]'::jsonb);
END; $$;
REVOKE ALL ON FUNCTION public.list_game_challenges() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_game_challenges() TO authenticated;

-- All game services persist connected membership through this table.
CREATE OR REPLACE FUNCTION public.guard_single_active_game() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE player uuid;
BEGIN
  DELETE FROM player_game_claims WHERE session_id=NEW.id
    AND (NEW.status NOT IN ('waiting','playing') OR NOT (user_id=ANY(NEW.connected_player_ids)));
  IF NEW.status NOT IN ('waiting','playing') THEN RETURN NEW; END IF;
  FOR player IN SELECT unnest(NEW.connected_player_ids) ORDER BY 1 LOOP
    INSERT INTO player_game_claims(user_id,session_id,expires_at)
      VALUES (player,NEW.id,now()+interval '90 seconds')
      ON CONFLICT(user_id) DO UPDATE SET session_id=EXCLUDED.session_id,expires_at=EXCLUDED.expires_at
      WHERE player_game_claims.session_id=NEW.id OR player_game_claims.expires_at<=now();
    IF NOT FOUND THEN RAISE EXCEPTION 'PLAYER_IN_ANOTHER_GAME'; END IF;
  END LOOP;
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_single_active_game AFTER INSERT OR UPDATE OF connected_player_ids, status ON public.game_sessions FOR EACH ROW EXECUTE FUNCTION public.guard_single_active_game();

-- Cleanup continues when all browser clients are closed.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('expire-game-challenges', '* * * * *', 'SELECT public.cleanup_game_challenges()');
  END IF;
END $$;
