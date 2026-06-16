import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useInbox, type InboxThread } from "@/hooks/useInbox";
import { markReadByPartner, reportMessage, sendMessage } from "@/lib/messagesApi";
import { KidAvatar } from "@/components/KidAvatar";
import { KidDesktopShell, desktopPanelClass } from "@/components/KidDesktopShell";
import { kidFieldInputClass } from "@/lib/fieldStyles";
import { cn } from "@/lib/cn";

const REPORT_NOTE_MAX_LENGTH = 500;

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
    thread.lastMessage.content.length > 58
      ? thread.lastMessage.content.slice(0, 58) + "…"
      : thread.lastMessage.content;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border px-3 py-3 text-right transition-all duration-200",
        active
          ? "border-violet-400 bg-violet-500/20 text-white shadow-[0_0_12px_rgba(139,92,246,0.3)]"
          : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:border-white/20"
      )}
    >
      {thread.partner ? (
        <KidAvatar
          profile={thread.partner}
          className="size-10 min-h-10 min-w-10 rounded-xl text-sm border border-white/10"
        />
      ) : (
        <span className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-sm font-black text-white/60">
          צוות
        </span>
      )}
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className={cn("truncate text-sm font-black transition-colors", active ? "text-violet-300" : "text-white")}>
            {thread.partner?.full_name ?? thread.lastMessage.from_display_name}
          </span>
          {thread.partner?.grade ? (
            <span className={cn("shrink-0 text-[11px] font-bold", active ? "text-violet-300/60" : "text-white/40")}>
              כיתה {thread.partner.grade}
            </span>
          ) : null}
        </span>
        <span className={cn("block truncate text-xs font-semibold mt-0.5", active ? "text-white/70" : "text-white/40")}>
          {preview}
        </span>
      </span>
      {thread.unreadCount > 0 ? (
        <span className="rounded-full bg-rose-500 px-2 py-1 text-[11px] font-black leading-none text-white shadow-[0_0_8px_rgba(239,68,68,0.5)]">
          {thread.unreadCount}
        </span>
      ) : null}
    </button>
  );
}

export function InboxPage() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { threads, loading, refetch } = useInbox();
  const [activePartnerId, setActivePartnerId] = useState<string | null>(null);
  const [threadSearch, setThreadSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [reportDraft, setReportDraft] = useState<{
    messageId: string;
    messageContent: string;
    note: string;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [searchParams] = useSearchParams();
  const kidIdFromUrl = searchParams.get("kidId");

  useEffect(() => {
    if (kidIdFromUrl) setActivePartnerId(kidIdFromUrl);
  }, [kidIdFromUrl]);

  const filteredThreads = useMemo(() => {
    const q = threadSearch.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((thread) => {
      const name =
        thread.partner?.full_name ??
        thread.partner?.username ??
        thread.lastMessage.from_display_name;
      return (
        name.toLowerCase().includes(q) ||
        thread.lastMessage.content.toLowerCase().includes(q)
      );
    });
  }, [threadSearch, threads]);

  const active = threads.find((thread) => thread.partnerId === activePartnerId) ?? null;

  useEffect(() => {
    setReportDraft(null);
  }, [activePartnerId]);

  useEffect(() => {
    if (!user || !active || active.unreadCount === 0) return;
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

  async function onReport() {
    if (!user || !profile || !active || !active.partner || !reportDraft) return;
    try {
      setReportBusy(true);
      await reportMessage({
        reporterKidId: user.id,
        reporterKidName: profile.full_name,
        reportedKidId: active.partner.id,
        reportedKidName: active.partner.full_name,
        messageContent: reportDraft.messageContent,
        note: reportDraft.note.trim() || undefined
      });
      setReportDraft(null);
      setErr("הדיווח נשלח לצוות");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "דיווח נכשל");
    } finally {
      setReportBusy(false);
    }
  }

  return (
    <KidDesktopShell
      title="הודעות"
      subtitle="שיחות עם ילדים וצוות"
      contentClassName="grid min-h-[calc(100vh-136px)] gap-4 xl:grid-cols-[360px_minmax(0,1fr)_280px]"
    >
      <aside className={desktopPanelClass("flex min-h-[560px] flex-col p-4")}>
        <div className="mb-3 border-b border-white/10 pb-3">
          <h2 className="text-base font-black text-white">שיחות</h2>
          <p className="text-xs font-bold text-white/50">
            {threads.length} שיחות
          </p>
        </div>
        <label className="relative mb-3 block">
          <Search className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-white/40" aria-hidden />
          <input
            className={kidFieldInputClass}
            value={threadSearch}
            onChange={(event) => setThreadSearch(event.target.value)}
            placeholder="חפשו שיחה..."
          />
        </label>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-hide">
          {loading ? (
            <p className="text-sm font-bold text-white/50">טוען…</p>
          ) : filteredThreads.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 text-sm font-bold text-white/50 text-center">
              <p>אין שיחות מתאימות.</p>
              <Link className="mt-2 inline-block text-violet-400 underline decoration-2 underline-offset-4 hover:text-violet-300" to="/home">
                מצאו חברים מחוברים 🚀
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {filteredThreads.map((thread) => (
                <li key={thread.partnerId}>
                  <ThreadRow
                    thread={thread}
                    active={thread.partnerId === activePartnerId}
                    onOpen={() => setActivePartnerId(thread.partnerId)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <section className={desktopPanelClass("flex min-h-[560px] flex-col p-4")}>
        {err ? (
          <p className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900" role="alert">
            {err}
          </p>
        ) : null}

        {!active ? (
          <div className="m-auto max-w-sm text-center">
            <span className="text-5xl block mb-3 animate-kid-float">💬</span>
            <p className="text-lg font-black text-white">בחרו שיחה</p>
            <p className="mt-1 text-sm font-bold text-white/50">
              או חזרו ללוח כדי למצוא חבר מחובר.
            </p>
            <Link
              to="/home"
              className="mt-4 inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 border border-violet-400/50 px-6 py-3.5 text-sm font-black text-white shadow-[0_4px_16px_rgba(139,92,246,0.4)] hover:shadow-[0_4px_20px_rgba(139,92,246,0.6)] hover:-translate-y-0.5 transition-all"
            >
              ללוח המשחקים 🎮
            </Link>
          </div>
        ) : (
          <>
            <header className="mb-3 flex items-center gap-3 border-b border-white/10 pb-3">
              {active.partner ? (
                <KidAvatar
                  profile={active.partner}
                  className="size-11 min-h-11 min-w-11 rounded-xl text-sm border border-white/10"
                />
              ) : null}
              <div className="min-w-0">
                <h3 className="truncate text-lg font-black text-white">
                  {active.partner?.full_name ?? active.partnerId.slice(0, 8)}
                </h3>
                {active.partner ? (
                  <p className="text-xs font-bold text-white/50">
                    @{active.partner.username} · כיתה {active.partner.grade}
                  </p>
                ) : null}
              </div>
            </header>

            <ul className="flex min-h-0 flex-1 flex-col-reverse gap-2 overflow-y-auto pr-1 text-sm custom-scrollbar">
              {active.messages.map((message) => {
                const mine = message.from_kid_id === user?.id;
                return (
                  <li
                    key={message.id}
                    className={cn(
                      "max-w-[72%] rounded-2xl px-4 py-2.5 text-sm",
                      mine
                        ? "mr-auto rounded-br-sm bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-[0_4px_12px_rgba(139,92,246,0.3)]"
                        : "ml-auto rounded-bl-sm bg-white/10 border border-white/5 text-white"
                    )}
                  >
                    <span className="block whitespace-pre-wrap break-words">
                      {message.content}
                    </span>
                    {!mine && active.partner ? (
                      reportDraft?.messageId === message.id ? (
                        <div className="mt-3 w-full space-y-2.5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-3 text-right text-white shadow-md">
                          <textarea
                            className={cn(kidFieldInputClass, "min-h-[74px] resize-none text-xs")}
                            maxLength={REPORT_NOTE_MAX_LENGTH}
                            value={reportDraft.note}
                            onChange={(event) =>
                              setReportDraft({ ...reportDraft, note: event.target.value })
                            }
                            placeholder="מה קרה בהודעה הזאת?"
                          />
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[10px] font-bold text-white/40">
                              {reportDraft.note.length}/{REPORT_NOTE_MAX_LENGTH}
                            </span>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="rounded-xl px-3 py-1 text-xs font-bold text-white/60 hover:bg-white/10 transition-colors"
                                disabled={reportBusy}
                                onClick={() => setReportDraft(null)}
                              >
                                ביטול
                              </button>
                              <button
                                type="button"
                                className="rounded-xl bg-rose-500 hover:bg-rose-600 px-3 py-1 text-xs font-black text-white shadow-sm transition-all"
                                disabled={reportBusy}
                                onClick={() => void onReport()}
                              >
                                שלח דיווח
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="mt-2 block text-[10px] font-black text-rose-400/80 hover:text-rose-300 underline decoration-2 underline-offset-2 transition-colors"
                          onClick={() =>
                            setReportDraft({
                              messageId: message.id,
                              messageContent: message.content,
                              note: ""
                            })
                          }
                        >
                          🚩 דווח לצוות
                        </button>
                      )
                    ) : null}
                  </li>
                );
              })}
            </ul>

            <div className="mt-3 flex gap-2 border-t border-white/10 pt-3">
              <input
                className={cn(kidFieldInputClass, "min-h-11 flex-1")}
                maxLength={300}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="כתבו הודעה..."
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (!busy) void send();
                  }
                }}
              />
              <button
                type="button"
                className="rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 hover:shadow-[0_4px_12px_rgba(139,92,246,0.3)] border border-violet-400/50 px-5 py-2.5 text-sm font-black text-white hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50"
                disabled={busy || !draft.trim()}
                onClick={() => void send()}
              >
                שלח
              </button>
            </div>
          </>
        )}
      </section>

      <aside className={desktopPanelClass("hidden p-4 xl:block")}>
        <h2 className="text-base font-black text-white">פרטי שיחה</h2>
        {active?.partner ? (
          <div className="mt-4 space-y-4">
            <KidAvatar
              profile={active.partner}
              className="size-24 min-h-24 min-w-24 rounded-2xl text-3xl border-2 border-white/20"
            />
            <div>
              <p className="text-lg font-black text-white">{active.partner.full_name}</p>
              <p className="text-sm font-bold text-white/50">
                @{active.partner.username}
              </p>
              <p className="mt-1 text-sm font-bold text-white/50">
                כיתה {active.partner.grade}
              </p>
            </div>
            <Link
              to={`/profile/${active.partner.id}`}
              className="mt-4 w-full flex items-center justify-center rounded-2xl bg-white/10 border border-white/20 py-3 text-xs font-black text-white hover:bg-white/15 hover:-translate-y-0.5 transition-all duration-200"
            >
              צפה בפרופיל 👤
            </Link>
          </div>
        ) : (
          <p className="mt-4 text-sm font-bold text-white/40">
            בחרו שיחה כדי לראות פרטים.
          </p>
        )}
      </aside>
    </KidDesktopShell>
  );
}
