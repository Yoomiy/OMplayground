-- Hide multiplayer breakout from the catalog until latency/sync issues are fixed.
-- Solo breakout (game_url = 'breakout-solo') stays visible.
UPDATE public.games
SET is_active = false
WHERE game_url = 'breakout'
  AND is_multiplayer = true;
