-- Add chess as a multiplayer catalog game.
-- Idempotent: `game_url` is not a UNIQUE column in the schema, so we use
-- `WHERE NOT EXISTS` (same pattern as connect four / alges-escapade).
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
  'שחמט',
  'שחמט קלאסי לשני שחקנים',
  'custom',
  'chess',
  2,
  2,
  true,
  true,
  'both'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.games
  WHERE game_url = 'chess'
);
