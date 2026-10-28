import { useEffect, useRef, useState } from "react";
import type { VoiceScene } from "@playground/voxel-runtime";
import { VoiceSession } from "./voice-session";
import type { VoiceState } from "./voice-session";
import { VoxelApiError, admissionMessage } from "./session-api";
import type { VoxelApi, MediaAction, MediaState } from "./session-api";
type Draft = Readonly<{
  action: MediaAction;
  target: string | null;
  name: string;
}>;
type Notice = {
  id: string;
  draft: Draft;
  state: "pending" | "unconfirmed" | "done";
  text: string;
};
const phases: Record<VoiceState["phase"], string> = {
  off: "השמע כבוי.",
  starting: "מתחברים לשמע…",
  connected: "מחוברים לשמע בקרבתכם.",
  reconnecting: "מתחברים מחדש. המיקרופון כבוי.",
  unavailable: "חיבור השמע אינו זמין כרגע. ננסה שוב.",
  blocked: "אין כרגע הרשאה לחיבור שמע.",
};
/** Owns user activation and staff UI; spatial sampling stays in VoiceSession. */
export function VoxelVoice(props: {
  api: VoxelApi;
  isStaff: boolean;
  ready: boolean;
  ended?: boolean;
  scene: () => VoiceScene | null;
  onOpen: () => void;
}) {
  const { api, isStaff, ready } = props,
    latest = useRef(props);
  latest.current = props;
  const host = useRef<HTMLDivElement>(null),
    dialog = useRef<HTMLDialogElement>(null),
    owner = useRef<VoiceSession | null>(null);
  const write = useRef<AbortController | null>(null),
    busy = useRef(false);
  const [state, setState] = useState<VoiceState | null>(null),
    [open, setOpen] = useState(false),
    [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [sink, setSink] = useState(""),
    [sinkError, setSinkError] = useState(false);
  const [policy, setPolicy] = useState<MediaState | null>(null),
    [readError, setReadError] = useState(false),
    [selected, setSelected] = useState(""),
    [refresh, setRefresh] = useState(0),
    [draft, setDraft] = useState<Draft | null>(null),
    [notice, setNotice] = useState<Notice | null>(null);
  useEffect(() => {
    if (!host.current) return;
    let alive = true;
    const voice = new VoiceSession({
      api,
      host: host.current,
      scene: () => latest.current.scene(),
      onState: (value) => {
        if (alive) setState(value);
      },
    });
    owner.current = voice;
    setState(voice.state);
    setOpen(false);
    setNotice(null);
    setPolicy(null);
    setDraft(null);
    setSelected("");
    setSink("");
    setSinkError(false);
    return () => {
      alive = false;
      write.current?.abort();
      busy.current = false;
      dialog.current?.close();
      if (owner.current === voice) owner.current = null;
      void voice.close();
    };
  }, [api]);
  useEffect(() => {
    if (props.ended) owner.current?.stop();
    else if (!ready) void owner.current?.microphone(false);
  }, [ready, api, props.ended]);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const update = async () => {
      try {
        const rows = await navigator.mediaDevices?.enumerateDevices();
        if (alive)
          setDevices(rows?.filter((d) => d.kind === "audiooutput") ?? []);
      } catch {
        if (alive) setDevices([]);
      }
    };
    void update();
    navigator.mediaDevices?.addEventListener("devicechange", update);
    return () => {
      alive = false;
      navigator.mediaDevices?.removeEventListener("devicechange", update);
    };
  }, [open, state?.microphone]);
  useEffect(() => {
    if (!open || !isStaff) return;
    const abort = new AbortController();
    let running = false;
    setReadError(false);
    const load = async () => {
      if (
        running ||
        abort.signal.aborted ||
        document.visibilityState !== "visible"
      )
        return;
      running = true;
      try {
        const value = await api.mediaState(abort.signal);
        if (!abort.signal.aborted) {
          setPolicy(value);
          setReadError(false);
          setSelected((previous) =>
            value.targets.some((t) => t.id === previous)
              ? previous
              : (value.targets[0]?.id ?? ""),
          );
        }
      } catch {
        if (!abort.signal.aborted) {
          setPolicy(null);
          setReadError(true);
        }
      } finally {
        running = false;
      }
    };
    void load();
    const timer = setInterval(() => void load(), 3000),
      visible = () => void load();
    document.addEventListener("visibilitychange", visible);
    return () => {
      abort.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [api, open, isStaff, refresh]);
  const execute = async (value: Draft, id: string = crypto.randomUUID()) => {
    if (busy.current) return;
    busy.current = true;
    const abort = new AbortController();
    write.current = abort;
    setDraft(null);
    setNotice({
      id,
      draft: value,
      state: "pending",
      text: "ממתינים לאישור מדיניות השמע…",
    });
    try {
      const receipt = await api.moderateMedia(
        value.action,
        value.target,
        id,
        abort.signal,
      );
      if (!abort.signal.aborted) {
        setNotice({
          id,
          draft: value,
          state: "done",
          text: receipt.current
            ? "מדיניות השמע נשמרה. נשלחה בקשה לעדכון החיבורים."
            : "זו תוצאה של בקשה קודמת. בדקו את המצב הנוכחי.",
        });
        setRefresh((v) => v + 1);
      }
    } catch (error) {
      if (!abort.signal.aborted) {
        const retry = !(error instanceof VoxelApiError) || error.retryable;
        setNotice({
          id,
          draft: value,
          state: retry ? "unconfirmed" : "done",
          text: retry
            ? "לא התקבל אישור. אפשר לבדוק שוב את אותה בקשה."
            : admissionMessage(error.code),
        });
      }
    } finally {
      if (write.current === abort) {
        busy.current = false;
        write.current = null;
      }
    }
  };
  const choose = async (id: string) => {
    const voice = owner.current;
    try {
      await voice?.selectOutput(id);
      if (voice === owner.current) {
        setSink(id);
        setSinkError(false);
      }
    } catch {
      if (voice === owner.current) setSinkError(true);
    }
  };
  const promptOutput = async () => {
    const media = navigator.mediaDevices as MediaDevices & {
      selectAudioOutput?: () => Promise<MediaDeviceInfo>;
    };
    const voice = owner.current;
    try {
      const device = await media.selectAudioOutput?.();
      if (device && owner.current === voice) await choose(device.deviceId);
    } catch {
      if (owner.current === voice) setSinkError(true);
    }
  };
  const pending =
      notice?.state === "pending" || notice?.state === "unconfirmed",
    target = policy?.targets.find((t) => t.id === selected),
    connected = state?.phase === "connected";
  return (
    <div className="voxel-session__voice" ref={host}>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          props.onOpen();
          setOpen(true);
          dialog.current?.showModal();
        }}
      >
        שיחה קולית{state?.microphone === "on" ? " · מיקרופון פעיל" : ""}
      </button>
      <dialog
        ref={dialog}
        className="voxel-session__dialog voxel-session__voice-dialog"
        aria-labelledby="voxel-voice-title"
        onClose={() => {
          setOpen(false);
          setDraft(null);
        }}
      >
        <header>
          <h2 id="voxel-voice-title">שיחה קולית</h2>
          <button type="button" onClick={() => dialog.current?.close()}>
            סגירת שיחה קולית
          </button>
        </header>
        <p role="status">{phases[state?.phase ?? "off"]}</p>
        <nav aria-label="השמעה ומיקרופון">
          <button
            type="button"
            disabled={!ready}
            onClick={() => void owner.current?.start()}
          >
            {state?.audioLocked
              ? "הפעלת שמע"
              : connected
                ? "הפעלת שמע מחדש"
                : "הצטרפות לשמע"}
          </button>
          <button
            type="button"
            disabled={!state || state.phase === "off"}
            onClick={() => owner.current?.stop()}
          >
            כיבוי השיחה
          </button>
          <button
            type="button"
            aria-pressed={state?.microphone === "on"}
            disabled={
              !ready ||
              !connected ||
              !state?.publishAllowed ||
              state.capturePending
            }
            onClick={() =>
              void owner.current?.microphone(state?.microphone !== "on")
            }
          >
            {state?.microphone === "on" ? "כיבוי מיקרופון" : "הפעלת מיקרופון"}
          </button>
          <button
            type="button"
            aria-pressed={state?.outputMuted ?? false}
            disabled={!connected}
            onClick={() => owner.current?.muteOutput(!state?.outputMuted)}
          >
            {state?.outputMuted ? "ביטול השתקת ההשמעה" : "השתקת ההשמעה"}
          </button>
        </nav>
        {connected && !state?.publishAllowed && (
          <p>
            {state?.hidden
              ? "במצב צפייה אפשר להאזין בלבד."
              : "המיקרופון מושתק לפי מדיניות המפגש."}
          </p>
        )}
        {state?.microphone === "asking" && (
          <p>ממתינים להרשאת מיקרופון בדפדפן…</p>
        )}
        {state?.microphone === "denied" && (
          <p>
            לא ניתנה הרשאת מיקרופון. אפשר לשנות אותה בהגדרות הדפדפן ולנסות שוב.
          </p>
        )}
        {state?.microphone === "unavailable" && (
          <p>המיקרופון אינו זמין. בדקו את המכשיר ונסו שוב.</p>
        )}
        <p>
          המיקרופון מופעל רק לפי בקשתכם ונכבה בניתוק או במעבר לרקע. אחרי חיבור
          מחדש מפעילים אותו שוב.
        </p>
        <label>
          יציאת שמע{" "}
          <select
            aria-label="יציאת שמע"
            value={sink}
            disabled={!state?.outputSelection}
            onChange={(e) => void choose(e.target.value)}
          >
            <option value="">ברירת המחדל של המכשיר</option>
            {devices
              .filter((d) => d.deviceId && d.deviceId !== "default")
              .map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `יציאת שמע ${i + 1}`}
                </option>
              ))}
          </select>
        </label>
        {typeof (
          navigator.mediaDevices as
            | (MediaDevices & { selectAudioOutput?: unknown })
            | undefined
        )?.selectAudioOutput === "function" && (
          <button
            type="button"
            disabled={!state?.outputSelection}
            onClick={() => void promptOutput()}
          >
            בחירת התקן שמע
          </button>
        )}
        {!state?.outputSelection && (
          <p>בחירת יציאה זמינה לפי תמיכת הדפדפן, אחרי הפעלת השמע.</p>
        )}
        {sinkError && (
          <p role="status">
            לא ניתן לשנות את יציאת השמע. בדקו הרשאה או בחרו התקן אחר.
          </p>
        )}
        {isStaff && (
          <section aria-label="ניהול שמע לתלמידים">
            <h3>ניהול שמע לתלמידים</h3>
            {readError && (
              <p role="status">לא ניתן לקרוא כרגע את מדיניות השמע.</p>
            )}
            {!policy && !readError && <p>טוענים את מדיניות השמע…</p>}
            {policy && (
              <>
                <p>
                  כל התלמידים:{" "}
                  {policy.allMuted
                    ? "מושתקים"
                    : "רשאים לדבר לפי ההגדרות האישיות"}
                </p>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    setDraft({
                      action: policy.allMuted ? "unmute" : "mute",
                      target: null,
                      name: "כל התלמידים",
                    })
                  }
                >
                  {policy.allMuted ? "ביטול השתקה כללית" : "השתקת כל התלמידים"}
                </button>
                <label>
                  תלמיד או תלמידה{" "}
                  <select
                    value={selected}
                    disabled={pending || policy.targets.length === 0}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    {policy.targets.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {t.effectiveMuted ? " · מושתק/ת" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={pending || !target}
                  onClick={() =>
                    target &&
                    setDraft({
                      action: target.muted ? "unmute" : "mute",
                      target: target.id,
                      name: target.name,
                    })
                  }
                >
                  {target?.muted ? "ביטול השתקה אישית" : "השתקה אישית"}
                </button>
                <p>
                  ביטול השתקה כללית משאיר השתקות אישיות בתוקף. השתקת תלמידים
                  אינה חוסמת את אנשי הצוות.
                </p>
              </>
            )}
            {draft && (
              <section aria-label="אישור מדיניות שמע">
                <p>
                  {draft.action === "mute" ? "להשתיק" : "לבטל השתקה עבור"}{" "}
                  <bdi>{draft.name}</bdi>?
                </p>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void execute(draft)}
                >
                  אישור מדיניות שמע
                </button>
                <button type="button" onClick={() => setDraft(null)}>
                  ביטול
                </button>
              </section>
            )}
            {notice && (
              <>
                <p role="status">{notice.text}</p>
                {notice.state === "unconfirmed" && (
                  <button
                    type="button"
                    onClick={() => void execute(notice.draft, notice.id)}
                  >
                    בדיקה חוזרת של בקשת השמע
                  </button>
                )}
              </>
            )}
          </section>
        )}
      </dialog>
    </div>
  );
}
