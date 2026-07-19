-- Remove pop-it-master from the games catalog
DELETE FROM public.games
WHERE game_url = 'pop-it-master';
