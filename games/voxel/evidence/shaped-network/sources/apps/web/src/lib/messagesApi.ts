import { supabase } from "@/lib/supabase";

export async function sendMessage(args: {
  fromId: string;
  fromDisplayName: string;
  senderGender: "boy" | "girl";
  toId: string;
  toDisplayName: string;
  content: string;
}): Promise<void> {
  const text = args.content.trim().slice(0, 300);
  if (!text) throw new Error("EMPTY_MESSAGE");
  const { error } = await supabase.from("private_messages").insert({
    from_kid_id: args.fromId,
    from_display_name: args.fromDisplayName,
    sender_gender: args.senderGender,
    to_kid_id: args.toId,
    to_display_name: args.toDisplayName,
    content: text,
    is_from_admin: false
  });
  if (error) throw new Error(error.message);
}

export async function markReadByPartner(
  meId: string,
  partnerId: string
): Promise<void> {
  const { error } = await supabase
    .from("private_messages")
    .update({ is_read: true })
    .eq("to_kid_id", meId)
    .eq("from_kid_id", partnerId)
    .eq("is_read", false);
  if (error) throw new Error(error.message);
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
    reporter_note: args.note ?? null
  });
  if (error) throw new Error(error.message);
}
