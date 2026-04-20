import { supabase } from "@/lib/supabase";

export interface SendFriendRequestResult {
  status: "pending" | "accepted";
  mutual?: boolean;
  already?: boolean;
}

export async function sendFriendRequest(
  toId: string
): Promise<SendFriendRequestResult> {
  const { data, error } = await supabase.rpc("send_friend_request", {
    to_uid: toId
  });
  if (error) throw new Error(error.message);
  return data as SendFriendRequestResult;
}

export async function respondToFriendRequest(
  friendshipId: string,
  accept: boolean
): Promise<void> {
  const { error } = await supabase
    .from("friendships")
    .update({ status: accept ? "accepted" : "declined" })
    .eq("id", friendshipId);
  if (error) throw new Error(error.message);
}

export async function unfriend(meId: string, partnerId: string): Promise<void> {
  const { error } = await supabase
    .from("friendships")
    .delete()
    .or(
      `and(requester_id.eq.${meId},addressee_id.eq.${partnerId}),and(requester_id.eq.${partnerId},addressee_id.eq.${meId})`
    );
  if (error) throw new Error(error.message);
}

export async function blockKid(targetId: string): Promise<void> {
  const { error } = await supabase.rpc("block_kid", { target: targetId });
  if (error) throw new Error(error.message);
}

export async function unblockKid(
  meId: string,
  targetId: string
): Promise<void> {
  const { error } = await supabase
    .from("kid_blocks")
    .delete()
    .eq("blocker_id", meId)
    .eq("blocked_id", targetId);
  if (error) throw new Error(error.message);
}
