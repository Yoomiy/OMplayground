-- Keep private drawing separate from the collaborative drawing room.  The
-- HomePage routes non-multiplayer catalog entries directly to /solo/:game_url.
INSERT INTO public.games (
  id,
  name_he,
  description_he,
  type,
  game_url,
  min_players,
  max_players,
  is_active,
  is_multiplayer,
  for_gender
)
SELECT
  gen_random_uuid(),
  'לוח ציור',
  'ציירו ושמרו את היצירות שלכם',
  'custom',
  'drawing-solo',
  1,
  1,
  true,
  false,
  'both'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.games
  WHERE game_url = 'drawing-solo'
);
