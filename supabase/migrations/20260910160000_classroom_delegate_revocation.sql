-- Delegated cohosts are revocable classroom authority, distinct from teachers
-- and administrators who have independent staff authority.
ALTER TABLE public.classroom_host_delegates
  ADD COLUMN IF NOT EXISTS participant_key TEXT;

ALTER TABLE public.classroom_delegate_enrollments
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS classroom_host_delegates_active_participant_unique
  ON public.classroom_host_delegates (classroom_id, participant_key)
  WHERE is_active = TRUE AND participant_key IS NOT NULL;
