import { useEffect, useRef, useState } from "react";
import type { VoiceScene } from "@playground/voxel-runtime";
import { VoiceSession } from "./voice-session";
import type { VoiceState } from "./voice-session";
import type { VoxelApi } from "./session-api";
const phases: Record<VoiceState["phase"], string> = {
  off: "השמע כבוי.",
  starting: "מתחברים לשמע…",
  connected: "מחוברים לשמע בקרבתכם.",
  reconnecting: "מתחברים מחדש לשמע…",
  unavailable: "חיבור השמע אינו זמין כרגע. ננסה שוב.",
  blocked: "אין כרגע הרשאה לחיבור שמע.",
};
/** Owns user activation and audio controls; spatial sampling stays in VoiceSession. */
export function VoxelVoice(props: {
  api: VoxelApi;
  names?: readonly { id: string; name: string }[];
  manualJoin?: boolean;
  ready: boolean;
  ended?: boolean;
  scene: () => VoiceScene | null;
  onOpen: () => void;
  onResume?: () => void;
}) {
  const { api, ready } = props,
    latest = useRef(props);
  latest.current = props;
  const host = useRef<HTMLDivElement>(null),
    dialog = useRef<HTMLElement>(null),
    owner = useRef<VoiceSession | null>(null);
  const autoStarted = useRef(false);
  const [state, setState] = useState<VoiceState | null>(null),
    [open, setOpen] = useState(true),
    [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [sink, setSink] = useState(""),
    [sinkError, setSinkError] = useState(false);
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
    autoStarted.current = false;
    setState(voice.state);
    setOpen(true);

    setSink("");
    setSinkError(false);
    return () => {
      alive = false;
      setOpen(false);
      if (owner.current === voice) owner.current = null;
      void voice.close();
    };
  }, [api]);
  useEffect(() => {
    if (props.ended) void owner.current?.close();
    else if (!ready) {
      owner.current?.stop();
      autoStarted.current = false;
    }
  }, [ready, api, props.ended]);
  useEffect(() => {
    const voice = owner.current;
    if (
      !voice ||
      !ready ||
      props.ended ||
      props.manualJoin ||
      autoStarted.current
    )
      return;
    autoStarted.current = true;
    void voice.start({ automatic: true }).then(() => {
      if (
        owner.current === voice &&
        latest.current.ready &&
        !latest.current.manualJoin &&
        voice.state.publishAllowed
      )
        void voice.microphone(true);
    });
  }, [api, ready, props.manualJoin, props.ended]);
  useEffect(() => {
    const unlock = () => {
      const voice = owner.current;
      if (
        !latest.current.manualJoin &&
        latest.current.ready &&
        voice?.state.audioLocked
      )
        void voice.start();
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        event.code !== "KeyM" ||
        event.repeat ||
        !latest.current.ready ||
        document.querySelector(".voxel-session dialog[open]") ||
        (event.target instanceof HTMLElement &&
          event.target.closest(
            'input,textarea,select,[contenteditable="true"]',
          ))
      )
        return;
      event.preventDefault();
      const voice = owner.current;
      if (voice?.state.phase === "connected")
        void voice.microphone(voice.state.microphone !== "on");
      else if (voice)
        void voice.start().then(() => {
          if (
            voice === owner.current &&
            latest.current.ready &&
            voice.state.publishAllowed
          )
            void voice.microphone(true);
        });
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
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
  const connected = state?.phase === "connected";
  return (
    <div className="voxel-session__voice" ref={host}>
      <button
        type="button"
        hidden={open}
        aria-expanded={open}
        onClick={() => {
          props.onOpen();
          setOpen(true);
        }}
      >
        שיחה קולית{state?.microphone === "on" ? " · מיקרופון פעיל" : ""}
      </button>
      <section
        hidden={!open}
        ref={dialog}
        className="voxel-session__dialog voxel-session__voice-dialog"
        aria-labelledby="voxel-voice-title"
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            props.onResume?.();
          }
        }}
      >
        <header>
          <h2 id="voxel-voice-title">קשר קולי (סביבתי)</h2>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              props.onResume?.();
            }}
          >
            מזער
          </button>
        </header>
        <p role="status">
          {!props.manualJoin && (!state || state.phase === "off")
            ? "מכינים את השמע…"
            : phases[state?.phase ?? "off"]}
        </p>
        <nav aria-label="מיקרופון" className="voxel-session__voice-primary">
          {!connected && props.manualJoin && (
            <button
              type="button"
              disabled={!ready || state?.phase === "starting"}
              onClick={() => void owner.current?.start()}
            >
              {state?.audioLocked
                ? "הפעלת שמע"
                : state?.phase === "starting"
                  ? "מתחברים…"
                  : "כניסה לשיחה"}
            </button>
          )}
          {connected && (
            <>
              <button
                type="button"
                aria-pressed={state?.microphone === "on"}
                disabled={
                  !ready || !state?.publishAllowed || state.capturePending
                }
                onClick={() =>
                  void owner.current?.microphone(state?.microphone !== "on")
                }
              >
                {state?.microphone === "on"
                  ? "מיקרופון פעיל (M)"
                  : "מיקרופון מושתק (M)"}
              </button>
            </>
          )}
        </nav>
        {connected && (
          <section
            aria-label="שחקנים בטווח שמיעה"
            className="voxel-session__nearby"
          >
            <p>שחקנים בטווח שמיעה</p>
            {!state?.nearby.length && <p>אין שחקנים בטווח</p>}
            {state?.nearby.map((player) => (
              <p key={player.id} data-speaking={player.speaking}>
                <span>
                  {props.names?.find((p) => p.id === player.id)?.name ?? "שחקן"}
                </span>
                <span>
                  {player.speaking ? " · מדבר" : ""} · {player.distance} מ׳
                  {player.occluded ? " · קול עמום" : ""}
                </span>
              </p>
            ))}
          </section>
        )}
        {connected && !state?.publishAllowed && (
          <p>
            {state?.hidden
              ? "בתצפית אפשר להאזין בלבד."
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
        <details className="voxel-session__voice-settings">
          <summary>הגדרות שמע</summary>
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
            <p role="status">לא ניתן לשנות את יציאת השמע. בחרו התקן אחר.</p>
          )}
          {props.manualJoin && (
            <button
              type="button"
              disabled={!state || state.phase === "off"}
              onClick={() => owner.current?.stop()}
            >
              יציאה מהשיחה
            </button>
          )}
        </details>
      </section>
    </div>
  );
}
