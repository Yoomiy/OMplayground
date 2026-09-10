-- Existing catalog and session authorization; no new tables or policies.
INSERT INTO public.games
  (id, name_he, description_he, type, game_url, min_players, max_players, is_active, is_multiplayer, for_gender, thumbnail_url)
SELECT gen_random_uuid(), 'מחברים איים',
  'אוספים אסימונים, בונים נתיבי מעבורת ומשלימים משלוחים בין איים. משחק אסטרטגיה ל־2–4 חברים.',
  'custom', 'island-connections', 2, 4, true, true, 'both', '/games/island-connections.svg'
WHERE NOT EXISTS (SELECT 1 FROM public.games WHERE game_url = 'island-connections');
