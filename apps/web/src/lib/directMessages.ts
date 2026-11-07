import { reportTelemetry } from "@/utils/telemetry";
import { supabase } from "@/lib/supabase";
import { backendUnavailable, FeatureRequestError, isRecord, isTimestamp } from "./featureRecovery";
export interface Message {
  id: string;
  from_kid_id: string | null;
  to_kid_id: string;
  from_display_name: string;
  to_display_name: string;
  content: string;
  is_read: boolean;
  is_from_admin: boolean;
  sender_role?: "kid" | "teacher" | "admin";
  created_at: string;
}
export interface Participant {
  id: string;
  full_name: string;
  role: "kid" | "teacher" | "admin";
  can_send: boolean;
}
export interface Thread {
  partnerId: string;
  partner: Participant;
  lastMessage: Message;
  unreadCount: number;
}
export interface Cursor {
  created_at: string;
  id: string;
}

function validParticipant(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.full_name === "string" &&
    ["kid", "teacher", "admin"].includes(String(value.role)) &&
    typeof value.can_send === "boolean"
  );
}
function validMessage(value: unknown): boolean {
  return (
    isRecord(value) &&
    ["id", "to_kid_id", "content", "from_display_name"].every(
      (key) => typeof value[key] === "string",
    ) &&
    (value.from_kid_id === null || typeof value.from_kid_id === "string") &&
    typeof value.is_read === "boolean" &&
    isTimestamp(value.created_at)
  );
}
const validCount = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export function validateInboxPayload(name: string, data: unknown): void {
  const valid =
    name === "list_private_threads"
      ? isRecord(data) &&
        validCount(data.unread_total) &&
        Array.isArray(data.threads) &&
        data.threads.every(
          (thread) =>
            isRecord(thread) &&
            typeof thread.partnerId === "string" &&
            validParticipant(thread.partner) &&
            validMessage(thread.lastMessage) &&
            validCount(thread.unreadCount),
        )
      : name === "get_private_thread"
        ? isRecord(data) &&
          validParticipant(data.partner) &&
          Array.isArray(data.messages) &&
          data.messages.every(validMessage)
        : true;
  if (!valid) throw new FeatureRequestError("ההודעות אינן זמינות כרגע. אפשר לנסות שוב בהמשך", true);
}
export async function dmRpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  let response;
  try {
    response = await supabase.rpc(name, args);
  } catch {
    reportTelemetry({
      level: "warn",
      message: "Direct message request failed",
      context: { appArea: "inbox", operation: name, code: "TRANSPORT_ERROR" },
    });
    throw new FeatureRequestError("לא ניתן לעדכן הודעות כרגע. אפשר לנסות שוב");
  }
  const { data, error } = response;
  if (error) {
    reportTelemetry({
      level: "warn",
      message: "Direct message operation failed",
      context: { appArea: "inbox", operation: name, code: error.code },
    });
    const unavailable = backendUnavailable(error);
    throw new FeatureRequestError(
      unavailable
        ? "ההודעות אינן זמינות כרגע. אפשר לנסות שוב בהמשך"
        : error.message.includes("DM_NOT_")
          ? "לא ניתן לשלוח הודעה למשתמש הזה כרגע"
          : "לא ניתן לעדכן הודעות כרגע. אפשר לנסות שוב",
      unavailable,
    );
  }
  try {
    validateInboxPayload(name, data);
  } catch (error) {
    reportTelemetry({
      level: "warn",
      message: "Invalid direct message response",
      context: { appArea: "inbox", operation: name, code: "INVALID_RESPONSE" },
    });
    throw error;
  }
  return data as T;
}
export const cursorArgs = (cursor?: Cursor) => ({
  p_before: cursor?.created_at ?? null,
  p_before_id: cursor?.id ?? null,
});
export const roleLabel = (role?: string) =>
  role === "teacher" ? "מורה" : role === "admin" ? "הנהלה" : "";
