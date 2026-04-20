-- Persist host grade on session row for teacher filters / reporting (TODO #10).
ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS host_grade integer CHECK (host_grade IS NULL OR (host_grade >= 1 AND host_grade <= 7));

COMMENT ON COLUMN public.game_sessions.host_grade IS 'Copy of host kid grade at session create / host transfer; avoids stale joins.';

UPDATE public.game_sessions gs
SET host_grade = kp.grade
FROM public.kid_profiles kp
WHERE kp.id = gs.host_id
  AND gs.host_grade IS NULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.moderation_reports;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
