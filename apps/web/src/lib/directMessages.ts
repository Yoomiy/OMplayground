import { reportTelemetry } from "@/utils/telemetry";
import { supabase } from "@/lib/supabase";
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
export async function dmRpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    reportTelemetry({
      level: "warn",
      message: "Direct message operation failed",
      context: { appArea: "inbox", operation: name, code: error.code },
    });
    throw new Error(
      error.message.includes("DM_NOT_")
        ? "לא ניתן לשלוח הודעה למשתמש הזה כרגע"
        : "לא ניתן לעדכן הודעות כרגע. אפשר לנסות שוב",
    );
  }
  return data as T;
}
export const cursorArgs = (cursor?: Cursor) => ({
  p_before: cursor?.created_at ?? null,
  p_before_id: cursor?.id ?? null,
});
export const roleLabel = (role?: string) =>
  role === "teacher" ? "מורה" : role === "admin" ? "הנהלה" : "";
