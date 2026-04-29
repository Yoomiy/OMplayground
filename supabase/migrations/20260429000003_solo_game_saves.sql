-- Cross-device saved state for solo games.
-- This stores only disposable "continue where I stopped" snapshots; permanent
-- highscores/progress stay separate from this table.

CREATE TABLE IF NOT EXISTS public.solo_game_saves (
  kid_id uuid NOT NULL REFERENCES public.kid_profiles (id) ON DELETE CASCADE,
  game_key text NOT NULL,
  state jsonb NOT NULL,
  state_version integer NOT NULL DEFAULT 1,
  save_kind text NOT NULL DEFAULT 'snapshot',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kid_id, game_key),
  CONSTRAINT solo_game_saves_game_key_chk CHECK (length(trim(game_key)) > 0),
  CONSTRAINT solo_game_saves_save_kind_chk CHECK (save_kind IN ('snapshot', 'checkpoint'))
);

CREATE INDEX IF NOT EXISTS solo_game_saves_updated_at
  ON public.solo_game_saves (kid_id, updated_at DESC);

ALTER TABLE public.solo_game_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "solo_game_saves_select_own"
  ON public.solo_game_saves FOR SELECT
  USING (auth.uid() = kid_id);

CREATE POLICY "solo_game_saves_insert_own"
  ON public.solo_game_saves FOR INSERT
  WITH CHECK (auth.uid() = kid_id);

CREATE POLICY "solo_game_saves_update_own"
  ON public.solo_game_saves FOR UPDATE
  USING (auth.uid() = kid_id)
  WITH CHECK (auth.uid() = kid_id);

CREATE POLICY "solo_game_saves_delete_own"
  ON public.solo_game_saves FOR DELETE
  USING (auth.uid() = kid_id);

CREATE TRIGGER solo_game_saves_updated
BEFORE UPDATE ON public.solo_game_saves
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
