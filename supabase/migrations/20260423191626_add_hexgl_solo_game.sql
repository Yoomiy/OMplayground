-- Add hexgl as a solo game to the catalog
INSERT INTO
  public.games (
    id,
    name_he,
    description_he,
    type,
    game_url,
    min_players,
    max_players,
    is_active,
    is_multiplayer,
    for_gender
  )
SELECT
  gen_random_uuid (),
  'מרוץ מכוניות',
  'מירוץ תלת-ממדי מהיר בעולם עתידני',
  'custom',
  'hexgl',
  1,
  1,
  true,
  false,
  'both'
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      public.games
    WHERE
      game_url = 'hexgl'
  );
