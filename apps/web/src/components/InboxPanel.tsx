import { useEffect, useRef, useState } from "react";
import { useInbox } from "@/hooks/useInbox";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { roleLabel, type Message } from "@/lib/directMessages";
import { reportMessage } from "@/lib/messagesApi";
import { ErrorBoundary } from "./ErrorBoundary";

export function InboxPanel() {
  const { active } = useInbox();
  return (
    <ErrorBoundary
      scope="inbox-panel"
      compact
      title="לא ניתן להציג את השיחה כרגע"
      resetKey={active ?? "threads"}
    >
      <InboxContent />
    </ErrorBoundary>
  );
}

function InboxContent() {
  const inbox = useInbox(),
    { user } = useAuth(),
    { profile } = useProfile();
  const list = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [report, setReport] = useState<Message | null>(null),
    [note, setNote] = useState(""),
    [feedback, setFeedback] = useState("");
  useEffect(() => {
    setReport(null);
    setNote("");
    setFeedback("");
  }, [inbox.active]);
  useEffect(() => {
    const root = list.current;
    if (!root || !user) return;
    const visible = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      if (!document.hidden && visible.size) {
        const ids = [...visible];
        visible.clear();
        void inbox.markRead(ids);
      }
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.messageId!;
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        clearTimeout(timer);
        timer = setTimeout(flush, 200);
      },
      { root, threshold: 0.8 },
    );
    root.querySelectorAll("[data-message-id]").forEach((node) => observer.observe(node));
    document.addEventListener("visibilitychange", flush);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", flush);
    };
  }, [inbox.messages, user?.id, inbox.markRead]);
  async function submitReport() {
    if (!report || !user || !profile || !inbox.partner) return;
    try {
      await reportMessage({
        reporterKidId: user.id,
        reporterKidName: profile.full_name,
        reportedKidId: inbox.partner.id,
        reportedKidName: inbox.partner.full_name,
        messageContent: report.content,
        note,
      });
      setReport(null);
      setNote("");
      setFeedback("הדיווח נשלח");
    } catch {
      setFeedback("לא ניתן לשלוח דיווח כרגע");
    }
  }
  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 p-3 text-slate-900 dark:text-white"
      dir="rtl"
    >
      {inbox.connection !== "live" && (
        <p role="status" className="text-sm">
          {inbox.connection === "connecting"
            ? "מתחברים להודעות…"
            : "החיבור מתחדש; ההודעות מתרעננות אוטומטית"}
        </p>
      )}
      {(inbox.error || feedback) && (
        <div role="alert">
          <p>{inbox.error || feedback}</p>
          {inbox.error && (
            <button
              type="button"
              disabled={inbox.loading}
              onClick={() => void inbox.refetch()}
              className="mt-2 rounded-lg border px-3 py-2 text-sm font-bold"
            >
              נסו שוב
            </button>
          )}
        </div>
      )}
      <div className="grid min-h-0 flex-1 gap-3 sm:grid-cols-[190px_1fr]">
        <aside className={`${inbox.active ? "hidden sm:flex" : "flex"} min-h-0 flex-col gap-2`}>
          <input
            aria-label="חיפוש שיחות"
            placeholder="חיפוש שיחות"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="rounded-lg border bg-transparent p-2"
          />
          <div className="min-h-0 overflow-auto">
            {inbox.threads
              .filter((t) => t.partner.full_name.includes(query))
              .map((t) => (
                <button
                  key={t.partnerId}
                  onClick={() => inbox.select(t.partnerId, false)}
                  className={`mb-2 block w-full rounded-xl border p-3 text-right ${inbox.active === t.partnerId ? "bg-violet-100 dark:bg-violet-900" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <b className="block truncate">{t.partner.full_name}</b>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {roleLabel(t.partner.role)}
                      </span>
                    </div>
                    {t.unreadCount > 0 && (
                      <span
                        aria-label={`${t.unreadCount} הודעות שלא נקראו`}
                        dir="ltr"
                        className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 px-1.5 text-[11px] font-bold leading-none text-white tabular-nums"
                      >
                        {t.unreadCount > 99 ? "99+" : t.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className={`mt-1 truncate text-xs ${t.unreadCount > 0 ? "font-semibold text-slate-900 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"}`}>
                    {t.lastMessage.content}
                  </p>
                </button>
              ))}
            {inbox.hasThreads && (
              <button disabled={inbox.loading} onClick={() => void inbox.loadThreads()}>
                שיחות נוספות
              </button>
            )}
            {!inbox.threads.length && <p>אפשר להתחיל שיחה מפרופיל או מרשימת המשתמשים</p>}
          </div>
        </aside>
        <section
          className={`${inbox.active ? "flex" : "hidden sm:flex"} min-h-0 flex-col gap-2`}
          aria-label="שיחה"
        >
          {!inbox.active ? (
            <p>בחרו שיחה</p>
          ) : (
            <>
              <header className="flex items-center gap-3">
                <button className="sm:hidden" onClick={() => inbox.select("", false)}>
                  חזרה
                </button>
                <b>{inbox.partner?.full_name ?? "טוענים שיחה…"}</b>
                <span>{roleLabel(inbox.partner?.role)}</span>
              </header>
              <div
                ref={list}
                className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto rounded-lg border p-2"
                aria-label="הודעות בשיחה"
              >
                {inbox.hasHistory && (
                  <button onClick={() => void inbox.loadHistory()}>הודעות קודמות</button>
                )}
                {[...inbox.messages].reverse().map((m) => (
                  <article
                    key={m.id}
                    {...(!m.is_read && m.to_kid_id === user?.id ? { "data-message-id": m.id } : {})}
                    className={`max-w-[90%] rounded-xl p-3 ${m.from_kid_id === user?.id ? "mr-auto bg-violet-100 dark:bg-violet-900" : "ml-auto bg-slate-100 dark:bg-slate-800"}`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    <time className="text-xs" dateTime={m.created_at}>
                      {new Date(m.created_at).toLocaleTimeString("he-IL", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                    {profile && m.from_kid_id && m.from_kid_id !== user?.id && (
                      <button
                        className="mr-3 text-xs underline"
                        onClick={() => {
                          setReport(m);
                          setNote("");
                        }}
                      >
                        דיווח
                      </button>
                    )}
                  </article>
                ))}
                {!inbox.messages.length && inbox.partner && (
                  <p>התחילו את השיחה עם {inbox.partner.full_name}</p>
                )}
              </div>
              {report && (
                <div>
                  <label>
                    פרטי דיווח
                    <textarea
                      value={note}
                      maxLength={500}
                      onChange={(e) => setNote(e.target.value)}
                      className="w-full rounded border bg-transparent"
                    />
                  </label>
                  <button onClick={() => void submitReport()}>שליחת דיווח</button>{" "}
                  <button onClick={() => setReport(null)}>ביטול</button>
                </div>
              )}
              {inbox.partner?.can_send ? (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void inbox.send();
                  }}
                >
                  <textarea
                    aria-label="כתיבת הודעה"
                    placeholder="כתבו הודעה…"
                    maxLength={300}
                    value={inbox.drafts[inbox.active] ?? ""}
                    onChange={(e) => inbox.setDraft(e.target.value)}
                    className="min-h-16 min-w-0 flex-1 resize-none rounded-lg border bg-transparent p-2"
                  />
                  <button
                    disabled={
                      inbox.sending[inbox.active] || !(inbox.drafts[inbox.active] ?? "").trim()
                    }
                    className="rounded-lg bg-violet-600 px-3 text-white disabled:opacity-50"
                  >
                    {inbox.sending[inbox.active] ? "שולחים…" : "שליחה"}
                  </button>
                </form>
              ) : (
                inbox.partner && <p>השיחה זמינה לקריאה בלבד</p>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
