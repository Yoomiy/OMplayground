-- Applied remotely. Retained locally so Supabase migration history stays aligned.
ALTER TABLE public.classroom_sessions
  DROP COLUMN IF EXISTS attendance_tracking_started_at;
