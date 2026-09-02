import { Mic, MicOff, Volume2 } from "lucide-react";
import { desktopPanelClass } from "@/components/KidDesktopShell";
import { useGameVoiceChat } from "@/hooks/useGameVoiceChat";

export function GameVoicePanel(props: {
  sessionId: string;
  requestToken: () => Promise<{ token: string; serverUrl: string }>;
}) {
  const voice = useGameVoiceChat(props);

  return (
    <section className={desktopPanelClass("space-y-3 p-4 text-sm")} aria-label="צ׳אט קולי">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-black text-white/95">צ׳אט קולי</h2>
          <p className="mt-0.5 text-xs text-white/50">
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
              ? "inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 font-bold text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-50"
              : "inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 py-2 font-bold text-rose-300 transition hover:bg-rose-500/25 disabled:opacity-50"
          }
        >
          {voice.micEnabled ? <Mic size={17} /> : <MicOff size={17} />}
          {voice.micEnabled ? "השתק" : "הפעל מיקרופון"}
        </button>
      </div>

      {!voice.canPlaybackAudio && voice.connectionState === "connected" ? (
        <button
          type="button"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 font-bold text-sky-300 transition hover:bg-sky-500/20"
          onClick={() => void voice.startAudio()}
        >
          <Volume2 size={17} />
          הפעל שמע
        </button>
      ) : null}

      {voice.connectionState === "error" ? (
        <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300">
          {voice.errorMessage ?? "לא ניתן להתחבר לצ׳אט הקולי."}
        </p>
      ) : null}
      {voice.micError ? (
        <p role="status" className="text-xs font-semibold text-amber-300">{voice.micError}</p>
      ) : null}

      {voice.connectionState === "connected" ? (
        <div className="flex flex-wrap gap-2">
          {voice.participants.map((participant) => (
            <span
              key={participant.identity}
              className={
                participant.isSpeaking
                  ? "rounded-full border border-emerald-400/50 bg-emerald-400/15 px-2.5 py-1 text-xs font-bold text-emerald-200"
                  : "rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/60"
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
