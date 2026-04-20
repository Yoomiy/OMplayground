import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useInbox, type InboxThread } from "@/hooks/useInbox";
import {
  markReadByPartner,
  reportMessage,
  sendMessage
} from "@/lib/messagesApi";
import { Button } from "@/components/ui/button";

function ThreadRow({
  thread,
  active,
  onOpen
}: {
  thread: InboxThread;
  active: boolean;
  onOpen: () => void;
}) {
  const preview =
    thread.lastMessage.content.length > 42
      ? thread.lastMessage.content.slice(0, 42) + "…"
      : thread.lastMessage.content;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={
        "flex w-full items-center justify-between rounded border px-3 py-2 text-right text-sm transition-colors " +
        (active
          ? "border-indigo-500 bg-slate-900"
          : "border-slate-700 bg-slate-900/60 hover:border-slate-500")
      }
    >
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium">
          {thread.partner?.full_name ?? thread.lastMessage.from_display_name}
        </span>
        <span className="truncate text-xs text-slate-400">{preview}</span>
      </div>
      {thread.unreadCount > 0 ? (
        <span className="ml-2 rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white">
          {thread.unreadCount}
        </span>
      ) : null}
    </button>
  );
}

export function InboxPage() {
  const { user } = useAuth();
  const { profile } = useProfile(user);
  const { threads, loading, refetch } = useInbox(user?.id);
  const [activePartnerId, setActivePartnerId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const active = threads.find((t) => t.partnerId === activePartnerId) ?? null;

  useEffect(() => {
    if (!user || !active) return;
    if (active.unreadCount === 0) return;
    void (async () => {
      await markReadByPartner(user.id, active.partnerId);
      await refetch();
    })();
  }, [active?.partnerId, active?.unreadCount, user?.id, refetch]);

  async function send() {
    if (!user || !profile || !active || !active.partner) return;
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    setErr(null);
    try {
      await sendMessage({
        fromId: user.id,
        fromDisplayName: profile.full_name,
        senderGender: profile.gender,
        toId: active.partner.id,
        toDisplayName: active.partner.full_name,
        content: text
      });
      setDraft("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "שליחה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  async function onReport(messageContent: string) {
    if (!user || !profile || !active || !active.partner) return;
    try {
      await reportMessage({
        reporterKidId: user.id,
        reporterKidName: profile.full_name,
        reportedKidId: active.partner.id,
        reportedKidName: active.partner.full_name,
        messageContent
      });
      setErr("הדיווח נשלח לצוות");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "דיווח נכשל");
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">הודעות</h1>
        <Button variant="outline" asChild>
          <Link to="/home">בית</Link>
        </Button>
      </header>

      {loading ? <p className="text-sm text-slate-400">טוען…</p> : null}
      {err ? (
        <p className="text-sm text-amber-300" role="alert">
          {err}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-[260px_1fr]">
        <aside className="space-y-2">
          <h2 className="text-sm font-medium text-slate-400">שיחות</h2>
          {threads.length === 0 ? (
            <p className="text-sm text-slate-400">אין הודעות עדיין.</p>
          ) : (
            <ul className="space-y-2">
              {threads.map((t) => (
                <li key={t.partnerId}>
                  <ThreadRow
                    thread={t}
                    active={t.partnerId === activePartnerId}
                    onOpen={() => setActivePartnerId(t.partnerId)}
                  />
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="flex min-h-[360px] flex-col gap-2 rounded-lg border border-slate-700 bg-slate-900/50 p-3">
          {!active ? (
            <p className="m-auto text-sm text-slate-400">
              בחר שיחה כדי לצפות בהודעות.
            </p>
          ) : (
            <>
              <header className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="text-sm font-medium">
                  {active.partner?.full_name ?? active.partnerId.slice(0, 8)}
                </h3>
              </header>
              <ul className="flex max-h-[420px] flex-1 flex-col-reverse gap-2 overflow-y-auto text-sm">
                {active.messages.map((m) => {
                  const mine = m.from_kid_id === user?.id;
                  return (
                    <li
                      key={m.id}
                      className={
                        "flex flex-col gap-1 rounded px-3 py-2 " +
                        (mine
                          ? "items-end bg-indigo-600/30"
                          : "items-start bg-slate-800/60")
                      }
                    >
                      <span className="whitespace-pre-wrap break-words">
                        {m.content}
                      </span>
                      {!mine ? (
                        <button
                          type="button"
                          className="text-[10px] text-slate-400 underline"
                          onClick={() => void onReport(m.content)}
                        >
                          דווח
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <div className="flex gap-2 border-t border-slate-800 pt-2">
                <input
                  className="flex-1 rounded border border-slate-600 bg-slate-950 px-2 py-1 text-sm"
                  maxLength={300}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="הודעה (עד 300)"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!busy) void send();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || !draft.trim()}
                  onClick={() => void send()}
                >
                  שלח
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
