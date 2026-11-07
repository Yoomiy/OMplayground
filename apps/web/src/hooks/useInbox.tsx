import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import {
  dmRpc,
  cursorArgs,
  type Message,
  type Participant,
  type Thread,
} from "@/lib/directMessages";
import { reportTelemetry } from "@/utils/telemetry";
export type PrivateMessageRow = Message;
export type InboxThread = Thread;
function useInboxState(userId?: string) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [unreadTotal, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [connection, setConnection] = useState<"connecting" | "live" | "degraded">("connecting");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [partner, setPartner] = useState<Participant | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasThreads, setHasThreads] = useState(false);
  const [hasHistory, setHasHistory] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [arrivals, setArrivals] = useState<Message[]>([]);
  const activeRef = useRef(active);
  activeRef.current = active;
  const alive = useRef(true);
  const threadVersion = useRef(0),
    historyVersion = useRef(0);
  const baseline = useRef(false),
    seen = useRef(new Set<string>());
  const requests = useRef(new Map<string, { text: string; id: string }>());
  const threadRows = useRef(threads);
  threadRows.current = threads;
  const historyRows = useRef(messages);
  historyRows.current = messages;
  const historyMore = useRef(false);
  const loadHistory = useCallback(async (older = false) => {
    const id = activeRef.current;
    if (!id) return;
    const version = ++historyVersion.current;
    try {
      const cursor = older ? historyRows.current.at(-1) : undefined;
      const data = await dmRpc<{ partner: Participant; messages: Message[] }>(
        "get_private_thread",
        { p_partner: id, ...cursorArgs(cursor) },
      );
      if (!alive.current || version !== historyVersion.current || id !== activeRef.current) return;
      setPartner(data.partner);
      if (older) {
        historyMore.current = true;
        setHasHistory(data.messages.length > 50);
      } else if (!historyMore.current) setHasHistory(data.messages.length > 50);
      const page = data.messages.slice(0, 50);
      setMessages((previous) =>
        older || historyMore.current
          ? [...new Map([...previous, ...page].map((m) => [m.id, m])).values()].sort(
              (a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
            )
          : page,
      );
    } catch (e) {
      if (alive.current && id === activeRef.current) setError((e as Error).message);
    }
  }, []);
  const refetch = useCallback(
    async (older = false) => {
      if (!userId) return;
      const version = ++threadVersion.current;
      setLoading(true);
      try {
        const cursor = older ? threadRows.current.at(-1)?.lastMessage : undefined;
        const data = await dmRpc<{ threads: Thread[]; unread_total: number }>(
          "list_private_threads",
          cursorArgs(cursor),
        );
        if (!alive.current || version !== threadVersion.current) return;
        const next = data.threads.slice(0, 30);
        if (!older) {
          const incoming = next
            .map((t) => t.lastMessage)
            .filter((m) => m.to_kid_id === userId && !m.is_read && !seen.current.has(m.id));
          if (baseline.current && incoming.length)
            setArrivals((previous) => [...previous, ...incoming].slice(-30));
          baseline.current = true;
        }
        for (const t of next) seen.current.add(t.lastMessage.id);
        if (seen.current.size > 2000) seen.current = new Set([...seen.current].slice(-1000));
        setThreads((previous) =>
          [...new Map([...previous, ...next].map((t) => [t.partnerId, t])).values()].sort(
            (a, b) =>
              b.lastMessage.created_at.localeCompare(a.lastMessage.created_at) ||
              b.lastMessage.id.localeCompare(a.lastMessage.id),
          ),
        );
        if (older || threadRows.current.length <= 30) setHasThreads(data.threads.length > 30);
        setUnread(data.unread_total);
        setError("");
        if (!older) void loadHistory();
      } catch (e) {
        if (alive.current) setError((e as Error).message);
      } finally {
        if (alive.current && version === threadVersion.current) setLoading(false);
      }
    },
    [userId, loadHistory],
  );
  useEffect(() => {
    alive.current = true;
    if (!userId) return;
    let disposed = false,
      epoch = 0,
      failedAt = 0,
      lastRetry = 0;
    void refetch();
    const subscribe = () => {
      const current = ++epoch;
      return supabase
        .channel(`inbox:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "private_messages",
            filter: `to_kid_id=eq.${userId}`,
          },
          () => void refetch(),
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "private_messages",
            filter: `from_kid_id=eq.${userId}`,
          },
          () => void refetch(),
        )
        .subscribe((status, err) => {
          if (disposed || current !== epoch) return;
          if (status === "SUBSCRIBED") {
            if (failedAt)
              reportTelemetry({
                level: "info",
                message: "Inbox realtime recovered",
                context: { appArea: "inbox" },
              });
            failedAt = 0;
            setConnection("live");
            void refetch();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            if (!failedAt)
              reportTelemetry({
                level: "warn",
                message: "Inbox realtime channel failed",
                context: {
                  appArea: "inbox",
                  status,
                  errorName: err?.name,
                  errorMessage: err?.message
                    ?.replace(
                      /Bearer\s+\S+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
                      "[redacted]",
                    )
                    .replace(/(apikey|access_token|token)=[^&\s]+/gi, "$1=[redacted]")
                    .slice(0, 300),
                },
              });
            failedAt ||= Date.now();
            setConnection("degraded");
          }
        });
    };
    let channel = subscribe();
    const refresh = () => {
      if (!document.hidden) void refetch();
    };
    const timer = setInterval(() => {
      if (document.hidden) return;
      // Polling also discovers changes missed during apparently healthy subscriptions.
      refresh();
      if (failedAt && Date.now() - Math.max(failedAt, lastRetry) > 60_000) {
        lastRetry = Date.now();
        ++epoch;
        void supabase.removeChannel(channel).then(() => {
          if (!disposed) channel = subscribe();
        });
      }
    }, 15_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      alive.current = false;
      disposed = true;
      ++epoch;
      ++threadVersion.current;
      ++historyVersion.current;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
      void supabase.removeChannel(channel);
    };
  }, [userId, refetch]);
  const select = useCallback(
    (id: string, show = true) => {
      activeRef.current = id;
      ++historyVersion.current;
      historyMore.current = false;
      setActive(id);
      setPartner(null);
      setMessages([]);
      setError("");
      setHasHistory(false);
      if (show) setOpen(true);
      void loadHistory();
    },
    [loadHistory],
  );
  async function send() {
    const id = activeRef.current,
      text = id ? (drafts[id] ?? "").trim() : "";
    if (!id || !text || sending[id]) return;
    const prior = requests.current.get(id);
    const request = prior?.text === text ? prior : { text, id: crypto.randomUUID() };
    requests.current.set(id, request);
    setSending((p) => ({ ...p, [id]: true }));
    setError("");
    try {
      await dmRpc("send_private_message", { p_to: id, p_content: text, p_request_id: request.id });
      if (!alive.current) return;
      setDrafts((p) => (p[id]?.trim() === text ? { ...p, [id]: "" } : p));
      requests.current.delete(id);
      void refetch();
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      if (alive.current) setSending((p) => ({ ...p, [id]: false }));
    }
  }
  const markRead = useCallback(
    async (ids: string[]) => {
      try {
        await dmRpc("mark_private_messages_read", { p_ids: ids });
        if (alive.current) {
          setMessages((previous) =>
            previous.map((message) =>
              ids.includes(message.id) ? { ...message, is_read: true } : message,
            ),
          );
          void refetch();
        }
      } catch (e) {
        if (alive.current) setError((e as Error).message);
      }
    },
    [refetch],
  );
  return {
    threads,
    messages,
    loading,
    connection,
    error,
    unreadTotal,
    refetch: () => refetch(),
    loadThreads: () => refetch(true),
    hasThreads,
    open,
    setOpen,
    active,
    partner,
    select,
    hasHistory,
    loadHistory: () => loadHistory(true),
    drafts,
    setDraft: (text: string) => {
      if (active) setDrafts((p) => ({ ...p, [active]: text }));
    },
    sending,
    send,
    markRead,
    arrivals,
  };
}
const InboxContext = createContext<ReturnType<typeof useInboxState> | null>(null);
function UserInbox({ children, userId }: { children: ReactNode; userId?: string }) {
  const value = useInboxState(userId);
  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}
export function InboxProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return (
    <UserInbox key={user?.id ?? "anonymous"} userId={user?.id}>
      {children}
    </UserInbox>
  );
}
export function useInbox() {
  const value = useContext(InboxContext);
  if (!value) throw new Error("InboxProvider required");
  return value;
}
