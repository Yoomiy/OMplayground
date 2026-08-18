-- Visits are the attendance source of truth. The previous participant-level
-- cached totals could diverge after a leave/rejoin cycle.

UPDATE public.classroom_meetings AS meeting
SET ended_at = COALESCE(meeting.ended_at, classroom.ended_at, classroom.last_activity),
    close_reason = COALESCE(meeting.close_reason, 'classroom_ended')
FROM public.classroom_sessions AS classroom
WHERE classroom.id = meeting.classroom_id
  AND classroom.status = 'ended'
  AND meeting.ended_at IS NULL;

UPDATE public.classroom_participant_visits AS visit
SET left_at = GREATEST(visit.joined_at, meeting.ended_at)
FROM public.classroom_meetings AS meeting
WHERE meeting.id = visit.meeting_id
  AND meeting.ended_at IS NOT NULL
  AND visit.left_at IS NULL;

ALTER TABLE public.classroom_meeting_participants
  DROP COLUMN IF EXISTS last_left_at,
  DROP COLUMN IF EXISTS total_seconds;

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
  v_meeting_ended_at TIMESTAMPTZ;
  v_participant_id UUID;
  v_participant_key TEXT;
  v_role TEXT;
BEGIN
  SELECT id INTO v_classroom_id
  FROM public.classroom_sessions
  WHERE room_code = p_room_code;
  IF v_classroom_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.classroom_attendance_events (livekit_event_id, classroom_id, event_type)
  VALUES (p_event_id, v_classroom_id, p_event_type)
  ON CONFLICT (livekit_event_id) DO NOTHING;
  IF NOT FOUND THEN RETURN; END IF;

  IF p_event_type = 'room_started' THEN
    INSERT INTO public.classroom_meetings (classroom_id, livekit_room_sid, started_at)
    VALUES (v_classroom_id, p_room_sid, p_occurred_at)
    ON CONFLICT (classroom_id, livekit_room_sid) DO UPDATE
      SET started_at = LEAST(classroom_meetings.started_at, EXCLUDED.started_at);
    UPDATE public.classroom_sessions
    SET last_activity = GREATEST(last_activity, p_occurred_at)
    WHERE id = v_classroom_id;
    RETURN;
  END IF;

  SELECT id, ended_at INTO v_meeting_id, v_meeting_ended_at
  FROM public.classroom_meetings
  WHERE classroom_id = v_classroom_id AND livekit_room_sid = p_room_sid;

  IF v_meeting_id IS NULL AND p_event_type = 'participant_joined' THEN
    INSERT INTO public.classroom_meetings (classroom_id, livekit_room_sid, started_at)
    VALUES (v_classroom_id, p_room_sid, p_occurred_at)
    ON CONFLICT (classroom_id, livekit_room_sid) DO UPDATE
      SET started_at = LEAST(classroom_meetings.started_at, EXCLUDED.started_at)
    RETURNING id, ended_at INTO v_meeting_id, v_meeting_ended_at;
  END IF;
  IF v_meeting_id IS NULL THEN RETURN; END IF;

  IF p_event_type = 'participant_joined' THEN
    IF COALESCE((p_participant_metadata ->> 'hidden')::BOOLEAN, FALSE) THEN RETURN; END IF;
    v_participant_key := COALESCE(
      NULLIF(p_participant_metadata ->> 'attendanceKey', ''),
      NULLIF(p_participant_identity, '')
    );
    IF v_participant_key IS NULL THEN RETURN; END IF;
    v_role := COALESCE(NULLIF(p_participant_metadata ->> 'attendanceRole', ''), 'participant');

    INSERT INTO public.classroom_meeting_participants (
      meeting_id, participant_key, user_id, display_name, roles_held, first_joined_at
    ) VALUES (
      v_meeting_id,
      v_participant_key,
      CASE WHEN p_participant_identity ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN p_participant_identity::UUID ELSE NULL END,
      COALESCE(NULLIF(p_participant_name, ''), 'משתתף'),
      ARRAY[v_role],
      p_occurred_at
    ) ON CONFLICT (meeting_id, participant_key) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      roles_held = ARRAY(
        SELECT DISTINCT unnest(classroom_meeting_participants.roles_held || EXCLUDED.roles_held)
      ),
      first_joined_at = LEAST(classroom_meeting_participants.first_joined_at, EXCLUDED.first_joined_at)
    RETURNING id INTO v_participant_id;

    INSERT INTO public.classroom_participant_visits (
      participant_id, meeting_id, livekit_participant_sid, joined_at, left_at
    ) VALUES (
      v_participant_id,
      v_meeting_id,
      p_participant_sid,
      p_occurred_at,
      CASE WHEN v_meeting_ended_at IS NULL THEN NULL
        ELSE GREATEST(p_occurred_at, v_meeting_ended_at) END
    )
    ON CONFLICT (meeting_id, livekit_participant_sid) DO NOTHING;
    UPDATE public.classroom_sessions
    SET last_activity = GREATEST(last_activity, p_occurred_at)
    WHERE id = v_classroom_id;
    RETURN;
  END IF;

  IF p_event_type = 'participant_left' THEN
    UPDATE public.classroom_participant_visits
    SET left_at = GREATEST(joined_at, p_occurred_at)
    WHERE meeting_id = v_meeting_id
      AND livekit_participant_sid = p_participant_sid
      AND left_at IS NULL;
    UPDATE public.classroom_sessions
    SET last_activity = GREATEST(last_activity, p_occurred_at)
    WHERE id = v_classroom_id;
    RETURN;
  END IF;

  IF p_event_type = 'room_finished' THEN
    UPDATE public.classroom_participant_visits
    SET left_at = GREATEST(joined_at, p_occurred_at)
    WHERE meeting_id = v_meeting_id AND left_at IS NULL;
    UPDATE public.classroom_meetings
    SET ended_at = COALESCE(ended_at, p_occurred_at),
        close_reason = COALESCE(close_reason, 'room_empty')
    WHERE id = v_meeting_id;
    UPDATE public.classroom_sessions
    SET last_activity = GREATEST(last_activity, p_occurred_at)
    WHERE id = v_classroom_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.record_classroom_attendance_event(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_classroom_attendance_event(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ)
  TO service_role;

CREATE OR REPLACE FUNCTION public.find_classroom_record_ids(p_search TEXT)
RETURNS TABLE(id UUID)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT classroom.id
  FROM public.classroom_sessions AS classroom
  WHERE concat_ws(' ', classroom.title, classroom.subject, classroom.teacher_name, classroom.room_code)
    ILIKE '%' || p_search || '%'
  UNION
  SELECT meeting.classroom_id
  FROM public.classroom_meeting_participants AS participant
  JOIN public.classroom_meetings AS meeting ON meeting.id = participant.meeting_id
  WHERE participant.display_name ILIKE '%' || p_search || '%'
  UNION
  SELECT delegate.classroom_id
  FROM public.classroom_host_delegates AS delegate
  WHERE delegate.display_name ILIKE '%' || p_search || '%';
$$;

REVOKE ALL ON FUNCTION public.find_classroom_record_ids(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_classroom_record_ids(TEXT) TO service_role;
