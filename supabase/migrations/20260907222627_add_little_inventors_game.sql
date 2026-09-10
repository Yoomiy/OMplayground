-- Reuse the existing catalog and multiplayer authorization policies.
INSERT INTO public.games
  (id, name_he, description_he, type, game_url, min_players, max_players, is_active, is_multiplayer, for_gender, thumbnail_url)
SELECT gen_random_uuid(), 'סדנת הממציאים',
  'בונים מכונות, אוספים חומרים ומשלימים המצאות. משחק אסטרטגיה בעשרה סיבובים ל־2–4 ממציאים.',
  'custom', 'little-inventors', 2, 4, true, true, 'both', '/games/little-inventors.svg'
WHERE NOT EXISTS (SELECT 1 FROM public.games WHERE game_url = 'little-inventors');
