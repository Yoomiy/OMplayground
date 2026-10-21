-- Prepared catalog entry. Activation follows integrated acceptance and service configuration.
-- Applying this migration does not make Wobble visible in the catalog.
INSERT INTO public.games (
  id, name_he, description_he, type, game_url, min_players, max_players,
  is_active, is_multiplayer, for_gender
)
SELECT gen_random_uuid(), 'וובל', 'מרוצי מכשולים עם חברים',
  'custom', 'wobble-rush', 2, 8, false, true, 'both'
WHERE NOT EXISTS (SELECT 1 FROM public.games WHERE game_url = 'wobble-rush');
