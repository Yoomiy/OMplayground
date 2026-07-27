-- Enable public/guest SELECT on classroom drawing sessions so unauthenticated classroom students can find the drawgame session
CREATE POLICY "game_sessions_select_classroom_draw"
  ON public.game_sessions FOR SELECT
  USING (invitation_code LIKE 'class-draw-%');
