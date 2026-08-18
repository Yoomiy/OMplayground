-- Forward-only correction for the already-applied attendance migration.
-- A participant can leave and later rejoin the same LiveKit meeting; the
-- participant summary must become live again when its new visit is inserted.

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
  SELECT id INTO v_classroom_id FROM public.classroom_sessions WHERE room_code = p_room_code;
  IF v_classroom_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.classroom_attendance_events (livekit_event_id, classroom_id, event_type)
  VALUES (p_event_id, v_classroom_id, p_event_type)
  ON CONFLICT (livekit_event_id) DO NOTHING;
  IF NOT FOUND THEN RETURN; END IF;

  IF p_event_type = 'room_started' THEN
    INSERT INTO public.classroom_meetings (classroom_id, livekit_room_sid, started_at)
    VALUES (v_classroom_id, p_room_sid, p_occurred_at)
    ON CONFLICT (classroom_id, livekit_room_sid) DO NOTHING;
    UPDATE public.classroom_sessions SET last_activity = p_occurred_at WHERE id = v_classroom_id;
    RETURN;
  END IF;

  SELECT id INTO v_meeting_id FROM public.classroom_meetings
  WHERE classroom_id = v_classroom_id AND livekit_room_sid = p_room_sid;
  IF v_meeting_id IS NULL AND p_event_type = 'participant_joined' THEN
    INSERT INTO public.classroom_meetings (classroom_id, livekit_room_sid, started_at)
    VALUES (v_classroom_id, p_room_sid, p_occurred_at)
    ON CONFLICT (classroom_id, livekit_room_sid) DO UPDATE
      SET started_at = LEAST(classroom_meetings.started_at, EXCLUDED.started_at)
    RETURNING id INTO v_meeting_id;
  END IF;
  IF v_meeting_id IS NULL THEN RETURN; END IF;

  IF p_event_type = 'participant_joined' THEN
    IF COALESCE((p_participant_metadata ->> 'hidden')::BOOLEAN, FALSE) THEN RETURN; END IF;
    v_participant_key := COALESCE(NULLIF(p_participant_metadata ->> 'attendanceKey', ''), NULLIF(p_participant_identity, ''));
    IF v_participant_key IS NULL THEN RETURN; END IF;
    v_role := COALESCE(NULLIF(p_participant_metadata ->> 'attendanceRole', ''), 'participant');
    INSERT INTO public.classroom_meeting_participants (
      meeting_id, participant_key, user_id, display_name, roles_held, first_joined_at
    ) VALUES (
      v_meeting_id, v_participant_key,
      CASE WHEN p_participant_identity ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN p_participant_identity::UUID ELSE NULL END,
      COALESCE(NULLIF(p_participant_name, ''), 'משתתף'), ARRAY[v_role], p_occurred_at
    ) ON CONFLICT (meeting_id, participant_key) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      roles_held = ARRAY(SELECT DISTINCT unnest(classroom_meeting_participants.roles_held || EXCLUDED.roles_held)),
      last_left_at = NULL
    RETURNING id INTO v_participant_id;
    INSERT INTO public.classroom_participant_visits (participant_id, meeting_id, livekit_participant_sid, joined_at)
    VALUES (v_participant_id, v_meeting_id, p_participant_sid, p_occurred_at)
    ON CONFLICT (meeting_id, livekit_participant_sid) DO NOTHING;
    UPDATE public.classroom_sessions SET last_activity = p_occurred_at WHERE id = v_classroom_id;
    RETURN;
  END IF;

  IF p_event_type = 'participant_left' THEN
    UPDATE public.classroom_participant_visits AS v SET left_at = p_occurred_at
    WHERE v.meeting_id = v_meeting_id AND v.livekit_participant_sid = p_participant_sid AND v.left_at IS NULL
    RETURNING v.participant_id, GREATEST(0, EXTRACT(EPOCH FROM p_occurred_at - v.joined_at))::BIGINT INTO v_participant_id, v_seconds;
    IF FOUND THEN
      UPDATE public.classroom_meeting_participants SET last_left_at = p_occurred_at, total_seconds = total_seconds + v_seconds WHERE id = v_participant_id;
    END IF;
    UPDATE public.classroom_sessions SET last_activity = p_occurred_at WHERE id = v_classroom_id;
    RETURN;
  END IF;

  IF p_event_type = 'room_finished' THEN
    UPDATE public.classroom_participant_visits SET left_at = p_occurred_at WHERE meeting_id = v_meeting_id AND left_at IS NULL;
    UPDATE public.classroom_meeting_participants AS p SET
      total_seconds = COALESCE((SELECT SUM(GREATEST(0, EXTRACT(EPOCH FROM COALESCE(v.left_at, p_occurred_at) - v.joined_at))::BIGINT) FROM public.classroom_participant_visits v WHERE v.participant_id = p.id), 0),
      last_left_at = p_occurred_at
    WHERE p.meeting_id = v_meeting_id;
    UPDATE public.classroom_meetings SET ended_at = COALESCE(ended_at, p_occurred_at), close_reason = COALESCE(close_reason, 'room_empty') WHERE id = v_meeting_id;
    UPDATE public.classroom_sessions SET last_activity = p_occurred_at WHERE id = v_classroom_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.record_classroom_attendance_event(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_classroom_attendance_event(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ) TO service_role;
