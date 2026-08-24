-- Classroom whiteboards are infrastructure owned by the classroom record,
-- not ordinary multiplayer sessions owned by a kid profile.
ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS classroom_id UUID
  REFERENCES public.classroom_sessions(id) ON DELETE CASCADE;

-- Existing boards already have a unique class-draw-{roomCode} reservation.
SELECT set_config('playground.allow_game_session_authority_write', 'true', true);

UPDATE public.game_sessions AS game_session
SET classroom_id = classroom.id
FROM public.classroom_sessions AS classroom
WHERE game_session.classroom_id IS NULL
  AND game_session.invitation_code = 'class-draw-' || classroom.room_code;

ALTER TABLE public.game_sessions ALTER COLUMN host_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'game_sessions_host_or_classroom_owner'
      AND conrelid = 'public.game_sessions'::regclass
  ) THEN
    ALTER TABLE public.game_sessions
      ADD CONSTRAINT game_sessions_host_or_classroom_owner
      CHECK (host_id IS NOT NULL OR classroom_id IS NOT NULL);
  END IF;
END
$$;

-- This partial unique index is also the concurrency lock for idempotent board
-- provisioning in the trusted RTC service.
CREATE UNIQUE INDEX IF NOT EXISTS game_sessions_classroom_id_unique
  ON public.game_sessions(classroom_id)
  WHERE classroom_id IS NOT NULL;

-- The board ID is now returned by the trusted classroom-token endpoint. Do not
-- expose every reserved classroom drawing row through the public Data API.
DROP POLICY IF EXISTS "game_sessions_select_classroom_draw" ON public.game_sessions;

-- Classroom ownership is authoritative infrastructure. Authenticated clients
-- may still create ordinary hosted games, but cannot claim a classroom FK or
-- the reserved invitation namespace before the trusted provisioner does.
DROP POLICY IF EXISTS "game_sessions_insert_host" ON public.game_sessions;
CREATE POLICY "game_sessions_insert_host"
  ON public.game_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = host_id
    AND classroom_id IS NULL
    AND invitation_code NOT LIKE 'class-draw-%'
  );

CREATE OR REPLACE FUNCTION public.guard_game_sessions_authoritative_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF current_setting('playground.allow_game_session_authority_write', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF NEW.game_state IS DISTINCT FROM OLD.game_state
    OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.player_ids IS DISTINCT FROM OLD.player_ids
    OR NEW.player_names IS DISTINCT FROM OLD.player_names
    OR NEW.host_id IS DISTINCT FROM OLD.host_id
    OR NEW.classroom_id IS DISTINCT FROM OLD.classroom_id
    OR NEW.gender IS DISTINCT FROM OLD.gender
    OR NEW.connected_player_ids IS DISTINCT FROM OLD.connected_player_ids
    OR NEW.connected_player_names IS DISTINCT FROM OLD.connected_player_names
    OR NEW.host_name IS DISTINCT FROM OLD.host_name
    OR NEW.host_grade IS DISTINCT FROM OLD.host_grade
    OR NEW.ended_at IS DISTINCT FROM OLD.ended_at
    OR NEW.game_id IS DISTINCT FROM OLD.game_id
  THEN
    RAISE EXCEPTION 'game_sessions_authoritative_field';
  END IF;

  RETURN NEW;
END;
$$;
