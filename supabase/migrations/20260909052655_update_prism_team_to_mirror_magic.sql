UPDATE public.games
SET name_he = 'קסם המראות',
    description_he = 'משחק Mirror Magic המקורי בשיתוף פעולה בזמן אמת: 111 שלבים מלאים של Mindbender ו-Deflektor עם המנגנון, הגרפיקה והצלילים המקוריים.',
    thumbnail_url = '/games/mirror-magic.png',
    min_players = 2,
    max_players = 4,
    is_active = true,
    is_multiplayer = true
WHERE game_url = 'prism-team';
