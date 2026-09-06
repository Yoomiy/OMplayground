import { useState } from "react";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { desktopPanelClass } from "@/components/KidDesktopShell";
import { useGameVoiceChat } from "@/hooks/useGameVoiceChat";

interface GameVoicePanelProps {
  sessionId: string;
  requestToken: () => Promise<{ token: string; serverUrl: string }>;
  manualJoin?: boolean;
}

export function GameVoicePanel({ manualJoin = false, ...voiceProps }: GameVoicePanelProps) {
  const [manuallyJoinedSessionId, setManuallyJoinedSessionId] = useState<string | null>(null);
  const joined = !manualJoin || manuallyJoinedSessionId === voiceProps.sessionId;

  if (!joined) {
    return (
      <section className={desktopPanelClass("space-y-3 p-4 text-sm")} aria-label="צ׳אט קולי">
        <div>
          <h2 className="font-black text-slate-900 dark:text-white/95">צ׳אט קולי</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-white/50">
            ההאזנה והמיקרופון כבויים עד שתבחר להצטרף.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex w-full min-h-10 items-center justify-center gap-2 rounded-xl border border-sky-300 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/10 px-3 py-2 font-bold text-sky-700 dark:text-sky-300 transition hover:bg-sky-100 dark:hover:bg-sky-500/20 shadow-sm"
          onClick={() => setManuallyJoinedSessionId(voiceProps.sessionId)}
        >
          <Mic size={17} />
          הצטרף לצ׳אט הקולי
        </button>
      </section>
    );
  }

  return <ConnectedGameVoicePanel {...voiceProps} />;
}

function ConnectedGameVoicePanel(props: Omit<GameVoicePanelProps, "manualJoin">) {
  const voice = useGameVoiceChat(props);

  return (
    <section className={desktopPanelClass("space-y-3 p-4 text-sm")} aria-label="צ׳אט קולי">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-black text-slate-900 dark:text-white/95">צ׳אט קולי</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-white/50">
            {voice.connectionState === "connecting"
              ? "מתחבר…"
              : voice.connectionState === "connected"
                ? `${voice.participants.length} בחדר הקולי`
                : "לא מחובר"}
          </p>
        </div>
        <button
          type="button"
          disabled={voice.connectionState !== "connected"}
          onClick={() => void voice.toggleMicrophone()}
          aria-pressed={!voice.micEnabled}
          className={
            voice.micEnabled
              ? "inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/15 px-3 py-2 font-bold text-emerald-700 dark:text-emerald-300 transition hover:bg-emerald-100 dark:hover:bg-emerald-500/25 disabled:opacity-50 shadow-sm"
              : "inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/15 px-3 py-2 font-bold text-rose-700 dark:text-rose-300 transition hover:bg-rose-100 dark:hover:bg-rose-500/25 disabled:opacity-50 shadow-sm"
          }
        >
          {voice.micEnabled ? <Mic size={17} /> : <MicOff size={17} />}
          {voice.micEnabled ? "השתק" : "הפעל מיקרופון"}
        </button>
      </div>

      {!voice.canPlaybackAudio && voice.connectionState === "connected" ? (
        <button
          type="button"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sky-300 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/10 px-3 py-2 font-bold text-sky-700 dark:text-sky-300 transition hover:bg-sky-100 dark:hover:bg-sky-500/20 shadow-sm"
          onClick={() => void voice.startAudio()}
        >
          <Volume2 size={17} />
          הפעל שמע
        </button>
      ) : null}

      {voice.connectionState === "error" ? (
        <p role="status" className="rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
          {voice.errorMessage ?? "לא ניתן להתחבר לצ׳אט הקולי."}
        </p>
      ) : null}
      {voice.micError ? (
        <p role="status" className="text-xs font-semibold text-amber-800 dark:text-amber-300">{voice.micError}</p>
      ) : null}

      {voice.connectionState === "connected" ? (
        <div className="flex flex-wrap gap-2">
          {voice.participants.map((participant) => (
            <span
              key={participant.identity}
              className={
                participant.isSpeaking
                  ? "rounded-full border border-emerald-300 dark:border-emerald-400/50 bg-emerald-50 dark:bg-emerald-400/15 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-200"
                  : "rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-white/60"
              }
            >
              {participant.name}{participant.isLocal ? " (אני)" : ""}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
