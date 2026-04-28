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
import { fieldInputClass } from "@/lib/fieldStyles";
import { cn } from "@/lib/cn";

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
      className={cn(
        "flex w-full min-h-[52px] items-center justify-between gap-2 rounded-2xl border-2 px-3 py-2.5 text-right text-sm transition-colors",
        active
          ? "border-indigo-400 bg-indigo-50 shadow-sm"
          : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50"
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5 text-right">
        <span className="truncate font-bold text-slate-900">
          {thread.partner?.full_name ?? thread.lastMessage.from_display_name}
        </span>
        <span className="truncate text-xs text-slate-500">{preview}</span>
      </div>
      {thread.unreadCount > 0 ? (
        <span className="ml-2 shrink-0 rounded-full bg-indigo-600 px-2 py-1 text-[11px] font-bold leading-none text-white shadow-sm">
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
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-slate-200/90 bg-white/95 p-5 shadow-play">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">הודעות</h1>
          <p className="mt-1 text-sm text-slate-600">
            בחרו שיחה מהרשימה
          </p>
        </div>
        <Button variant="outline" type="button" asChild>
          <Link to="/home">בית</Link>
        </Button>
      </header>

      {loading ? (
        <p className="text-center text-sm text-slate-500">טוען…</p>
      ) : null}
      {err ? (
        <p
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900"
          role="alert"
        >
          {err}
        </p>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-[minmax(0,280px)_1fr]">
        <aside className="flex flex-col gap-3 rounded-3xl border border-slate-200/90 bg-white/95 p-4 shadow-play">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            שיחות
          </h2>
          {threads.length === 0 ? (
            <p className="text-sm text-slate-500">אין הודעות עדיין.</p>
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

        <section
          className={cn(
            "flex min-h-[360px] flex-col gap-3 rounded-3xl border border-slate-200/90 bg-white/95 p-4 shadow-play sm:p-5"
          )}
        >
          {!active ? (
            <p className="m-auto text-center text-sm text-slate-500">
              בחרו שיחה כדי לצפות בהודעות והשיבו עם חברים 👋
            </p>
          ) : (
            <>
              <header className="border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900">
                  {active.partner?.full_name ??
                    active.partnerId.slice(0, 8)}
                </h3>
              </header>
              <ul className="flex max-h-[420px] flex-1 flex-col-reverse gap-2 overflow-y-auto text-sm">
                {active.messages.map((m) => {
                  const mine = m.from_kid_id === user?.id;
                  return (
                    <li
                      key={m.id}
                      className={cn(
                        "flex flex-col gap-2 rounded-2xl px-4 py-3",
                        mine
                          ? "ml-8 items-end rounded-br-md bg-gradient-to-bl from-indigo-500 to-indigo-600 text-white shadow-md"
                          : "mr-8 items-start rounded-bl-md bg-slate-100 text-slate-900"
                      )}
                    >
                      <span className="whitespace-pre-wrap break-words">
                        {m.content}
                      </span>
                      {!mine ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-indigo-600 underline decoration-2 underline-offset-2 hover:text-indigo-800"
                          onClick={() => void onReport(m.content)}
                        >
                          דווח לצוות
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-end">
                <input
                  className={cn(fieldInputClass, "min-h-[48px] flex-1 sm:py-2.5")}
                  maxLength={300}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="כתוב הודעה (עד 300 תווים)…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!busy) void send();
                    }
                  }}
                />
                <Button
                  type="button"
                  disabled={busy || !draft.trim()}
                  size="lg"
                  className="shrink-0 sm:min-w-[100px]"
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
