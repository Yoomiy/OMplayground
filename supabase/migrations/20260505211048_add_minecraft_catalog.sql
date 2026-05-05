INSERT INTO public.games (
  id, name_he, description_he, type, game_url, thumbnail_url,
  min_players, max_players, is_active, is_multiplayer, for_gender
)
SELECT
  gen_random_uuid(), 'Minecraft', 'בנו עולמות תלת-ממדיים יחד',
  'custom', 'minecraft', '/legacy/minecraft/thumbnail.png',
  1, 8, true, true, 'both'
WHERE NOT EXISTS (SELECT 1 FROM public.games WHERE game_url = 'minecraft');
