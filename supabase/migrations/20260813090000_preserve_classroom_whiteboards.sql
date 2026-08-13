-- Classroom whiteboards are persistent classroom infrastructure, not ordinary
-- paused games. Restore boards that the generic stale-game cleanup completed
-- while their parent classroom is still active.
-- Migrations connect as the database login role, which is intentionally
-- blocked by game_sessions_guard_authoritative unless this transaction-local
-- capability is enabled.
SELECT set_config('playground.allow_game_session_authority_write', 'true', true);

UPDATE public.game_sessions AS gs
SET
  status = 'paused',
  is_open = true,
  ended_at = NULL,
  stopped_by = NULL,
  last_activity = now()
FROM public.classroom_sessions AS cs
WHERE gs.invitation_code = 'class-draw-' || cs.room_code
  AND cs.status = 'active'
  AND gs.status = 'completed';
