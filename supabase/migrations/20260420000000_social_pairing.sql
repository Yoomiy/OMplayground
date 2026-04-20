-- Social + pairing normalization:
--   * new game_challenges table (replaces kid_profiles.pending_challenge)
--   * tighten friendships RLS + canonical-pair uniqueness
--   * add can_interact_with() helper (SECURITY DEFINER) to avoid RLS recursion
--   * RPCs: send_friend_request(to_uid), block_kid(target)
--   * drop legacy private_messages.type / friend_request_status columns

-- ---------- Helper: pairwise interaction visibility (same-gender kid, not blocked) ----------
CREATE OR REPLACE FUNCTION public.can_interact_with(p_target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND p_target IS DISTINCT FROM auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.kid_profiles me, public.kid_profiles them
      WHERE me.id = auth.uid()
        AND them.id = p_target
        AND me.role = 'kid'
        AND them.role = 'kid'
        AND them.is_active = true
        AND me.gender = them.gender
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.kid_blocks b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p_target)
         OR (b.blocker_id = p_target AND b.blocked_id = auth.uid())
    );
$$;

REVOKE ALL ON FUNCTION public.can_interact_with(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_interact_with(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_interact_with(uuid) TO service_role;

-- ---------- game_challenges ----------
CREATE TYPE public.game_challenge_status AS ENUM ('pending','accepted','declined','expired');

CREATE TABLE public.game_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_kid_id uuid NOT NULL REFERENCES public.kid_profiles(id) ON DELETE CASCADE,
  to_kid_id   uuid NOT NULL REFERENCES public.kid_profiles(id) ON DELETE CASCADE,
  session_id  uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  game_id     uuid NOT NULL REFERENCES public.games(id),
  status public.game_challenge_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '2 minutes',
  CONSTRAINT game_challenges_no_self CHECK (from_kid_id <> to_kid_id)
);

CREATE INDEX game_challenges_to_pending
  ON public.game_challenges (to_kid_id)
  WHERE status = 'pending';

-- At most one pending challenge per recipient at any time.
CREATE UNIQUE INDEX game_challenges_one_pending_per_recipient
  ON public.game_challenges (to_kid_id)
  WHERE status = 'pending';

ALTER TABLE public.game_challenges REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_challenges;
ALTER TABLE public.game_challenges ENABLE ROW LEVEL SECURITY;

-- Realtime for open-games list (used by useOpenGames on the home page).
ALTER TABLE public.game_sessions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_sessions;

-- Realtime for block state (keeps friends UI consistent after block/unblock).
ALTER TABLE public.kid_blocks REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.kid_blocks;

CREATE POLICY "game_challenges_select_involved"
  ON public.game_challenges FOR SELECT
  USING (auth.uid() = from_kid_id OR auth.uid() = to_kid_id);

CREATE POLICY "game_challenges_insert_sender"
  ON public.game_challenges FOR INSERT
  WITH CHECK (
    auth.uid() = from_kid_id
    AND public.can_interact_with(to_kid_id)
    AND EXISTS (
      SELECT 1 FROM public.game_sessions gs
      WHERE gs.id = session_id
        AND gs.host_id = auth.uid()
    )
  );

-- Recipient may accept/decline a pending challenge.
CREATE POLICY "game_challenges_update_recipient"
  ON public.game_challenges FOR UPDATE
  USING (auth.uid() = to_kid_id AND status = 'pending')
  WITH CHECK (auth.uid() = to_kid_id AND status IN ('accepted','declined'));

-- Sender may expire their own pending challenge (e.g. cancel / timeout).
CREATE POLICY "game_challenges_update_sender_expire"
  ON public.game_challenges FOR UPDATE
  USING (auth.uid() = from_kid_id AND status = 'pending')
  WITH CHECK (auth.uid() = from_kid_id AND status = 'expired');

-- ---------- friendships: tighten ----------

-- Canonical-pair uniqueness (prevents A->B and B->A both existing).
CREATE UNIQUE INDEX friendships_canonical_pair
  ON public.friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));

DROP POLICY IF EXISTS "friendships_insert_requester" ON public.friendships;
CREATE POLICY "friendships_insert_requester"
  ON public.friendships FOR INSERT
  WITH CHECK (
    auth.uid() = requester_id
    AND public.can_interact_with(addressee_id)
  );

-- Replace the permissive update policy with a narrow one: only addressee can
-- transition pending -> accepted|declined.
DROP POLICY IF EXISTS "friendships_update_addressee" ON public.friendships;
CREATE POLICY "friendships_update_addressee"
  ON public.friendships FOR UPDATE
  USING (auth.uid() = addressee_id AND status = 'pending')
  WITH CHECK (auth.uid() = addressee_id AND status IN ('accepted','declined'));

-- Either side may delete (unfriend / withdraw request).
CREATE POLICY "friendships_delete_involved"
  ON public.friendships FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- ---------- RPC: send_friend_request ----------
-- Atomic "send or auto-accept if reverse pending already exists".
CREATE OR REPLACE FUNCTION public.send_friend_request(to_uid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  reverse_id uuid;
  existing_status public.friendship_status;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;
  IF to_uid = me THEN
    RAISE EXCEPTION 'CANNOT_FRIEND_SELF';
  END IF;
  IF NOT public.can_interact_with(to_uid) THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;

  SELECT status INTO existing_status
  FROM public.friendships
  WHERE (requester_id = me AND addressee_id = to_uid)
     OR (requester_id = to_uid AND addressee_id = me)
  LIMIT 1;

  IF existing_status = 'accepted' THEN
    RETURN jsonb_build_object('status','accepted','mutual',true,'already',true);
  END IF;

  -- Auto-accept if reverse pending exists.
  SELECT id INTO reverse_id
  FROM public.friendships
  WHERE requester_id = to_uid AND addressee_id = me AND status = 'pending';

  IF reverse_id IS NOT NULL THEN
    UPDATE public.friendships
      SET status = 'accepted', updated_at = now()
    WHERE id = reverse_id;
    RETURN jsonb_build_object('status','accepted','mutual',true);
  END IF;

  -- Forward pending exists (maybe declined previously)? Upsert.
  INSERT INTO public.friendships (requester_id, addressee_id, status)
  VALUES (me, to_uid, 'pending')
  ON CONFLICT (requester_id, addressee_id) DO UPDATE
    SET status = 'pending', updated_at = now();

  RETURN jsonb_build_object('status','pending');
END;
$$;

REVOKE ALL ON FUNCTION public.send_friend_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_friend_request(uuid) TO authenticated;

-- ---------- RPC: block_kid ----------
CREATE OR REPLACE FUNCTION public.block_kid(target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;
  IF target = me THEN
    RAISE EXCEPTION 'CANNOT_BLOCK_SELF';
  END IF;

  INSERT INTO public.kid_blocks (blocker_id, blocked_id)
  VALUES (me, target)
  ON CONFLICT DO NOTHING;

  DELETE FROM public.friendships
  WHERE (requester_id = me AND addressee_id = target)
     OR (requester_id = target AND addressee_id = me);

  UPDATE public.game_challenges
    SET status = 'declined'
  WHERE status = 'pending'
    AND ((from_kid_id = me AND to_kid_id = target)
      OR (from_kid_id = target AND to_kid_id = me));
END;
$$;

REVOKE ALL ON FUNCTION public.block_kid(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.block_kid(uuid) TO authenticated;

-- ---------- Cleanups: drop superseded columns / enums ----------
ALTER TABLE public.private_messages DROP COLUMN IF EXISTS friend_request_status;
ALTER TABLE public.private_messages DROP COLUMN IF EXISTS type;
DROP TYPE IF EXISTS public.private_message_type;
DROP TYPE IF EXISTS public.friend_request_status;

ALTER TABLE public.kid_profiles DROP COLUMN IF EXISTS pending_challenge;
