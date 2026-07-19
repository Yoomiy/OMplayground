-- Add chromavescence as a solo game to the catalog
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
  'עולמות מקבילים',
  'משחק פלטפורמה בעיצוב 1-ביט רטרו - החליפו בין עולמות מקבילים כדי לעבור מכשולים ולאסוף את אבני החן!',
  'custom',
  'chromavescence',
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
      game_url = 'chromavescence'
  );
