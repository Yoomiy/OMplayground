import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PublicKidProfile } from "@/hooks/useOnlineKids";

export interface PrivateMessageRow {
  id: string;
  from_kid_id: string | null;
  is_from_admin: boolean;
  from_display_name: string;
  to_kid_id: string;
  to_display_name: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface InboxThread {
  partnerId: string;
  partner: PublicKidProfile | null;
  lastMessage: PrivateMessageRow;
  unreadCount: number;
  messages: PrivateMessageRow[];
}

async function loadMessages(userId: string): Promise<PrivateMessageRow[]> {
  const { data } = await supabase
    .from("private_messages")
    .select(
      "id, from_kid_id, is_from_admin, from_display_name, to_kid_id, to_display_name, content, is_read, created_at"
    )
    .or(`to_kid_id.eq.${userId},from_kid_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []) as PrivateMessageRow[];
}

async function loadPartners(
  partnerIds: string[]
): Promise<Map<string, PublicKidProfile>> {
  if (partnerIds.length === 0) return new Map();
  const { data } = await supabase
    .from("public_kid_profiles")
    .select(
      "id, username, full_name, gender, grade, avatar_color, avatar_preset_id, avatar_url, role"
    )
    .in("id", partnerIds);
  return new Map(
    ((data ?? []) as PublicKidProfile[]).map((p) => [p.id, p])
  );
}

function groupThreads(
  userId: string,
  messages: PrivateMessageRow[],
  partners: Map<string, PublicKidProfile>
): InboxThread[] {
  const byPartner = new Map<string, PrivateMessageRow[]>();
  for (const m of messages) {
    const other =
      m.from_kid_id === userId ? m.to_kid_id : m.from_kid_id ?? "__admin__";
    if (!other) continue;
    const arr = byPartner.get(other) ?? [];
    arr.push(m);
    byPartner.set(other, arr);
  }
  const threads: InboxThread[] = [];
  for (const [partnerId, list] of byPartner) {
    const sorted = [...list].sort(
      (a, b) => +new Date(b.created_at) - +new Date(a.created_at)
    );
    const unreadCount = sorted.filter(
      (m) => !m.is_read && m.to_kid_id === userId && m.from_kid_id === partnerId
    ).length;
    threads.push({
      partnerId,
      partner: partners.get(partnerId) ?? null,
      lastMessage: sorted[0],
      unreadCount,
      messages: sorted
    });
  }
  threads.sort(
    (a, b) =>
      +new Date(b.lastMessage.created_at) - +new Date(a.lastMessage.created_at)
  );
  return threads;
}

export function useInbox(userId: string | undefined) {
  const [messages, setMessages] = useState<PrivateMessageRow[]>([]);
  const [partners, setPartners] = useState<Map<string, PublicKidProfile>>(
    () => new Map()
  );
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!userId) {
      setMessages([]);
      setPartners(new Map());
      return;
    }
    setLoading(true);
    const msgs = await loadMessages(userId);
    const partnerIds = new Set<string>();
    for (const m of msgs) {
      const other = m.from_kid_id === userId ? m.to_kid_id : m.from_kid_id;
      if (other) partnerIds.add(other);
    }
    const profs = await loadPartners(Array.from(partnerIds));
    setMessages(msgs);
    setPartners(profs);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void refetch();

    const channelTopic = `inbox:${userId}:${Date.now()}:${Math.random()
      .toString(36)
      .slice(2)}`;
    const channel = supabase
      .channel(channelTopic)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "private_messages",
          filter: `to_kid_id=eq.${userId}`
        },
        () => {
          void refetch();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "private_messages",
          filter: `from_kid_id=eq.${userId}`
        },
        () => {
          void refetch();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "private_messages",
          filter: `to_kid_id=eq.${userId}`
        },
        (payload) => {
          const row = payload.new as PrivateMessageRow;
          setMessages((prev) =>
            prev.map((m) => (m.id === row.id ? { ...m, ...row } : m))
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, refetch]);

  const threads = useMemo(
    () => (userId ? groupThreads(userId, messages, partners) : []),
    [userId, messages, partners]
  );

  const unreadTotal = useMemo(
    () => threads.reduce((acc, t) => acc + t.unreadCount, 0),
    [threads]
  );

  return { threads, messages, loading, unreadTotal, refetch };
}
