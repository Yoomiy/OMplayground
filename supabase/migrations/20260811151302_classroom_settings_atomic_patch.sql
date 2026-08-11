-- Apply independent classroom-settings changes without replacing the entire
-- JSONB document read by an earlier request. This is intentionally only
-- executable by the server's service-role client.
CREATE OR REPLACE FUNCTION public.patch_classroom_session_settings(
  p_session_id uuid,
  p_patch jsonb
)
RETURNS jsonb
LANGUAGE sql
VOLATILE
SET search_path = ''
AS $$
  UPDATE public.classroom_sessions
  SET
    settings = COALESCE(settings, '{}'::jsonb) || COALESCE(p_patch, '{}'::jsonb),
    last_activity = now()
  WHERE id = p_session_id
  RETURNING settings;
$$;

REVOKE ALL ON FUNCTION public.patch_classroom_session_settings(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.patch_classroom_session_settings(uuid, jsonb) TO service_role;
