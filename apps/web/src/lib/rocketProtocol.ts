export interface RocketView {
  version: 1;
  sessionId: string;
  actorId: string | null;
  observer: boolean;
  pending: boolean;
  paused: boolean;
  phase: string;
  selfUserId: string;
  hostUserId: string | null;
  pendingPlayers: { userId: string; name: string; connected: boolean; actorId: string | null }[];
  observers: { userId: string; name: string; role: 'teacher' | 'admin' }[];
  canControl: boolean;
  canModerate: boolean;
  canRematch: boolean;
  score: { blue: number; orange: number };
  rematch: { accepted: string[]; refused: string[] } | null;
  players: { actorId: string; name: string; kind: 'bot' | 'human' | 'empty'; userId: string | null; connected: boolean; team: string }[];
}

export function isRocketView(value: unknown, sessionId: string): value is RocketView {
  if (!value || typeof value !== 'object') return false;
  const view = value as RocketView;
  return view.version === 1 && view.sessionId === sessionId
    && (view.actorId === null || typeof view.actorId === 'string' && /^rocket-[0-7]$/.test(view.actorId))
    && ['observer', 'pending', 'paused', 'canControl', 'canModerate', 'canRematch'].every(key => typeof view[key as keyof RocketView] === 'boolean')
    && ['waiting', 'countdown', 'playing', 'goal-reset', 'overtime', 'ended'].includes(view.phase)
    && typeof view.selfUserId === 'string' && (view.hostUserId === null || typeof view.hostUserId === 'string')
    && !!view.score && ['blue', 'orange'].every(key => {
      const score = view.score[key as 'blue' | 'orange'];
      return Number.isSafeInteger(score) && score >= 0;
    })
    && (view.rematch === null || !!view.rematch && ['accepted', 'refused'].every(key => {
      const ids = view.rematch![key as 'accepted' | 'refused'];
      return Array.isArray(ids) && ids.length <= 8 && ids.every(id => typeof id === 'string' && id.length <= 80)
        && new Set(ids).size === ids.length;
    }) && !view.rematch.accepted.some(id => view.rematch!.refused.includes(id)))
    && Array.isArray(view.pendingPlayers) && view.pendingPlayers.length <= 8
    && view.pendingPlayers.every(player => player && typeof player.userId === 'string'
      && typeof player.name === 'string' && player.name.length <= 80 && typeof player.connected === 'boolean'
      && (player.actorId === null || typeof player.actorId === 'string' && /^rocket-[0-7]$/.test(player.actorId)))
    && new Set(view.pendingPlayers.map(player => player.userId)).size === view.pendingPlayers.length
    && Array.isArray(view.observers) && view.observers.length <= 8
    && view.observers.every(player => player && typeof player.userId === 'string'
      && typeof player.name === 'string' && player.name.length <= 80 && ['teacher', 'admin'].includes(player.role))
    && Array.isArray(view.players) && view.players.length === 8
    && view.players.every(player => player && typeof player.actorId === 'string' && /^rocket-[0-7]$/.test(player.actorId)
      && typeof player.name === 'string' && player.name.length <= 80
      && ['human', 'bot', 'empty'].includes(player.kind) && ['blue', 'orange'].includes(player.team)
      && typeof player.connected === 'boolean' && (player.userId === null || typeof player.userId === 'string'))
    && new Set(view.players.map(player => player.actorId)).size === 8;
}

export function rocketServiceUrl(configured: string | undefined, dev = false): string {
  if (!configured?.trim()) {
    if (dev) return 'http://localhost:3000';
    throw new Error('כתובת שרת המשחק עדיין לא הוגדרה');
  }
  const url = new URL(configured.trim());
  if ((url.protocol !== 'https:' && !(dev && url.protocol === 'http:')) || url.username || url.password
    || url.pathname !== '/' || url.search || url.hash) throw new Error('כתובת שרת המשחק אינה תקינה');
  return url.origin;
}

export function rocketError(code: string): string {
  const errors: Record<string, string> = {
    NOT_IN_ROSTER: 'החשבון הזה אינו מופיע ברשימת המשתתפים של המשחק השמור.',
    SESSION_COMPLETED: 'המשחק הסתיים. אפשר לפתוח משחק חדש מהבית.',
    MATCH_INTERRUPTED: 'המשחק נסגר בעקבות הפעלה מחדש של השרת. אפשר לפתוח משחק חדש מהבית.',
    SESSION_RECOVERING: 'השרת מתחבר מחדש לחדר. יש לנסות שוב בעוד דקה.',
    RECESS_DENIED: 'ההפסקה הסתיימה. אפשר לשחק שוב בהפסקה הבאה.',
    GENDER_MISMATCH: 'אי אפשר להצטרף לחדר הזה.',
    SESSION_CLOSED: 'זהו חדר סגור. יש להיכנס דרך הזמנה.',
    REMOVED_FROM_ROOM: 'הוסרת מהחדר.',
    PROFILE_DISABLED: 'החשבון אינו פעיל.',
    ROOM_FULL: 'החדר מלא בשמונה שחקנים.',
    ALREADY_CONNECTED: 'החשבון כבר מחובר לחדר בחלון אחר.',
    SERVICE_BUSY: 'שרת המשחק מלא כרגע. כדאי לנסות שוב בעוד רגע.',
    CONTROL_FORBIDDEN: 'אין הרשאה לפעולה הזאת.',
    BAD_BOT_COUNT: 'אפשר להוסיף בוטים רק עד שמונה מכוניות בסך הכול.',
    LOBBY_ONLY: 'אפשר לשנות בוטים וקבוצות בחדר ההמתנה בלבד.',
    VOICE_UNAVAILABLE: 'הצ׳אט הקולי אינו זמין כרגע.',
    RATE_LIMITED: 'יש להמתין רגע לפני הפעולה הבאה.',
    NOT_IN_ROOM: 'יש להתחבר לחדר לפני השימוש בצ׳אט.',
    READ_ONLY: 'מצב צפייה אינו מאפשר שליחת הודעות.',
    SERVICE_OUTDATED: 'שרת Rocket עדיין מריץ גרסה קודמת. יש להפעיל מחדש את שרת המשחק ולרענן את הדף.',
    BAD_CONTROL: 'שרת המשחק לא זיהה את הפעולה. יש להפעיל מחדש את שרת Rocket ולרענן את הדף.',
    SESSION_CHANGED: 'החדר השתנה בזמן הפעולה. אפשר לנסות שוב.',
    PLATFORM_UNAVAILABLE: 'אין כרגע חיבור למסד הנתונים של המשחק. אפשר לנסות שוב בעוד רגע.',
    SERVICE_UNAVAILABLE: 'שרת המשחק אינו זמין כרגע. אפשר לנסות שוב בעוד רגע.',
    CANNOT_START: 'אי אפשר להתחיל את המשחק במצב הנוכחי של החדר.',
    CANNOT_PAUSE: 'אפשר להשהות או להמשיך רק משחק שכבר התחיל.',
    NO_PLAYERS: 'צריך לפחות שחקן מחובר אחד כדי להתחיל.',
    BAD_PENDING_SLOT: 'המקום כבר תפוס או הוקצה לשחקן אחר. אפשר לבחור מקום אחר.',
    SESSION_SAVED: 'המשחק נשמר ל־24 שעות. אפשר לחזור אליו מהמשחקים השמורים בבית.',
    SAVE_UNCONFIRMED: 'לא התקבל אישור לשמירת המשחק. אפשר לנסות שוב; ייתכן שההתקדמות האחרונה לא נשמרה.',
    BAD_TEAM: 'בחירת הקבוצה אינה תקינה. אפשר לנסות שוב.',
    GAME_UNAVAILABLE: 'המשחק אינו פעיל כרגע.',
    UNAUTHORIZED: 'יש להתחבר מחדש לחשבון כדי להיכנס למשחק.',
  };
  return errors[code] ?? 'לא ניתן להתחבר למשחק כרגע. אפשר לנסות שוב.';
}

/** An older backend may serve newly built static files while still running old room handlers. */
export function isRocketServiceCompatible(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const config = value as { protocol?: unknown; capabilities?: unknown };
  const capabilities = config.capabilities;
  return config.protocol === 1 && Array.isArray(capabilities)
    && ['lobby-controls', 'session-chat', 'voice', 'retained-matches', 'queued-roster', 'rematch', 'save-outcomes', 'platform-only'].every(capability => capabilities.includes(capability));
}
