import type { Invitation } from "./challengePresentation";
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
    !row.self_in_session &&
    row.session_id !== currentSession &&
    row.session_status !== "completed"
  );
}
