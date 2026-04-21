-- Adds the `is_multiplayer` flag used by the HomePage/challenge-window split
-- (solo arcade games route to /solo/:gameKey; multiplayer games go through
-- the existing open-session / challenge flows).
--
-- Also fixes catalog values for games inserted by an earlier iteration:
--   * `memory` was inserted with min=1/max=4 but the authoritative module is
--     strictly 2-player turn-based. The server uses catalog min_players at
--     JOIN_ROOM time (see `apps/game-server/src/index.ts` → getOrCreateRoom),
--     so this has to match, otherwise seats freeze at 1 and the second
--     joiner is rejected.
--   * Single-player games must be marked is_multiplayer=false so the
--     challenge sheet hides them and the HomePage routes them to /solo/...
--
-- Idempotent: safe to run multiple times and safe to run whether or not the
-- previous 6-game INSERT migration has been applied.

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS is_multiplayer boolean NOT NULL DEFAULT true;

-- Ensure rows exist (no-op if the previous migration already inserted them).
INSERT INTO public.games (
  id, name_he, description_he, type, game_url,
  min_players, max_players, is_active, is_multiplayer, for_gender
)
SELECT
  gen_random_uuid(),
  v.name_he,
  v.description_he,
  'custom',
  v.game_url,
  v.min_players,
  v.max_players,
  true,
  v.is_multiplayer,
  'both'
FROM (
  VALUES
    ('memory',     'משחק הזיכרון',  'התאימו זוגות וצברו נקודות',              2, 2, true),
    ('drawing',    'לוח ציור',       'ציירו יחד בזמן אמת',                      1, 4, true),
    ('snake',      'נחש',            'שחקו לבד, אכלו מזון והימנעו מהתנגשות',    1, 1, false),
    ('simon',      'סיימון אומר',    'זכרו וחזרו על הרצף',                      1, 1, false),
    ('whackamole', 'הכה בחפרפרת',    'פגעו בחפרפרות לפני שנגמר הזמן',           1, 1, false),
    ('balloonpop', 'פיצוץ בלונים',  'פוצצו בלונים לפני שיאבדו כל החיים',       1, 1, false)
) AS v(game_url, name_he, description_he, min_players, max_players, is_multiplayer)
WHERE NOT EXISTS (
  SELECT 1 FROM public.games g WHERE g.game_url = v.game_url
);

-- Fix values on rows the previous migration already inserted with
-- incorrect player counts and no is_multiplayer column.
UPDATE public.games
  SET min_players = 2, max_players = 2, is_multiplayer = true
  WHERE game_url = 'memory';

UPDATE public.games
  SET min_players = 1, max_players = 4, is_multiplayer = true
  WHERE game_url = 'drawing';

UPDATE public.games
  SET min_players = 1, max_players = 1, is_multiplayer = false
  WHERE game_url IN ('snake', 'simon', 'whackamole', 'balloonpop');
