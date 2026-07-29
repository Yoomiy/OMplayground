-- New classrooms should allow normal student audio/video unless the host changes the policy.
ALTER TABLE public.classroom_sessions
    ALTER COLUMN settings SET DEFAULT '{
      "allowStudentMic": true,
      "allowStudentCam": true,
      "allowStudentChat": false,
      "allowStudentScreenShare": false,
      "allowWhiteboardDraw": false
    }'::jsonb;

-- Upgrade only rows that still have the exact legacy default. A classroom
-- whose host changed any setting is left untouched.
UPDATE public.classroom_sessions
SET settings = jsonb_set(settings, '{allowStudentMic}', 'true'::jsonb)
WHERE settings = '{
  "allowStudentMic": false,
  "allowStudentCam": true,
  "allowStudentChat": false,
  "allowStudentScreenShare": false,
  "allowWhiteboardDraw": false
}'::jsonb;
