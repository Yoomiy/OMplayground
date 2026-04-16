-- RLS policies and Realtime replica identity

ALTER TABLE public.kid_profiles REPLICA IDENTITY FULL;
ALTER TABLE public.private_messages REPLICA IDENTITY FULL;
ALTER TABLE public.friendships REPLICA IDENTITY FULL;

ALTER TABLE public.kid_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recess_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avatar_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kid_blocks ENABLE ROW LEVEL SECURITY;

-- kid_profiles: own row
CREATE POLICY "kid_profiles_select_own"
  ON public.kid_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "kid_profiles_update_own"
  ON public.kid_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "kid_profiles_insert_own"
  ON public.kid_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Friends can read limited fields via friendship (accepted)
CREATE POLICY "kid_profiles_select_friend"
  ON public.kid_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.status = 'accepted'
        AND (
          (f.requester_id = auth.uid() AND f.addressee_id = public.kid_profiles.id)
          OR (f.addressee_id = auth.uid() AND f.requester_id = public.kid_profiles.id)
        )
    )
  );

-- Same gender for inbox targeting / discovery (narrow; adjust per product)
CREATE POLICY "kid_profiles_select_same_gender"
  ON public.kid_profiles FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND public.kid_profiles.role = 'kid'
    AND EXISTS (
      SELECT 1 FROM public.kid_profiles me
      WHERE me.id = auth.uid()
        AND me.role = 'kid'
        AND me.gender = public.kid_profiles.gender
        AND public.kid_profiles.id <> auth.uid()
    )
  );

-- games: read active catalog for authenticated users
CREATE POLICY "games_select_authenticated"
  ON public.games FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = true);

-- recess_schedules: readable when logged in
CREATE POLICY "recess_select_authenticated"
  ON public.recess_schedules FOR SELECT
  USING (auth.role() = 'authenticated');

-- avatar_presets
CREATE POLICY "avatar_presets_select_authenticated"
  ON public.avatar_presets FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = true);

-- game_sessions: participants + same gender
CREATE POLICY "game_sessions_select_participant_or_gender"
  ON public.game_sessions FOR SELECT
  USING (
    auth.uid() = ANY (player_ids)
    OR (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.kid_profiles kp
        WHERE kp.id = auth.uid()
          AND kp.gender = public.game_sessions.gender
      )
    )
  );

CREATE POLICY "game_sessions_insert_host"
  ON public.game_sessions FOR INSERT
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "game_sessions_update_participant"
  ON public.game_sessions FOR UPDATE
  USING (
    auth.uid() = ANY (player_ids)
    OR auth.uid() = host_id
  );

-- chat_messages: session participants
CREATE POLICY "chat_messages_select_session"
  ON public.chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.game_sessions gs
      WHERE gs.id = session_id
        AND auth.uid() = ANY (gs.player_ids)
    )
  );

CREATE POLICY "chat_messages_insert_participant"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.game_sessions gs
      WHERE gs.id = session_id
        AND auth.uid() = ANY (gs.player_ids)
    )
  );

-- private_messages
CREATE POLICY "private_messages_select_involved"
  ON public.private_messages FOR SELECT
  USING (auth.uid() = from_kid_id OR auth.uid() = to_kid_id);

CREATE POLICY "private_messages_insert_from_self"
  ON public.private_messages FOR INSERT
  WITH CHECK (
    from_kid_id = auth.uid()
    AND is_from_admin = false
    AND EXISTS (
      SELECT 1 FROM public.kid_profiles me, public.kid_profiles them
      WHERE me.id = auth.uid()
        AND them.id = to_kid_id
        AND me.gender = them.gender
        AND me.role = 'kid'
        AND them.role = 'kid'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.kid_blocks b
      WHERE b.blocker_id = to_kid_id
        AND b.blocked_id = auth.uid()
    )
  );

CREATE POLICY "private_messages_update_recipient_read"
  ON public.private_messages FOR UPDATE
  USING (auth.uid() = to_kid_id)
  WITH CHECK (auth.uid() = to_kid_id);

-- friendships
CREATE POLICY "friendships_select_involved"
  ON public.friendships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "friendships_insert_requester"
  ON public.friendships FOR INSERT
  WITH CHECK (
    auth.uid() = requester_id
    AND NOT EXISTS (
      SELECT 1 FROM public.kid_blocks b
      WHERE (b.blocker_id = addressee_id AND b.blocked_id = requester_id)
         OR (b.blocker_id = requester_id AND b.blocked_id = addressee_id)
    )
  );

CREATE POLICY "friendships_update_addressee"
  ON public.friendships FOR UPDATE
  USING (auth.uid() = addressee_id OR auth.uid() = requester_id);

-- kid_blocks
CREATE POLICY "kid_blocks_select_own"
  ON public.kid_blocks FOR SELECT
  USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

CREATE POLICY "kid_blocks_insert_blocker"
  ON public.kid_blocks FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "kid_blocks_delete_blocker"
  ON public.kid_blocks FOR DELETE
  USING (auth.uid() = blocker_id);

-- moderation_reports: insert own; admin handled via service role / future admin policies
CREATE POLICY "moderation_reports_insert_reporter"
  ON public.moderation_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_kid_id);

CREATE POLICY "moderation_reports_select_own"
  ON public.moderation_reports FOR SELECT
  USING (auth.uid() = reporter_kid_id);

-- admin_profiles: only self
CREATE POLICY "admin_profiles_select_self"
  ON public.admin_profiles FOR SELECT
  USING (auth.uid() = id);

-- Note: Admin CRUD on games/recess/etc. uses service role on backend or dedicated admin policies later.
