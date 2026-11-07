import { dmRpc } from "@/lib/directMessages";
import { supabase } from "@/lib/supabase";

export async function sendMessage(args: {
  fromId: string;
  fromDisplayName: string;
  senderGender: "boy" | "girl";
  toId: string;
  toDisplayName: string;
  content: string;
}): Promise<void> {
  await dmRpc("send_private_message", {
    p_to: args.toId,
    p_content: args.content,
    p_request_id: crypto.randomUUID(),
  });
}
export async function reportMessage(args: {
  reporterKidId: string;
  reporterKidName: string;
  reportedKidId: string;
  reportedKidName: string;
  messageContent: string;
  note?: string;
}): Promise<void> {
  const { error } = await supabase.from("moderation_reports").insert({
    reporter_kid_id: args.reporterKidId,
    reporter_kid_name: args.reporterKidName,
    reported_kid_id: args.reportedKidId,
    reported_kid_name: args.reportedKidName,
    message_content: args.messageContent,
    reporter_note: args.note ?? null,
  });
  if (error) throw new Error(error.message);
}
