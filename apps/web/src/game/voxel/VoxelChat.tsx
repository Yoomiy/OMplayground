import { useEffect, useRef, useState } from "react";
import { VoxelApiError, admissionMessage } from "./session-api";
import type { VoxelApi, ChatPage } from "./session-api";
import { validChatText } from "../../../../../games/voxel/src/shared/chat.ts";
type Action =
  | { action: "send"; message: string }
  | { action: "delete" | "clear"; target: string | null };
type Notice = {
  id: string;
  action: Action;
  state: "pending" | "unconfirmed" | "done";
  text: string;
};
/** The owned dialog freezes local input; chat never steps or mutates the world. */
export function VoxelChat({
  api,
  isStaff,
  canSend,
  onOpen,
  onResume,
  active = true,
}: {
  api: VoxelApi;
  isStaff: boolean;
  canSend: boolean;
  onOpen: () => void;
  onResume?: () => void;
  active?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const loadedCursor = useRef<number | null>(null);
  const lines = useRef<HTMLOListElement>(null);
  const stickToBottom = useRef(true);
  const drag = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null),
    write = useRef<AbortController | null>(null),
    busy = useRef(false),
    alive = useRef(false);
  const [open, setOpen] = useState(false),
    [cursor, setCursor] = useState<number | null>(null),
    [page, setPage] = useState<ChatPage | null>(null),
    [draft, setDraft] = useState(""),
    [loading, setLoading] = useState(false),
    [readError, setReadError] = useState(false),
    [refresh, setRefresh] = useState(0),
    [notice, setNotice] = useState<Notice | null>(null),
    [confirm, setConfirm] = useState<Extract<
      Action,
      { target: unknown }
    > | null>(null);
  useEffect(() => {
    alive.current = true;
    setOpen(false);
    setDraft("");
    setNotice(null);
    setConfirm(null);
    setCursor(null);
    setPage(null);
    return () => {
      alive.current = false;
      write.current?.abort();
      busy.current = false;
      dialog.current?.close();
    };
  }, [api]);
  useEffect(() => {
    if (!active) return;
    const abort = new AbortController();
    let running = false;
    const requestedCursor = open ? cursor : null;
    if (loadedCursor.current !== requestedCursor) setPage(null);
    setReadError(false);
    const reload = async () => {
      if (
        running ||
        abort.signal.aborted ||
        document.visibilityState !== "visible"
      )
        return;
      running = true;
      setLoading(true);
      try {
        const value = await api.chatHistory(open ? cursor : null, abort.signal);
        if (!abort.signal.aborted) {
          loadedCursor.current = requestedCursor;
          setPage(value);
          setReadError(false);
        }
      } catch {
        if (!abort.signal.aborted) {
          setReadError(true);
        }
      } finally {
        running = false;
        if (!abort.signal.aborted) setLoading(false);
      }
    };
    void reload();
    const timer = setInterval(() => void reload(), open ? 3000 : 10000),
      visible = () => void reload();
    document.addEventListener("visibilitychange", visible);
    return () => {
      abort.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [api, active, open, cursor, refresh]);
  useEffect(() => {
    if (!open) return;
    stickToBottom.current = true;
    input.current?.focus();
  }, [open]);
  useEffect(() => {
    if (open && cursor === null && stickToBottom.current && lines.current)
      lines.current.scrollTop = lines.current.scrollHeight;
  }, [page, open, cursor]);
  const execute = async (action: Action, id: string = crypto.randomUUID()) => {
    if (busy.current) return;
    busy.current = true;
    const abort = new AbortController();
    write.current = abort;
    setConfirm(null);
    setNotice({
      id,
      action,
      state: "pending",
      text: action.action === "send" ? "שולחים…" : "מעדכנים…",
    });
    if (action.action === "send") setDraft("");
    try {
      if (action.action === "send")
        await api.sendChat(action.message, id, abort.signal);
      else
        await api.moderateChat(action.action, action.target, id, abort.signal);
      if (!abort.signal.aborted && alive.current) {
        setNotice(
          action.action === "send"
            ? null
            : {
                id,
                action,
                state: "done",
                text: "הצ׳אט עודכן.",
              },
        );
        setRefresh((v) => v + 1);
      }
    } catch (error) {
      if (!abort.signal.aborted && alive.current) {
        const retry = !(error instanceof VoxelApiError) || error.retryable;
        setNotice({
          id,
          action,
          state: retry ? "unconfirmed" : "done",
          text: retry
            ? "לא התקבל אישור. אפשר לבדוק שוב את אותה בקשת צ׳אט."
            : error instanceof VoxelApiError && error.code === "NOT_IN_ROOM"
              ? "אפשר לשלוח הודעה רק מתוך העולם."
              : admissionMessage(
                  error instanceof VoxelApiError ? error.code : "UNAVAILABLE",
                ),
        });
      }
    } finally {
      if (write.current === abort) {
        busy.current = false;
        write.current = null;
      }
    }
  };
  const locked = notice?.state === "pending" || notice?.state === "unconfirmed";
  const opening = useRef({ onOpen, open });
  opening.current = { onOpen, open };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const current = opening.current;
      if (
        !active ||
        event.repeat ||
        !["KeyT", "Enter", "NumpadEnter"].includes(event.code) ||
        current.open ||
        document.querySelector(".voxel-session dialog[open]") ||
        (event.target instanceof HTMLElement &&
          event.target.closest(
            'input, textarea, select, button, a, [contenteditable="true"]',
          ))
      )
        return;
      event.preventDefault();
      current.onOpen();
      setOpen(true);
      dialog.current?.show();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [active]);
  return (
    <>
      <button
        className="voxel-session__chat-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="voxel-chat-panel"
        onClick={() => {
          if (open) {
            dialog.current?.close();
            onResume?.();
            return;
          }
          if (!active) return;
          onOpen();
          setOpen(true);
          dialog.current?.show();
        }}
      >
        צ׳אט
      </button>
      <dialog
        ref={dialog}
        id="voxel-chat-panel"
        className="voxel-session__dialog voxel-session__chat"
        aria-labelledby="voxel-chat-title"
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") {
            event.preventDefault();
            dialog.current?.close();
            onResume?.();
          }
        }}
        onCancel={(event) => {
          event.preventDefault();
          dialog.current?.close();
          onResume?.();
        }}
        onClose={() => {
          setOpen(false);
          setConfirm(null);
        }}
      >
        <header
          onPointerDown={(event) => {
            if ((event.target as HTMLElement).closest("button")) return;
            const rect = dialog.current!.getBoundingClientRect();
            drag.current = {
              x: event.clientX,
              y: event.clientY,
              left: rect.left,
              top: rect.top,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const start = drag.current,
              panel = dialog.current;
            if (!start || !panel) return;
            panel.style.left = `${Math.max(8, Math.min(window.innerWidth - panel.offsetWidth - 8, start.left + event.clientX - start.x))}px`;
            panel.style.top = `${Math.max(8, Math.min(window.innerHeight - panel.offsetHeight - 8, start.top + event.clientY - start.y))}px`;
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          <h2 id="voxel-chat-title">צ׳אט המשחק</h2>
        </header>
        {readError && <p role="alert">לא ניתן לטעון את הצ׳אט כעת.</p>}
        {loading && !page && <p role="status">טוענים הודעות…</p>}
        <ol
          ref={lines}
          aria-label="הודעות במפגש"
          className="voxel-session__chat-lines"
          onScroll={() => {
            const list = lines.current!;
            stickToBottom.current =
              list.scrollHeight - list.clientHeight - list.scrollTop < 32;
          }}
        >
          {page?.messages.map((message) => (
            <li key={message.id}>
              <span>
                <bdi dir="auto">
                  <strong>{message.senderName}</strong>
                </bdi>
                : <bdi dir="auto">{message.message}</bdi>
              </span>
              {isStaff && (
                <button
                  type="button"
                  disabled={locked}
                  aria-label={`מחיקת הודעה ${message.sequence}`}
                  onClick={() =>
                    setConfirm({ action: "delete", target: message.id })
                  }
                >
                  מחיקה
                </button>
              )}
            </li>
          ))}
          {page && !page.messages.length && <li>אין הודעות להצגה.</li>}
        </ol>
        <nav aria-label="דפדוף בצ׳אט">
          {cursor !== null && (
            <button type="button" onClick={() => setCursor(null)}>
              הודעות אחרונות
            </button>
          )}
          {page?.before !== null && page?.before !== undefined && (
            <button type="button" onClick={() => setCursor(page.before)}>
              הודעות קודמות
            </button>
          )}
          {isStaff && (
            <button
              type="button"
              disabled={locked || !page?.messages.length}
              onClick={() => setConfirm({ action: "clear", target: null })}
            >
              ניקוי הצ׳אט
            </button>
          )}
        </nav>
        {confirm && (
          <section aria-label="אישור שינוי הצ׳אט">
            <p>
              {confirm.action === "clear"
                ? "למחוק את כל הודעות המפגש?"
                : "למחוק את ההודעה מהצ׳אט?"}
            </p>
            <button
              type="button"
              disabled={locked}
              onClick={() => void execute(confirm)}
            >
              אישור שינוי הצ׳אט
            </button>
            <button type="button" onClick={() => setConfirm(null)}>
              ביטול
            </button>
          </section>
        )}
        {notice && (
          <div>
            <p role="status">{notice.text}</p>
            {notice.state === "unconfirmed" && (
              <button
                type="button"
                onClick={() => void execute(notice.action, notice.id)}
              >
                בדיקת בקשת הצ׳אט
              </button>
            )}
            {notice.state === "done" && (
              <button type="button" onClick={() => setNotice(null)}>
                סגירת ההתראה
              </button>
            )}
          </div>
        )}
        {canSend ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (validChatText(draft) && !locked)
                void execute({ action: "send", message: draft.trim() });
            }}
          >
            <label className="voxel-session__chat-compose">
              <input
                ref={input}
                placeholder="כתבו הודעה…"
                autoComplete="off"
                aria-label="הודעה למפגש"
                maxLength={1000}
                value={draft}
                disabled={locked}
                onChange={(event) =>
                  setDraft(
                    Array.from(event.target.value).slice(0, 500).join(""),
                  )
                }
              />
            </label>
            <button type="submit" disabled={locked || !validChatText(draft)}>
              שליחה
            </button>
          </form>
        ) : (
          <p>צפייה בלבד</p>
        )}
      </dialog>
      {!open && active && page && page.messages.length > 0 && (
        <div className="voxel-session__chat-peek" aria-label="הודעות אחרונות">
          {page.messages.slice(-4).map((message) => (
            <p key={message.id}>
              <strong>{message.senderName}:</strong>{" "}
              <bdi dir="auto">{message.message}</bdi>
            </p>
          ))}
        </div>
      )}
    </>
  );
}
