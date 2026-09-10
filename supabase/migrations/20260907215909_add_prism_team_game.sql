-- Reuse the existing multiplayer catalog and authorization policies.
INSERT INTO public.games
  (id, name_he, description_he, type, game_url, min_players, max_players, is_active, is_multiplayer, for_gender, thumbnail_url)
SELECT gen_random_uuid(), 'צוות המנסרות',
  'מתכננים יחד, מסובבים מראות ומפצלים אור כדי להאיר את כל הקולטנים. שלוש חידות לצוות של 2–4 חברים.',
  'custom', 'prism-team', 2, 4, true, true, 'both', '/games/prism-team.svg'
WHERE NOT EXISTS (SELECT 1 FROM public.games WHERE game_url = 'prism-team');
