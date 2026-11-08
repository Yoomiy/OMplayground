import type { Invitation } from "./challengePresentation";
export function challengeUpdateMessage(
  row: Invitation,
  previous: Invitation | undefined,
  userId: string,
  now = Date.now(),
): string | null {
  if (previous?.status === row.status || row.fulfilled_at || row.withdrawn_by === userId)
    return null;
  if (row.status === "pending" && row.to_kid_id === userId)
    return `${row.partner_name} הזמין אתכם לשחק ${row.game_name}`;
  if (!previous) return null;
  if (row.status === "accepted" && row.from_kid_id === userId)
    return `${row.partner_name} אישר את ההזמנה שלכם`;
  if (row.status === "declined" && row.from_kid_id === userId)
    return `${row.partner_name} ויתר על ההזמנה`;
  if (row.status === "expired") {
    if (!row.withdrawn_by && Date.parse(row.expires_at) <= now)
      return `פג התוקף של ההזמנה עם ${row.partner_name}`;
    if (row.to_kid_id === userId) return `${row.partner_name} ביטל את ההזמנה`;
  }
  return null;
}
export interface ChallengeAvailability {
  busy: boolean;
}
export function challengeAvailability(
  row: Invitation,
  currentSession?: string,
): ChallengeAvailability {
  return { busy: row.self_busy || (!!currentSession && currentSession !== row.session_id) };
}
/** Remind only about an accepted outgoing invitation observed while its sender was busy. */
export function becameAvailable(
  row: Invitation,
  previous: ChallengeAvailability | undefined,
  userId: string,
  currentSession?: string,
  _now = Date.now(),
): boolean {
  return (
    previous?.busy === true &&
    !challengeAvailability(row, currentSession).busy &&
    row.from_kid_id === userId &&
    row.status === "accepted" &&
    row.session_id !== currentSession &&
    row.session_status !== "completed"
  );
}
