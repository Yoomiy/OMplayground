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
}: {
  api: VoxelApi;
  isStaff: boolean;
  canSend: boolean;
  onOpen: () => void;
}) {
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
    if (!open) {
      setPage(null);
      return;
    }
    const abort = new AbortController();
    let running = false;
    setPage(null);
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
        const value = await api.chatHistory(cursor, abort.signal);
        if (!abort.signal.aborted) {
          setPage(value);
          setReadError(false);
        }
      } catch {
        if (!abort.signal.aborted) {
          setPage(null);
          setReadError(true);
        }
      } finally {
        running = false;
        if (!abort.signal.aborted) setLoading(false);
      }
    };
    void reload();
    const timer = setInterval(() => void reload(), 3000),
      visible = () => void reload();
    document.addEventListener("visibilitychange", visible);
    return () => {
      abort.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [api, open, cursor, refresh]);
  const execute = async (action: Action, id: string = crypto.randomUUID()) => {
    if (busy.current) return;
    busy.current = true;
    const abort = new AbortController();
    write.current = abort;
    setConfirm(null);
    setNotice({ id, action, state: "pending", text: "ממתינים לאישור הצ׳אט…" });
    if (action.action === "send") setDraft("");
    try {
      if (action.action === "send")
        await api.sendChat(action.message, id, abort.signal);
      else
        await api.moderateChat(action.action, action.target, id, abort.signal);
      if (!abort.signal.aborted && alive.current) {
        setNotice({
          id,
          action,
          state: "done",
          text: action.action === "send" ? "ההודעה נשמרה." : "הצ׳אט עודכן.",
        });
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
  return (
    <>
      <button
        type="button"
        onClick={() => {
          onOpen();
          setOpen(true);
          dialog.current?.showModal();
        }}
      >
        צ׳אט
      </button>
      <dialog
        ref={dialog}
        className="voxel-session__dialog voxel-session__chat"
        aria-labelledby="voxel-chat-title"
        onClose={() => {
          setOpen(false);
          setConfirm(null);
        }}
      >
        <header>
          <h2 id="voxel-chat-title">צ׳אט במפגש</h2>
          <button type="button" onClick={() => dialog.current?.close()}>
            סגירת הצ׳אט
          </button>
        </header>
        {readError && <p role="alert">לא ניתן לטעון את הצ׳אט כעת.</p>}
        {loading && !page && <p role="status">טוענים הודעות…</p>}
        <ol aria-label="הודעות במפגש" className="voxel-session__chat-lines">
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
            <label>
              הודעה למפגש
              <textarea
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
              שליחת הודעה
            </button>
          </form>
        ) : (
          <p>הצ׳אט לקריאה בלבד. שליחה זמינה למשתתפים המחוברים לעולם.</p>
        )}
      </dialog>
    </>
  );
}
