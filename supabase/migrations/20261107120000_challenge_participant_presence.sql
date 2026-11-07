-- Describe each side of an invitation independently for clear waiting-room copy.
CREATE OR REPLACE FUNCTION public.list_game_challenges() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  PERFORM public.cleanup_game_challenges();
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(c) || jsonb_build_object(
    'partner_role', p.role, 'partner_name', p.full_name, 'game_name', g.name_he,
    'self_busy', EXISTS (SELECT 1 FROM player_game_claims claim WHERE claim.session_id <> c.session_id AND claim.user_id=auth.uid() AND claim.expires_at > now()),
    'partner_busy', EXISTS (SELECT 1 FROM player_game_claims claim WHERE claim.session_id <> c.session_id AND claim.user_id=p.id AND claim.expires_at > now()),
    'self_in_session', auth.uid()=ANY(gs.connected_player_ids),
    'partner_in_session', p.id=ANY(gs.connected_player_ids),
    'partner_online', EXISTS (SELECT 1 FROM game_sessions s WHERE p.id=ANY(s.connected_player_ids)),
    'can_cancel', cardinality(gs.connected_player_ids)=0, 'session_status', gs.status))
    FROM game_challenges c JOIN kid_profiles p ON p.id=CASE WHEN c.from_kid_id=auth.uid() THEN c.to_kid_id ELSE c.from_kid_id END
    JOIN games g ON g.id=c.game_id JOIN game_sessions gs ON gs.id=c.session_id
    WHERE auth.uid() IN (c.from_kid_id,c.to_kid_id) AND c.status IN ('pending','accepted') AND gs.status='waiting'), '[]'::jsonb);
END; $$;
