import { useCallback, useEffect, useRef, useState } from "react";
import type {
  VoxelApi,
  ModerationAction,
  ModerationTarget,
} from "./session-api";
import { VoxelApiError, admissionMessage } from "./session-api";
type Draft = Readonly<{ action: ModerationAction; target: ModerationTarget }>;
type Notice = Readonly<{
  id: string;
  draft: Draft;
  state: "pending" | "unconfirmed" | "done";
  text: string;
}>;
export function VoxelModeration(props: {
  api: VoxelApi;
  busy: boolean;
  acquire: () => null | (() => void);
  onPause: () => void;
  onFailure: (code: string) => void;
}) {
  const { api, acquire } = props;
  const dialog = useRef<HTMLDialogElement>(null),
    mounted = useRef(false);
  const readAbort = useRef<AbortController | null>(null),
    writeAbort = useRef<AbortController | null>(null),
    release = useRef<null | (() => void)>(null);
  const [targets, setTargets] = useState<readonly ModerationTarget[]>([]),
    [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false),
    [readError, setReadError] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null),
    [notice, setNotice] = useState<Notice | null>(null);
  useEffect(() => {
    mounted.current = true;
    setTargets([]);
    setSelected("");
    setNotice(null);
    setDraft(null);
    setReadError(false);
    setLoading(false);
    return () => {
      mounted.current = false;
      dialog.current?.close();
      readAbort.current?.abort();
      writeAbort.current?.abort();
      release.current?.();
      release.current = null;
    };
  }, [api]);
  const refresh = useCallback(async () => {
    readAbort.current?.abort();
    const abort = new AbortController();
    readAbort.current = abort;
    setLoading(true);
    setReadError(false);
    try {
      const rows = await api.moderationTargets(abort.signal);
      if (abort.signal.aborted || !mounted.current) return;
      setTargets(rows);
      setSelected((current) =>
        rows.some((row) => row.id === current) ? current : (rows[0]?.id ?? ""),
      );
    } catch (error) {
      if (!abort.signal.aborted && mounted.current) {
        setReadError(true);
        props.onFailure(
          error instanceof VoxelApiError ? error.code : "UNAVAILABLE",
        );
      }
    } finally {
      if (!abort.signal.aborted && mounted.current) setLoading(false);
    }
  }, [api, props.onFailure]);
  const execute = async (value: Draft, retryId?: string) => {
    const unlock = acquire();
    if (!unlock) return;
    release.current = unlock;
    const id = retryId ?? crypto.randomUUID(),
      abort = new AbortController();
    writeAbort.current?.abort();
    writeAbort.current = abort;
    setNotice({
      id,
      draft: value,
      state: "pending",
      text: "ממתינים לאישור עדכון הגישה…",
    });
    try {
      const result = await api.moderate(
        value.action,
        value.target.id,
        id,
        abort.signal,
      );
      if (abort.signal.aborted || !mounted.current) return;
      setNotice({
        id,
        draft: value,
        state: "done",
        text: !result.current
          ? "זו תוצאה של בקשה קודמת. בדקו את המצב הנוכחי ברשימה."
          : value.action === "ban"
            ? "הכניסה לעולם נחסמה. חיבורים קודמים נשלחו לניתוק."
            : value.action === "unban"
              ? "הגישה אינה חסומה. אפשר להיכנס לעולם."
              : "נשלחה בקשת ניתוק. אפשר להצטרף שוב בכניסה חדשה.",
      });
      void refresh();
    } catch (error) {
      if (abort.signal.aborted || !mounted.current) return;
      const code = error instanceof VoxelApiError ? error.code : "UNAVAILABLE",
        retry = !(error instanceof VoxelApiError) || error.retryable;
      setNotice({
        id,
        draft: value,
        state: retry ? "unconfirmed" : "done",
        text: retry
          ? "לא התקבל אישור לעדכון הגישה. אפשר לבדוק שוב את אותה בקשה."
          : admissionMessage(code),
      });
      props.onFailure(code);
    } finally {
      unlock();
      if (release.current === unlock) release.current = null;
    }
  };
  const target = targets.find((row) => row.id === selected);
  const choose = (action: ModerationAction) => {
    if (!target || props.busy) return;
    props.onPause();
    setDraft({ action, target });
    dialog.current?.showModal();
  };
  return (
    <details
      className="voxel-session__moderation"
      onToggle={(event) => {
        if (event.currentTarget.open) void refresh();
      }}
    >
      <summary>ניהול משתתפים</summary>
      <div className="voxel-session__moderation-controls">
        <button
          type="button"
          disabled={loading || props.busy}
          onClick={() => void refresh()}
        >
          רענון משתתפים
        </button>
        <label>
          משתתף או משתתפת לניהול
          <select
            aria-label="משתתף או משתתפת לניהול"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            disabled={loading || props.busy}
          >
            {!targets.length && (
              <option value="">
                {loading ? "טוענים…" : "אין משתתפים ברשימה"}
              </option>
            )}
            {targets.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
                {row.banned
                  ? " — חסום/ה"
                  : row.pendingReadmission
                    ? " — נדרשת כניסה חדשה"
                    : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={props.busy || !target || target.banned || loading}
          onClick={() => choose("remove")}
        >
          הוצאה מהעולם
        </button>
        <button
          type="button"
          disabled={props.busy || !target || target.banned || loading}
          onClick={() => choose("ban")}
        >
          חסימת כניסה
        </button>
        <button
          type="button"
          disabled={props.busy || !target?.banned || loading}
          onClick={() => choose("unban")}
        >
          ביטול חסימה
        </button>
      </div>
      {readError && (
        <p role="status">לא ניתן לטעון את הרשימה כרגע. נסו לרענן.</p>
      )}
      {notice && (
        <aside
          className={`voxel-session__moderation-notice voxel-session__save--${notice.state}`}
          role="status"
        >
          <p>{notice.text}</p>
          {notice.state === "unconfirmed" && (
            <button
              type="button"
              disabled={props.busy}
              onClick={() => void execute(notice.draft, notice.id)}
            >
              בדיקת בקשת הגישה
            </button>
          )}
        </aside>
      )}
      <dialog
        ref={dialog}
        className="voxel-session__confirm"
        aria-labelledby="voxel-moderation-title"
      >
        <h2 id="voxel-moderation-title">
          {draft?.action === "ban"
            ? "לחסום כניסה לעולם?"
            : draft?.action === "unban"
              ? "לבטל את החסימה?"
              : "להוציא מהעולם?"}
        </h2>
        <p>{draft?.target.name}</p>
        <p>
          {draft?.action === "ban"
            ? "כניסה חדשה תיחסם עד שאיש צוות יבטל את החסימה."
            : draft?.action === "unban"
              ? "לאחר הביטול אפשר להצטרף שוב בכניסה חדשה."
              : "החיבור הנוכחי ינותק. כניסה חדשה עדיין תהיה אפשרית."}
        </p>
        <button type="button" onClick={() => dialog.current?.close()}>
          ביטול
        </button>
        <button
          type="button"
          disabled={props.busy}
          onClick={() => {
            dialog.current?.close();
            if (draft) void execute(draft);
          }}
        >
          אישור עדכון הגישה
        </button>
      </dialog>
    </details>
  );
}
