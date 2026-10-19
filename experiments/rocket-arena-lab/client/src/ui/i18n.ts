/** Browser text only: no network identifiers, player names, world coordinates or key bindings are translated. */
export type Language = 'he' | 'en';

export function resolveLanguage(search: string): Language {
  return new URLSearchParams(search).get('lang') === 'en' ? 'en' : 'he';
}

export const language: Language = resolveLanguage(typeof window === 'undefined' ? '' : window.location.search);
export const textDirection = language === 'he' ? 'rtl' : 'ltr';
export const UI_FONT = 'system-ui, "Segoe UI", Arial, "Noto Sans Hebrew", "DejaVu Sans", sans-serif';

const hebrew: Readonly<Record<string, string>> = {
  "You": "אני",
  "Bot": "בוט",
  "Room request cancelled": "ההצטרפות לחדר בוטלה",
  "Joined room mode is unavailable for this connection.": "סוג החדר אינו זמין בחיבור הזה.",
  "Rocket Arena game view": "תצוגת המשחק רוקט ארנה",
  "Rocket Arena": "רוקט ארנה",
  "Player name": "שם שחקן",
  "Your name": "השם שלך",
  "Quick Match": "משחק מהיר",
  "Custom Room": "חדר פרטי",
  "Create Room": "יצירת חדר",
  "Practice · 1 bot": "אימון · בוט אחד",
  "Practice · 7 bots": "אימון · 7 בוטים",
  "Join Code": "הצטרפות עם קוד",
  "Back": "חזרה",
  "Join Custom Room": "הצטרפות לחדר פרטי",
  "Room code": "קוד חדר",
  "Join": "הצטרפות",
  "Finding match...": "מחפשים משחק…",
  "Finding...": "מחפשים…",
  "Creating room...": "יוצרים חדר…",
  "Creating...": "יוצרים…",
  "Joining...": "מצטרפים…",
  "Enter a complete 6-character room code.": "יש להזין קוד חדר מלא באורך 6 תווים.",
  "Waiting for players...": "ממתינים לשחקנים…",
  "Leave Room": "יציאה מהחדר",
  "Match starting...": "המשחק מתחיל…",
  "Room Code:": "קוד חדר:",
  "Loading...": "טוענים…",
  "Blue Team": "הקבוצה הכחולה",
  "Orange Team": "הקבוצה הכתומה",
  "Join Blue": "הצטרפות לכחולים",
  "Join Orange": "הצטרפות לכתומים",
  "Start Match": "תחילת משחק",
  "HOST": "מארח",
  "Bots ready. Start when you are ready.": "הבוטים מוכנים. אפשר להתחיל.",
  "Adding opponents… {joined}/{total}. If this takes over 10 seconds, leave and retry.": "מוסיפים יריבים… {joined}/{total}. אם זה נמשך יותר מ־10 שניות, צאו מהחדר ונסו שוב.",
  "Connection closed. You can join a room again.": "החיבור נסגר. אפשר להצטרף שוב לחדר.",
  "Connection failed": "החיבור נכשל",
  "Failed to create room": "לא ניתן ליצור חדר",
  "Room not found": "החדר לא נמצא",
  "Error: {message}": "שגיאה: {message}",
  "Match menu": "תפריט משחק",
  "PAUSED": "תפריט",
  "The match keeps running. This menu is yours alone.": "המשחק ממשיך לרוץ. התפריט פתוח רק אצלך.",
  "Resume": "חזרה למשחק",
  "Settings": "הגדרות",
  "SETTINGS": "הגדרות",
  "Return to Lobby": "חזרה ללובי",
  "Press ESC to resume": "לחצו על \u2066ESC\u2069 לחזרה למשחק",
  "Sound volume": "עוצמת קול",
  "Mute sound": "השתקת קול",
  "Ball floor marker": "סימון הכדור על הקרקע",
  "Control hints": "הצגת מקשי שליטה",
  "Lighter graphics": "גרפיקה קלה",
  "Shadows": "צללים",
  "Invert air pitch (W / S)": "היפוך הטיה באוויר (\u2066W / S\u2069)",
  "Invert air roll (A / D)": "היפוך גלגול באוויר (\u2066A / D\u2069)",
  "Invert air yaw (Q / E)": "היפוך פנייה באוויר (\u2066Q / E\u2069)",
  "ON": "פעיל",
  "OFF": "כבוי",
  "Reset to Defaults": "איפוס הגדרות",
  "Settings reset to defaults.": "ההגדרות אופסו לברירת המחדל.",
  "{value} percent": "{value} אחוזים",
  "Play Again": "משחק נוסף",
  "BLUE WINS!": "הכחולים ניצחו!",
  "ORANGE WINS!": "הכתומים ניצחו!",
  "Match status": "מצב המשחק",
  "Scoreboard": "לוח תוצאות",
  "BLUE": "כחולים",
  "ORANGE": "כתומים",
  "WAITING": "ממתינים",
  "WAITING FOR PLAYERS": "ממתינים לשחקנים",
  "RESET · KICKOFF": "היערכות · פתיחה",
  "OVERTIME KICKOFF": "פתיחת הארכה",
  "KICKOFF": "פתיחה",
  "GOAL RESET": "היערכות לאחר שער",
  "SUDDEN DEATH": "השער הבא מנצח",
  "MATCH COMPLETE": "המשחק הסתיים",
  "FINAL SECONDS": "שניות אחרונות",
  "REGULATION": "זמן רגיל",
  "OT": "הארכה",
  "FINAL": "סיום",
  "Overtime, sudden death": "הארכה, השער הבא מנצח",
  "Match complete": "המשחק הסתיים",
  "Match not started": "המשחק טרם התחיל",
  "No room joined": "טרם הצטרפתם לחדר",
  "Camera: unavailable": "מצלמה אינה זמינה",
  "Controls": "מקשי שליטה",
  "Boost": "האצה",
  "BOOST": "האצה",
  "Boost unavailable": "האצה אינה זמינה",
  "DRIVE": "נסיעה",
  "STEER": "היגוי",
  "AIR YAW": "פנייה באוויר",
  "JUMP": "קפיצה",
  "SLIDE": "החלקה",
  "CAMERA": "מצלמה",
  "W and S: drive forward and reverse": "W ו־S: נסיעה קדימה ואחורה",
  "A and D: steer on the ground, roll in the air": "A ו־D: היגוי על הקרקע, גלגול באוויר",
  "Q and E: yaw while airborne": "Q ו־E: פנייה באוויר",
  "Space: jump, press again for a second jump": "Space: קפיצה, לחיצה נוספת לקפיצה שנייה",
  "Shift: boost": "Shift: האצה",
  "Control: powerslide": "Control: החלקה",
  "C: switch between car cam and ball cam": "C: מעבר בין מצלמת רכב למצלמת כדור",
  "BALL CAM": "מצלמת כדור",
  "CAR CAM": "מצלמת רכב",
  "ORBIT": "מבט היקפי",
  "Camera: ball cam": "מצלמה: כדור",
  "Camera: car cam": "מצלמה: רכב",
  "Camera: orbit": "מצלמה: מבט היקפי",
  "OVERTIME": "הארכה",
  "Overtime. Next goal wins.": "הארכה. השער הבא מנצח.",
  "Blue": "כחולים",
  "Orange": "כתומים",
  "Sound controls": "בקרת קול",
  "SOUND": "קול",
  "MUTED": "מושתק",
  "Unmute sound": "ביטול השתקה",
  "Driving comparison": "השוואת נהיגה",
  "Driving test": "בדיקת נהיגה",
  "Response": "תגובת הנהיגה",
  "Local prediction": "חיזוי מקומי",
  "Shorter delay · 40 ms": "השהיה קצרה · 40 מילישניות",
  "Original delay · 100 ms": "השהיה מקורית · 100 מילישניות",
  "Download test data": "הורדת נתוני הבדיקה",
  "Local driving with a 50 ms pose buffer. Corrections may appear during collisions.": "נהיגה מקומית עם השהיית תצוגה של 50 מילישניות. ייתכנו תיקונים בזמן התנגשויות.",
  "Local driving with the previous presentation filter. Corrections may appear during collisions.": "נהיגה מקומית עם מנגנון התצוגה הקודם. ייתכנו תיקונים בזמן התנגשויות.",
  "Server movement with a smaller smoothing buffer.": "תנועת שרת עם השהיית החלקה קצרה יותר.",
  "Server movement with the upstream smoothing delay.": "תנועת שרת עם השהיית ההחלקה המקורית.",
  "Collecting foreground play measurements…": "אוספים מדידות בזמן משחק פעיל…",
  "Create a Custom Room to test. You can start alone.": "צרו חדר פרטי לבדיקה. אפשר להתחיל לבד.",
  "Waiting for game server…": "ממתינים לשרת המשחק…",
  "Loading prediction physics…": "טוענים את מנגנון החיזוי…",
  "Catching up prediction…": "משלימים חיזוי…",
  "Updating prediction…": "מעדכנים חיזוי…",
  "Build: {build} · Test: {test}": "גרסה: {build} · בדיקה: {test}",
  "Last window: {active}% prediction active · frame p95 ≤ {frame} ms": "במדידה האחרונה: החיזוי פעיל {active}% מהזמן · פריים p95 עד {frame} מילישניות",
  " · {confirmed}% updates confirmed": " · {confirmed}% מהעדכונים אומתו",
  "Blue score: {value}": "תוצאת הכחולים: {value}",
  "Orange score: {value}": "תוצאת הכתומים: {value}",
  "Time remaining: {value}": "הזמן שנותר: {value}",
  "{value} boost": "{value} האצה",
  "{connected} of {capacity} players connected, {team} per team, {mode} match": "מחוברים {connected} מתוך {capacity} שחקנים, עד {team} בקבוצה, משחק {mode}",
  "custom": "פרטי",
  "quick": "מהיר",
  "BLUE VICTORY": "ניצחון לכחולים",
  "ORANGE VICTORY": "ניצחון לכתומים"
};

/** Interpolate plain text; callers keep untrusted values out of HTML templates. */
export function t(message: string, values: Readonly<Record<string, string | number>> = {}, locale: Language = language): string {
  const translated = locale === 'he' ? hebrew[message] ?? message : message;
  return translated.replace(/\{([a-zA-Z]+)\}/g, (slot, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : slot);
}

/** Isolate Latin codes/keys or numeric runs inside an RTL plain-text message. */
export function ltr(value: string | number): string { return `\u2066${value}\u2069`; }

export function applyDocumentLocale(): void {
  document.documentElement.lang = language;
  // World-space layout, score ordering, and controls retain their physical directions.
  document.documentElement.dir = 'ltr';
  document.title = t('Rocket Arena');
}

const HUD_PATTERNS: readonly [RegExp, (...parts: string[]) => string][] = [
  [/^Blue score: (\d+)$/, value => t('Blue score: {value}', {value}, 'he')],
  [/^Orange score: (\d+)$/, value => t('Orange score: {value}', {value}, 'he')],
  [/^Time remaining: ([\d:]+)$/, value => t('Time remaining: {value}', {value: ltr(value)}, 'he')],
  [/^(\d+) boost$/, value => t('{value} boost', {value}, 'he')],
  [/^(\d+) of (\d+) players connected, (\d+) per team, (custom|quick) match$/, (connected, capacity, team, mode) => t('{connected} of {capacity} players connected, {team} per team, {mode} match', {connected, capacity, team, mode:t(mode, {}, 'he')}, 'he')],
  [/^(BLUE|ORANGE) GOAL · (\d+) — (\d+)$/, (team, blue, orange) => `שער ל${team === 'BLUE' ? 'כחולים' : 'כתומים'} · ${ltr(`${blue} — ${orange}`)}`],
  [/^(BLUE|ORANGE) WINS · (\d+) — (\d+)$/, (team, blue, orange) => `${team === 'BLUE' ? 'הכחולים' : 'הכתומים'} ניצחו · ${ltr(`${blue} — ${orange}`)}`],
  [/^FULL TIME · (BLUE|ORANGE) WINS$/, team => `המשחק הסתיים · ${team === 'BLUE' ? 'הכחולים' : 'הכתומים'} ניצחו`],
  [/^(Blue|Orange) goal\. Blue (\d+), Orange (\d+)\.$/, (team, blue, orange) => `שער ל${team === 'Blue' ? 'כחולים' : 'כתומים'}. כחולים ${blue}, כתומים ${orange}.`],
  [/^(Full time\. )?(Blue|Orange) wins\. Blue (\d+), Orange (\d+)\.$/, (prefix, team, blue, orange) => `${prefix ? 'המשחק הסתיים. ' : ''}${team === 'Blue' ? 'הכחולים' : 'הכתומים'} ניצחו. כחולים ${blue}, כתומים ${orange}.`],
];

/** Translate the pure HUD model's bounded presentation vocabulary at the DOM boundary. */
const hudTranslations = new Map<string, string>();
export function hudText(message: string, locale: Language = language): string {
  if (locale === 'en') return message;
  if (hebrew[message]) return hebrew[message];
  const cached=hudTranslations.get(message);
  if(cached!==undefined)return cached;
  for (const [pattern, translate] of HUD_PATTERNS) {
    const match = message.match(pattern);
    if (match) {
      const translated=translate(...match.slice(1));
      if(hudTranslations.size>=512)hudTranslations.delete(hudTranslations.keys().next().value!);
      hudTranslations.set(message,translated);
      return translated;
    }
  }
  return message;
}

export function labStatus(message: string): string {
  if (language === 'en') return message;
  const match = message.match(/^(\d+) ms ping · (\d+) fps · (\d+) pending inputs(?: · (.*))?$/);
  if (!match) return t(message);
  return `פינג ${ltr(match[1])} מילישניות · ${ltr(match[2])} FPS · ${ltr(match[3])} קלטים בהמתנה`
    + (match[4] ? ` · ${t(match[4])}` : '');
}

/** Reserved lab bot names are labels; arbitrary human names remain verbatim. */
export function formatPlayerName(name: string): string {
  const bot = /^Lab Bot ([1-7])$/.exec(name);
  return bot ? `${t('Bot')} ${bot[1]}` : name;
}
