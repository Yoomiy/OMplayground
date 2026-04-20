-- Milestone D: register Connect Four in the games catalog.
-- `game_url` must match `connectfourModule.key` in game-logic.

INSERT INTO public.games (
  id,
  name_he,
  description_he,
  type,
  game_url,
  min_players,
  max_players,
  is_active,
  for_gender
)
SELECT
  gen_random_uuid(),
  'ארבע בשורה',
  'הפילו דיסקים לעמודות וצרו רצף של ארבעה',
  'custom',
  'connectfour',
  2,
  2,
  true,
  'both'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.games
  WHERE game_url = 'connectfour'
);
