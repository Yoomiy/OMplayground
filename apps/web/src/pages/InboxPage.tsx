import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useInbox, type InboxThread } from "@/hooks/useInbox";
import { markReadByPartner, reportMessage, sendMessage } from "@/lib/messagesApi";
import { KidAvatar } from "@/components/KidAvatar";
import { Button } from "@/components/ui/button";
import { KidDesktopShell, desktopPanelClass } from "@/components/KidDesktopShell";
import { fieldInputClass } from "@/lib/fieldStyles";
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
        "grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border px-3 py-3 text-right transition",
        active
          ? "border-indigo-300 bg-indigo-50 shadow-sm"
          : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50"
      )}
    >
      {thread.partner ? (
        <KidAvatar
          profile={thread.partner}
          className="size-10 min-h-10 min-w-10 rounded-xl text-sm"
        />
      ) : (
        <span className="flex size-10 items-center justify-center rounded-xl bg-slate-200 text-sm font-black text-slate-600">
          צוות
        </span>
      )}
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-black text-slate-900">
            {thread.partner?.full_name ?? thread.lastMessage.from_display_name}
          </span>
          {thread.partner?.grade ? (
            <span className="shrink-0 text-[11px] font-bold text-slate-500">
              כיתה {thread.partner.grade}
            </span>
          ) : null}
        </span>
        <span className="block truncate text-xs font-semibold text-slate-500">
          {preview}
        </span>
      </span>
      {thread.unreadCount > 0 ? (
        <span className="rounded-full bg-indigo-600 px-2 py-1 text-[11px] font-black leading-none text-white">
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
        <div className="mb-3 border-b border-slate-100 pb-3">
          <h2 className="text-base font-black text-slate-950">שיחות</h2>
          <p className="text-xs font-semibold text-slate-500">
            {threads.length} שיחות
          </p>
        </div>
        <label className="relative mb-3 block">
          <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            className="min-h-10 w-full rounded-xl border-2 border-slate-200 bg-white py-2 pl-3 pr-9 text-sm font-semibold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            value={threadSearch}
            onChange={(event) => setThreadSearch(event.target.value)}
            placeholder="חיפוש שיחה…"
          />
        </label>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {loading ? (
            <p className="text-sm font-medium text-slate-500">טוען…</p>
          ) : filteredThreads.length === 0 ? (
            <div className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
              <p>אין שיחות מתאימות.</p>
              <Link className="mt-2 inline-block text-indigo-700 underline decoration-2 underline-offset-4" to="/home">
                מצא ילדים מחוברים
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
            <p className="text-lg font-black text-slate-900">בחרו שיחה</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              או חזרו ללוח כדי למצוא ילד מחובר.
            </p>
            <Button className="mt-4" asChild>
              <Link to="/home">ללוח המשחקים</Link>
            </Button>
          </div>
        ) : (
          <>
            <header className="mb-3 flex items-center gap-3 border-b border-slate-100 pb-3">
              {active.partner ? (
                <KidAvatar
                  profile={active.partner}
                  className="size-11 min-h-11 min-w-11 rounded-xl text-sm"
                />
              ) : null}
              <div className="min-w-0">
                <h3 className="truncate text-lg font-black text-slate-950">
                  {active.partner?.full_name ?? active.partnerId.slice(0, 8)}
                </h3>
                {active.partner ? (
                  <p className="text-xs font-semibold text-slate-500">
                    @{active.partner.username} · כיתה {active.partner.grade}
                  </p>
                ) : null}
              </div>
            </header>

            <ul className="flex min-h-0 flex-1 flex-col-reverse gap-2 overflow-y-auto pr-1 text-sm">
              {active.messages.map((message) => {
                const mine = message.from_kid_id === user?.id;
                return (
                  <li
                    key={message.id}
                    className={cn(
                      "max-w-[72%] rounded-2xl px-4 py-3",
                      mine
                        ? "mr-auto rounded-br-md bg-indigo-600 text-white shadow-sm"
                        : "ml-auto rounded-bl-md bg-slate-100 text-slate-900"
                    )}
                  >
                    <span className="block whitespace-pre-wrap break-words">
                      {message.content}
                    </span>
                    {!mine && active.partner ? (
                      reportDraft?.messageId === message.id ? (
                        <div className="mt-3 w-full space-y-2 rounded-xl border border-indigo-100 bg-white p-3 text-right text-slate-900 shadow-sm">
                          <textarea
                            className={cn(fieldInputClass, "min-h-[74px] resize-none text-sm")}
                            maxLength={REPORT_NOTE_MAX_LENGTH}
                            value={reportDraft.note}
                            onChange={(event) =>
                              setReportDraft({ ...reportDraft, note: event.target.value })
                            }
                            placeholder="מה קרה בהודעה הזאת?"
                          />
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-500">
                              {reportDraft.note.length}/{REPORT_NOTE_MAX_LENGTH}
                            </span>
                            <div className="flex gap-2">
                              <Button type="button" variant="ghost" size="sm" disabled={reportBusy} onClick={() => setReportDraft(null)}>
                                ביטול
                              </Button>
                              <Button type="button" size="sm" disabled={reportBusy} onClick={() => void onReport()}>
                                שלח דיווח
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="mt-2 block text-xs font-black text-indigo-700 underline decoration-2 underline-offset-2"
                          onClick={() =>
                            setReportDraft({
                              messageId: message.id,
                              messageContent: message.content,
                              note: ""
                            })
                          }
                        >
                          דווח לצוות
                        </button>
                      )
                    ) : null}
                  </li>
                );
              })}
            </ul>

            <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
              <input
                className={cn(fieldInputClass, "min-h-11 flex-1")}
                maxLength={300}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="כתוב הודעה…"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (!busy) void send();
                  }
                }}
              />
              <Button type="button" disabled={busy || !draft.trim()} onClick={() => void send()}>
                שלח
              </Button>
            </div>
          </>
        )}
      </section>

      <aside className={desktopPanelClass("hidden p-4 xl:block")}>
        <h2 className="text-base font-black text-slate-950">פרטי שיחה</h2>
        {active?.partner ? (
          <div className="mt-4 space-y-4">
            <KidAvatar
              profile={active.partner}
              className="size-24 min-h-24 min-w-24 rounded-2xl text-3xl"
            />
            <div>
              <p className="text-lg font-black text-slate-950">{active.partner.full_name}</p>
              <p className="text-sm font-semibold text-slate-500">
                @{active.partner.username}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                כיתה {active.partner.grade}
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link to={`/profile/${active.partner.id}`}>צפה בפרופיל</Link>
            </Button>
          </div>
        ) : (
          <p className="mt-4 text-sm font-semibold text-slate-500">
            בחרו שיחה כדי לראות פרטים.
          </p>
        )}
      </aside>
    </KidDesktopShell>
  );
}
