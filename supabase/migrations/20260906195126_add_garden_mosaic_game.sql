-- Uses the existing catalog, session authorization, and board-game server.
INSERT INTO public.games
  (id, name_he, description_he, type, game_url, min_players, max_players, is_active, is_multiplayer, for_gender, thumbnail_url)
SELECT gen_random_uuid(), 'גינת הפסיפס',
  'בוחרים אריחים, מחברים פרחים ובריכות ובונים גינה מנצחת. משחק אסטרטגיה ל־2–4 חברים.',
  'custom', 'garden-mosaic', 2, 4, true, true, 'both', '/games/garden-mosaic.svg'
WHERE NOT EXISTS (SELECT 1 FROM public.games WHERE game_url = 'garden-mosaic');
