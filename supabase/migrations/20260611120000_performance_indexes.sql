-- Performance indexes for hot Playground query paths (phases 1–2 optimization plan).

CREATE INDEX IF NOT EXISTS game_sessions_paused_activity
  ON public.game_sessions (last_activity)
  WHERE status = 'paused';

CREATE INDEX IF NOT EXISTS game_sessions_open_active
  ON public.game_sessions (gender, created_at DESC)
  WHERE is_open = true AND status IN ('waiting', 'playing');

CREATE INDEX IF NOT EXISTS game_sessions_player_ids_gin
  ON public.game_sessions USING GIN (player_ids);

CREATE INDEX IF NOT EXISTS private_messages_to_created
  ON public.private_messages (to_kid_id, created_at DESC);

CREATE INDEX IF NOT EXISTS private_messages_from_created
  ON public.private_messages (from_kid_id, created_at DESC);

CREATE INDEX IF NOT EXISTS games_active_gender
  ON public.games (for_gender)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS kid_blocks_blocked_id
  ON public.kid_blocks (blocked_id);

CREATE INDEX IF NOT EXISTS kid_profiles_gender_role_active
  ON public.kid_profiles (gender, role)
  WHERE is_active = true;

-- Reduce Realtime payload size where old row values are not needed.
ALTER TABLE public.kid_profiles REPLICA IDENTITY DEFAULT;
ALTER TABLE public.private_messages REPLICA IDENTITY DEFAULT;
