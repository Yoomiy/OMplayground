-- Durable classroom records and LiveKit-backed attendance history.
-- A classroom may be closed or auto-expired without deleting this history.

ALTER TABLE public.classroom_sessions
  ADD COLUMN IF NOT EXISTS attendance_tracking_started_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.classroom_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID NOT NULL REFERENCES public.classroom_sessions(id) ON DELETE CASCADE,
  livekit_room_sid TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  close_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (classroom_id, livekit_room_sid)
);

CREATE INDEX IF NOT EXISTS idx_classroom_meetings_classroom_started
  ON public.classroom_meetings (classroom_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.classroom_meeting_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.classroom_meetings(id) ON DELETE CASCADE,
  participant_key TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  roles_held TEXT[] NOT NULL DEFAULT ARRAY['participant']::TEXT[],
  first_joined_at TIMESTAMPTZ NOT NULL,
  last_left_at TIMESTAMPTZ,
  total_seconds BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, participant_key)
);

CREATE INDEX IF NOT EXISTS idx_classroom_meeting_participants_meeting
  ON public.classroom_meeting_participants (meeting_id, first_joined_at);

CREATE INDEX IF NOT EXISTS idx_classroom_meeting_participants_name
  ON public.classroom_meeting_participants (lower(display_name));

CREATE TABLE IF NOT EXISTS public.classroom_participant_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.classroom_meeting_participants(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES public.classroom_meetings(id) ON DELETE CASCADE,
  livekit_participant_sid TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL,
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, livekit_participant_sid)
);

CREATE INDEX IF NOT EXISTS idx_classroom_participant_visits_participant
  ON public.classroom_participant_visits (participant_id, joined_at);

-- LiveKit retries requests and a server restart can replay an event. Persisting
-- its event UUID makes every attendance transition idempotent.
CREATE TABLE IF NOT EXISTS public.classroom_attendance_events (
  livekit_event_id UUID PRIMARY KEY,
  classroom_id UUID REFERENCES public.classroom_sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.classroom_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_participant_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_attendance_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.classroom_meetings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.classroom_meeting_participants FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.classroom_participant_visits FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.classroom_attendance_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.classroom_meetings TO service_role;
GRANT ALL ON TABLE public.classroom_meeting_participants TO service_role;
GRANT ALL ON TABLE public.classroom_participant_visits TO service_role;
GRANT ALL ON TABLE public.classroom_attendance_events TO service_role;

CREATE OR REPLACE FUNCTION public.record_classroom_attendance_event(
  p_event_id UUID,
  p_event_type TEXT,
  p_room_code TEXT,
  p_room_sid TEXT,
  p_participant_sid TEXT DEFAULT NULL,
  p_participant_identity TEXT DEFAULT NULL,
  p_participant_name TEXT DEFAULT NULL,
  p_participant_metadata JSONB DEFAULT '{}'::JSONB,
  p_occurred_at TIMESTAMPTZ DEFAULT now()
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_classroom_id UUID;
  v_meeting_id UUID;
  v_participant_id UUID;
  v_participant_key TEXT;
  v_role TEXT;
  v_seconds BIGINT;
BEGIN
  SELECT id INTO v_classroom_id
  FROM public.classroom_sessions
  WHERE room_code = p_room_code;

  IF v_classroom_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.classroom_attendance_events (livekit_event_id, classroom_id, event_type)
  VALUES (p_event_id, v_classroom_id, p_event_type)
  ON CONFLICT (livekit_event_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF p_event_type = 'room_started' THEN
    INSERT INTO public.classroom_meetings (classroom_id, livekit_room_sid, started_at)
    VALUES (v_classroom_id, p_room_sid, p_occurred_at)
    ON CONFLICT (classroom_id, livekit_room_sid) DO NOTHING;
    UPDATE public.classroom_sessions SET last_activity = p_occurred_at WHERE id = v_classroom_id;
    RETURN;
  END IF;

  SELECT id INTO v_meeting_id
  FROM public.classroom_meetings
  WHERE classroom_id = v_classroom_id AND livekit_room_sid = p_room_sid;

  IF v_meeting_id IS NULL AND p_event_type = 'participant_joined' THEN
    INSERT INTO public.classroom_meetings (classroom_id, livekit_room_sid, started_at)
    VALUES (v_classroom_id, p_room_sid, p_occurred_at)
    ON CONFLICT (classroom_id, livekit_room_sid) DO UPDATE SET started_at = LEAST(classroom_meetings.started_at, EXCLUDED.started_at)
    RETURNING id INTO v_meeting_id;
  END IF;

  IF v_meeting_id IS NULL THEN
    RETURN;
  END IF;

  IF p_event_type = 'participant_joined' THEN
    IF COALESCE((p_participant_metadata ->> 'hidden')::BOOLEAN, FALSE) THEN
      RETURN;
    END IF;
    v_participant_key := COALESCE(NULLIF(p_participant_metadata ->> 'attendanceKey', ''), NULLIF(p_participant_identity, ''));
    IF v_participant_key IS NULL THEN
      RETURN;
    END IF;
    v_role := COALESCE(NULLIF(p_participant_metadata ->> 'attendanceRole', ''), 'participant');

    INSERT INTO public.classroom_meeting_participants (
      meeting_id, participant_key, user_id, display_name, roles_held, first_joined_at
    ) VALUES (
      v_meeting_id,
      v_participant_key,
      CASE WHEN p_participant_identity ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN p_participant_identity::UUID ELSE NULL END,
      COALESCE(NULLIF(p_participant_name, ''), 'משתתף'),
      ARRAY[v_role],
      p_occurred_at
    ) ON CONFLICT (meeting_id, participant_key) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      roles_held = ARRAY(SELECT DISTINCT unnest(classroom_meeting_participants.roles_held || EXCLUDED.roles_held))
    RETURNING id INTO v_participant_id;

    INSERT INTO public.classroom_participant_visits (
      participant_id, meeting_id, livekit_participant_sid, joined_at
    ) VALUES (v_participant_id, v_meeting_id, p_participant_sid, p_occurred_at)
    ON CONFLICT (meeting_id, livekit_participant_sid) DO NOTHING;
    UPDATE public.classroom_sessions SET last_activity = p_occurred_at WHERE id = v_classroom_id;
    RETURN;
  END IF;

  IF p_event_type = 'participant_left' THEN
    UPDATE public.classroom_participant_visits AS v
    SET left_at = p_occurred_at
    WHERE v.meeting_id = v_meeting_id
      AND v.livekit_participant_sid = p_participant_sid
      AND v.left_at IS NULL
    RETURNING v.participant_id, GREATEST(0, EXTRACT(EPOCH FROM p_occurred_at - v.joined_at))::BIGINT
    INTO v_participant_id, v_seconds;
    IF FOUND THEN
      UPDATE public.classroom_meeting_participants
      SET last_left_at = p_occurred_at,
          total_seconds = total_seconds + v_seconds
      WHERE id = v_participant_id;
    END IF;
    UPDATE public.classroom_sessions SET last_activity = p_occurred_at WHERE id = v_classroom_id;
    RETURN;
  END IF;

  IF p_event_type = 'room_finished' THEN
    UPDATE public.classroom_participant_visits
    SET left_at = p_occurred_at
    WHERE meeting_id = v_meeting_id AND left_at IS NULL;
    UPDATE public.classroom_meeting_participants AS p
    SET total_seconds = COALESCE((
          SELECT SUM(GREATEST(0, EXTRACT(EPOCH FROM COALESCE(v.left_at, p_occurred_at) - v.joined_at))::BIGINT)
          FROM public.classroom_participant_visits v
          WHERE v.participant_id = p.id
        ), 0),
        last_left_at = p_occurred_at
    WHERE p.meeting_id = v_meeting_id;
    UPDATE public.classroom_meetings
    SET ended_at = COALESCE(ended_at, p_occurred_at), close_reason = COALESCE(close_reason, 'room_empty')
    WHERE id = v_meeting_id;
    UPDATE public.classroom_sessions SET last_activity = p_occurred_at WHERE id = v_classroom_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.record_classroom_attendance_event(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_classroom_attendance_event(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ) TO service_role;

-- Retention is explicit. The existing cleanup job now closes stale live rooms;
-- it never deletes their classroom records or attendance history.
CREATE OR REPLACE FUNCTION public.cleanup_old_classroom_sessions(p_days_old INT DEFAULT 7)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ended_count INT;
BEGIN
  IF p_days_old < 1 OR p_days_old > 365 THEN
    RAISE EXCEPTION 'p_days_old must be between 1 and 365';
  END IF;

  UPDATE public.classroom_sessions
  SET status = 'ended', ended_at = now(), last_activity = now(), whiteboard_data = NULL
  WHERE is_persistent = FALSE
    AND status = 'active'
    AND last_activity < (now() - make_interval(days => p_days_old));

  GET DIAGNOSTICS v_ended_count = ROW_COUNT;
  RETURN v_ended_count;
END;
$$;
