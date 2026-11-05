import type { SupabaseClient } from "@supabase/supabase-js";

type ChatWrite = {
  id?: string;
  session_id: string;
  sender_id: string;
  sender_name: string;
  message: string;
  is_system: false;
};

/** Retrying an ID may acknowledge its original row, never overwrite it. */
export async function persistSessionChat(
  client: SupabaseClient,
  row: ChatWrite,
) {
  if (!row.id) return client.from("chat_messages").insert(row);
  const result = await client
    .from("chat_messages")
    .upsert(row, { onConflict: "id", ignoreDuplicates: true })
    .select("id");
  if (result.error || result.data?.length) return { error: result.error };
  const existing = await client
    .from("chat_messages")
    .select("session_id,sender_id,message,is_system")
    .eq("id", row.id)
    .maybeSingle();
  if (existing.error) return { error: existing.error };
  if (
    existing.data?.session_id === row.session_id &&
    existing.data.sender_id === row.sender_id &&
    existing.data.message === row.message &&
    existing.data.is_system === false
  )
    return { error: null };
  return {
    error: Object.assign(
      new Error("Chat request conflicts with an existing message"),
      { code: "CHAT_CONFLICT" },
    ),
  };
}
