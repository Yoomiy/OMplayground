import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { desktopPanelClass } from "@/components/KidDesktopShell";
import { useTeacherSessionChat } from "@/hooks/useTeacherSessionChat";
import { ChatDeliveryError, type DeliverChatMessage } from "@/hooks/useChatOutbox";
import { ChatDeliveryStatus } from "./ChatDeliveryStatus";

type SessionChatProps = {
  sessionId: string;
  observer: boolean;
  canModerate: boolean;
  ended: boolean;
  send: DeliverChatMessage;
  title?: string;
  active?: boolean;
};

export function SessionChatPanel(props: SessionChatProps) {
  const [draft, setDraft] = useState("");
  useEffect(() => setDraft(""), [props.sessionId]);
  return (
    <ErrorBoundary
      scope="room-chat"
      compact
      title="הצ׳אט בחדר אינו זמין כרגע"
      resetKey={props.sessionId}
    >
      <SessionChatContent {...props} draft={draft} setDraft={setDraft} />
    </ErrorBoundary>
  );
}

function SessionChatContent({
  sessionId,
  observer,
  canModerate,
  ended,
  send,
  title = "צ׳אט במשחק",
  active = true,
  draft,
  setDraft,
}: SessionChatProps & { draft: string; setDraft: (value: string) => void }) {
  const chat = useTeacherSessionChat(active ? sessionId : undefined);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const stickToBottom = useRef(true);
  useEffect(() => {
    stickToBottom.current = true;
  }, [sessionId]);
  useEffect(() => {
    if (stickToBottom.current && list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [chat.lines]);
  const [error, setError] = useState<string | null>(null);
  const report = (error: unknown) =>
    setError(error instanceof Error ? error.message : "הפעולה נכשלה");
  const sendMessage = async (message: string, id?: string) => {
    if (!active || observer || ended) return;
    stickToBottom.current = true;
    await chat.outbox.send(
      message,
      async (text, requestId, signal) => {
        try {
          await send(text, requestId, signal);
        } catch (error) {
          throw error instanceof ChatDeliveryError
            ? error
            : new ChatDeliveryError("לא התקבל אישור לשליחת ההודעה.", true);
        }
      },
      id,
    );
    await chat.reload();
  };
  const submit = async () => {
    const message = draft.trim();
    if (!message || !active || observer || ended) return;
    setDraft("");
    setError(null);
    await sendMessage(message);
  };
  return (
    <section
      className={desktopPanelClass("space-y-3 p-3 text-sm", {
        backdropBlur: false,
      })}
      aria-label="צ׳אט במשחק"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-black">{title}</h2>
        {canModerate && (
          <Button
            variant="destructive"
            size="sm"
            className="dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
            onClick={() => {
              if (window.confirm("למחוק את כל ההודעות במפגש זה?"))
                void chat.clearSession().catch(report);
            }}
          >
            ניקוי צ׳אט
          </Button>
        )}
      </div>
      {(error || chat.error) && (
        <p role="alert" className="text-xs text-amber-700 dark:text-amber-300">
          {error ?? chat.error}
        </p>
      )}
      <ul
        ref={list}
        onScroll={() => {
          if (list.current)
            stickToBottom.current =
              list.current.scrollHeight - list.current.clientHeight - list.current.scrollTop < 32;
        }}
        className="max-h-56 space-y-2 overflow-auto break-words"
        aria-label="הודעות"
      >
        {chat.lines.map((line) => (
          <li
            key={line.id}
            data-delivery={line.outgoing?.state}
            className="flex items-start gap-2 border-b border-slate-200 pb-1 dark:border-white/10"
          >
            <span className="min-w-0 flex-1">
              <bdi className="font-bold">{line.sender_name}</bdi>:{" "}
              <bdi dir="auto">{line.message}</bdi>
            </span>
            {line.outgoing && (
              <ChatDeliveryStatus
                message={line.outgoing}
                disabled={!active || observer || ended}
                retry={() => void sendMessage(line.message, line.id)}
                edit={() => {
                  setDraft(line.message);
                  chat.outbox.remove(line.id);
                  input.current?.focus();
                }}
              />
            )}
            {canModerate && !line.is_system && !line.outgoing && (
              <button
                type="button"
                className="text-xs text-rose-700 underline dark:text-rose-300"
                onClick={() => void chat.softDelete(line.id).catch(report)}
              >
                מחק
              </button>
            )}
          </li>
        ))}
        {!chat.lines.length && (
          <li className="text-slate-500 dark:text-white/50">עדיין אין הודעות.</li>
        )}
      </ul>
      {active && !observer && !ended && (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <input
            ref={input}
            aria-label="הודעה לחדר"
            value={draft}
            maxLength={500}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="כתבו הודעה…"
            className="min-h-10 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
          <Button
            type="submit"
            size="sm"
            className="h-10 bg-gradient-to-r from-violet-500 to-indigo-500"
            disabled={!draft.trim()}
          >
            שלח
          </Button>
        </form>
      )}
    </section>
  );
}
