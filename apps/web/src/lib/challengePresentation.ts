import type { GameChallengeRow } from "./challengeApi";
export type Invitation = GameChallengeRow & {
  partner_role: string;
  partner_name: string;
  game_name: string;
  partner_busy: boolean;
  self_busy: boolean;
  self_in_session: boolean;
  partner_in_session: boolean;
  can_cancel: boolean;
  session_status?: string;
  withdrawn?: boolean;
  withdrawn_by?: string | null;
  fulfilled_at?: string | null;
};
export function challengePresentation(row: Invitation, userId: string, currentSession?: string) {
  // Server presence can lag a departure (or refer to another tab). Only this route is "here".
  const selfHere = currentSession === row.session_id;
  const selfBusy = !selfHere && (row.self_busy || !!currentSession);
  if (row.withdrawn)
    return {
      title: `ההזמנה עם ${row.partner_name} בוטלה`,
      detail: "ההזמנה אושרה בעבר ונשמרה כאן, אבל אינה זמינה עוד לכניסה.",
      badge: "בוטלה",
      selfHere,
      selfBusy: false,
    };
  if (row.session_status === "completed")
    return {
      title: `המשחק עם ${row.partner_name} הסתיים`,
      detail: "ההזמנה נשמרה כאן, אך החדר הזה כבר הסתיים. אפשר לשלוח הזמנה חדשה.",
      badge: "הסתיים",
      selfHere,
      selfBusy: false,
    };
  if (row.status === "pending")
    return {
      title:
        row.to_kid_id === userId
          ? `${row.partner_name} מזמין אתכם לשחק`
          : `ההזמנה נשלחה ל${row.partner_name}`,
      detail: "",
      badge: row.to_kid_id === userId ? "הזמנה חדשה" : "ממתינים לתשובה",
      selfHere,
      selfBusy,
    };
  if (selfBusy)
    return {
      title: `ההזמנה עם ${row.partner_name} אושרה`,
      detail: row.partner_in_session
        ? `${row.partner_name} כבר בחדר ומחכה לכם. אתם במשחק אחר.`
        : `אתם במשחק אחר. ההזמנה עם ${row.partner_name} מחכה כאן.`,
      badge: row.partner_in_session ? "מחכים לכם בחדר" : "ההזמנה אושרה",
      selfHere,
      selfBusy,
    };
  if (selfHere)
    return {
      title: `החדר שלכם עם ${row.partner_name}`,
      detail: row.partner_in_session
        ? "שניכם בחדר. אפשר להתחיל!"
        : row.partner_busy
          ? `${row.partner_name} במשחק אחר. אתם כבר כאן ומחכים שיצטרף.`
          : `אתם כבר בחדר. מחכים ל${row.partner_name} שיצטרף.`,
      badge: "אתם בחדר",
      selfHere,
      selfBusy,
    };
  return {
    title: `אפשר לשחק עם ${row.partner_name}`,
    detail: row.partner_in_session
      ? `${row.partner_name} כבר בחדר ומחכה לכם.`
      : row.partner_busy
        ? `${row.partner_name} עדיין במשחק אחר. אפשר להיכנס ולהמתין או לחזור להזמנה בהמשך.`
        : "ההזמנה אושרה. היכנסו לחדר כשתהיו מוכנים.",
    badge: row.partner_in_session ? "מחכים לכם בחדר" : "ההזמנה אושרה",
    selfHere,
    selfBusy,
  };
}
export function challengeCountdown(expiresAt: string, now: number) {
  const seconds = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
