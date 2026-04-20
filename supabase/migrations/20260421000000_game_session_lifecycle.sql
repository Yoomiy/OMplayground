-- Milestone A: game lifecycle boundaries.
-- Persist when and why a session terminated so teachers / admins can audit and
-- so the client can show end-of-game overlays without reconstructing state.

ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS stopped_by uuid REFERENCES public.kid_profiles (id);
