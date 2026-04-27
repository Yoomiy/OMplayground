ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS connected_player_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  ADD COLUMN IF NOT EXISTS connected_player_names text[] NOT NULL DEFAULT ARRAY[]::text[];

COMMENT ON COLUMN public.game_sessions.connected_player_ids IS 'Currently connected participant ids for paused/resume multiplayer UI.';
COMMENT ON COLUMN public.game_sessions.connected_player_names IS 'Currently connected participant display names aligned with connected_player_ids.';
