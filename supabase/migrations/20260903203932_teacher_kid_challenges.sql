-- Teachers may discover same-gender connected kids and challenge them as a
-- player. The reverse direction and teacher-to-teacher challenges stay denied.

CREATE OR REPLACE FUNCTION public.kid_profiles_same_gender_visible(
  p_target_id uuid,
  p_target_role public.user_role,
  p_target_gender public.gender_type
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND p_target_role = 'kid'
    AND p_target_id IS DISTINCT FROM auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.kid_profiles me
      INNER JOIN public.kid_profiles target ON target.id = p_target_id
      WHERE me.id = auth.uid()
        AND me.role IN ('kid', 'teacher')
        AND me.is_active = true
        AND target.role = 'kid'
        AND target.is_active = true
        AND me.gender = p_target_gender
        AND target.gender = p_target_gender
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.kid_blocks block
      WHERE (block.blocker_id = auth.uid() AND block.blocked_id = p_target_id)
         OR (block.blocker_id = p_target_id AND block.blocked_id = auth.uid())
    );
$$;

COMMENT ON FUNCTION public.kid_profiles_same_gender_visible(uuid, public.user_role, public.gender_type)
  IS 'RLS helper: active kids are visible to same-gender kids and teachers.';

REVOKE ALL ON FUNCTION public.kid_profiles_same_gender_visible(uuid, public.user_role, public.gender_type) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kid_profiles_same_gender_visible(uuid, public.user_role, public.gender_type) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kid_profiles_same_gender_visible(uuid, public.user_role, public.gender_type) TO service_role;

-- Challenge creation is transactional so a rejected or duplicate challenge
-- cannot leave an orphaned private game session behind.
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

COMMENT ON FUNCTION public.create_game_challenge(uuid, uuid, text)
  IS 'Atomically creates kid-to-kid or teacher-to-kid challenges; all other role directions are denied.';

REVOKE ALL ON FUNCTION public.create_game_challenge(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_game_challenge(uuid, uuid, text) TO authenticated;

-- Recipients need the sender label for the incoming banner, but kid profile
-- visibility intentionally does not expose teacher profiles generally.
CREATE OR REPLACE FUNCTION public.get_game_challenge_sender(p_challenge_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'display_name', sender.full_name,
    'role', sender.role
  )
  FROM public.game_challenges challenge
  INNER JOIN public.kid_profiles sender ON sender.id = challenge.from_kid_id
  WHERE challenge.id = p_challenge_id
    AND auth.uid() IN (challenge.from_kid_id, challenge.to_kid_id);
$$;

REVOKE ALL ON FUNCTION public.get_game_challenge_sender(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_game_challenge_sender(uuid) TO authenticated;

-- All challenge inserts now go through the guarded RPC above.
DROP POLICY IF EXISTS "game_challenges_insert_sender" ON public.game_challenges;
REVOKE INSERT ON public.game_challenges FROM anon, authenticated;
