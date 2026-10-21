-- Rocket uses its dedicated authenticated service, with native bots filling
-- unused seats. Enable it for the app catalog when this migration is applied.
INSERT INTO public.games (
  id, name_he, description_he, type, game_url, min_players, max_players,
  is_active, is_multiplayer, for_gender
)
SELECT gen_random_uuid(), 'רוקט ארנה', 'כדורגל מכוניות עם חברים ובוטים',
  'custom', 'rocket-arena', 1, 8, true, true, 'both'
WHERE NOT EXISTS (SELECT 1 FROM public.games WHERE game_url = 'rocket-arena');

-- Also enable a hidden row if the earlier manual catalog draft was applied.
UPDATE public.games SET is_active = true WHERE game_url = 'rocket-arena';
