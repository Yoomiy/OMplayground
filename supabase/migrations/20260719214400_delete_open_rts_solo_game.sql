-- Revert: Add open-rts as a solo game to the catalog
DELETE FROM public.games
WHERE game_url = 'open-rts';
