import type { Invitation } from "./challengePresentation";
import { FeatureRequestError, isRecord, isTimestamp } from "./featureRecovery";

export function parseInvitations(value: unknown): Invitation[] {
  if (
    !Array.isArray(value) ||
    !value.every(
      (row) =>
        isRecord(row) &&
        [
          "id",
          "from_kid_id",
          "to_kid_id",
          "session_id",
          "game_id",
          "partner_role",
          "partner_name",
          "game_name",
        ].every((key) => typeof row[key] === "string") &&
        ["pending", "accepted", "declined", "expired"].includes(String(row.status)) &&
        isTimestamp(row.created_at) &&
        isTimestamp(row.expires_at) &&
        ["self_busy", "partner_busy", "self_in_session", "partner_in_session", "can_cancel"].every(
          (key) => typeof row[key] === "boolean",
        ) &&
        (row.session_status === undefined || typeof row.session_status === "string"),
    )
  )
    throw new FeatureRequestError("ההזמנות אינן זמינות כרגע. אפשר לנסות שוב בהמשך", true);
  return value as Invitation[];
}
