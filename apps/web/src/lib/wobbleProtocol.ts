export { GRAPHICS_QUALITY_KEY, isGraphicsQuality, type GraphicsQuality } from "../../../../games/wobble-rush/src/shared/graphics-quality";
export { RUNNER_COLORS } from "../../../../games/wobble-rush/src/shared/course-palette";
export { isWobbleView } from "../../../../games/wobble-rush/src/shared/platform-view";
export type { WobbleView, WobbleControl } from "../../../../games/wobble-rush/src/shared/platform-view";

export interface WobbleConfig {
  version: 1; protocol: 7; content: string; release: string;
  courses: { id: string; name: string }[];
}
export function isWobbleConfig(value: unknown): value is WobbleConfig {
  if (!value || typeof value !== 'object') return false;
  const config = value as WobbleConfig & { capabilities?: unknown };
  return config.version === 1 && config.protocol === 7 && config.content === 'playground-action-4'
    && typeof config.release === 'string' && Array.isArray(config.capabilities)
    && ['authenticated-rooms', 'host-start', 'saved-games', 'teacher-observation', 'social'].every(capability => (config.capabilities as unknown[]).includes(capability))
    && Array.isArray(config.courses) && config.courses.length > 0 && config.courses.length <= 100
    && config.courses.every(course => course && typeof course.id === 'string' && course.id.length <= 64 && typeof course.name === 'string' && course.name.length <= 80);
}
export function wobbleServiceUrl(configured: string | undefined, dev: boolean): string {
  if (!configured?.trim()) {
    if (dev) return 'http://localhost:3000';
    throw new Error('כתובת שרת Wobble עדיין לא הוגדרה');
  }
  const url = new URL(configured.trim());
  if ((url.protocol !== 'https:' && !(dev && url.protocol === 'http:')) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('כתובת שרת Wobble אינה תקינה');
  return url.origin;
}
export function wobbleError(code: string): string {
  const errors: Record<string, string> = {
    RECESS_DENIED: 'ההפסקה הסתיימה. אפשר לחזור בהפסקה הבאה.',
    SESSION_COMPLETED: 'המפגש הסתיים. אפשר לפתוח משחק חדש מהבית.',
    SESSION_RECOVERING: 'השרת משחזר את החדר. מתחברים מחדש…',
    SAVE_UNAVAILABLE: 'לא ניתן לשחזר את השמירה. השמירה הקודמת נשמרה לבדיקת התקלה.',
    SAVE_EXPIRED: 'עברו 24 שעות והשמירה אינה זמינה עוד.',
    INCOMPATIBLE_SESSION: 'השמירה נוצרה בגרסה אחרת ואינה תואמת לגרסה הנוכחית.',
    REMOVED_FROM_ROOM: 'הוסרת מהחדר.',
    NOT_IN_ROSTER: 'אין לך עוד מקום שמור במפגש הזה.',
    PROFILE_DISABLED: 'החשבון אינו פעיל.',
    GENDER_MISMATCH: 'אי אפשר להצטרף לחדר הזה.',
    ROOM_FULL: 'החדר מלא בשמונה שחקנים.',
    SERVICE_BUSY: 'שרת המשחק מלא כרגע. אפשר לנסות שוב בעוד רגע.',
    SESSION_CLOSED: 'זהו חדר פרטי. יש להיכנס דרך הזמנה.',
    CONTROL_FORBIDDEN: 'אין הרשאה לפעולה הזאת.',
    CANNOT_START: 'צריך לפחות שני שחקנים מחוברים שסיימו לטעון את המשחק.',
    CANNOT_RESUME: 'ממתינים לחזרת השחקנים ולטעינת המשחק לפני ההמשך.',
    CANNOT_PAUSE: 'אפשר להשהות רק מרוץ שכבר התחיל.',
    LOBBY_ONLY: 'אפשר לשנות את המסלול וסוג המשחק בחדר ההמתנה בלבד.',
    REPLACEMENT_TAB: 'המשחק פתוח כעת בלשונית אחרת.',
    VOICE_UNAVAILABLE: 'הצ׳אט הקולי אינו זמין כרגע.',
    READ_ONLY: 'מצב צפייה אינו מאפשר שליחת הודעות בצ׳אט.',
    RATE_LIMITED: 'יש להמתין רגע לפני הפעולה הבאה.',
    SERVICE_OUTDATED: 'גרסת שרת המשחק אינה תואמת. יש להפעיל מחדש את שירות Wobble ולרענן.',
    PLATFORM_UNAVAILABLE: 'שמירת המשחק אינה זמינה כרגע. אפשר לנסות שוב בעוד רגע.',
    SESSION_CHANGED: 'המפגש השתנה בזמן הפעולה. אפשר לנסות שוב.',
    GRAPHICS_LOST: 'החיבור לתצוגת המשחק אבד. לחצו על ניסיון נוסף כדי לטעון אותה מחדש.',
    UNAUTHORIZED: 'יש להתחבר מחדש לחשבון.',
  };
  return errors[code] ?? 'לא ניתן להשלים את הפעולה כרגע. אפשר לנסות שוב.';
}
