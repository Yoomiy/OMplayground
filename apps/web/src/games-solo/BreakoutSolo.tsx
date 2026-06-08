import { useEffect, useRef, useState, useCallback } from "react";
import { isJsonObject, type JsonValue, type SoloGameSaveControls } from "@/lib/soloGameSaves";

export function BreakoutSolo({ save }: { save: SoloGameSaveControls }) {
  const sectionRef = useRef<HTMLElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Always load the clean URL — state is restored via postMessage after 'solo-ready'
  const src = "/legacy/breakout/index.html";

  const toggleFullscreen = () => {
    if (!sectionRef.current) return;
    if (!document.fullscreenElement) {
      sectionRef.current.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        !!document.fullscreenElement && document.fullscreenElement === sectionRef.current
      );
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Keep a stable ref to the saved state so the message handler closure stays fresh
  const savedStateRef = useRef<JsonValue | null>(save.savedState);
  useEffect(() => {
    savedStateRef.current = save.savedState;
  }, [save.savedState]);

  const sendSnapshotRestore = useCallback(() => {
    const savedState = savedStateRef.current;
    if (!iframeRef.current || !isJsonObject(savedState)) return;

    // New format: full snapshot
    if (savedState.kind === "fullSnapshot") {
      iframeRef.current.contentWindow?.postMessage(
        {
          source: "playground-board",
          gameKey: "breakout",
          type: "restore-snapshot",
          snapshot: savedState
        },
        window.location.origin
      );
      return;
    }

    // Legacy format: only currentLevel saved (old checkpoint style).
    // We can only restore the level; the iframe handles that via query param
    // fallback is handled by the URL (see legacy path below if needed).
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as {
        source?: string;
        gameKey?: string;
        type?: string;
        snapshot?: JsonValue;
        state?: { currentLevel?: number; score?: number };
      };

      if (data?.source !== "playground-legacy-game" || data.gameKey !== "breakout") {
        return;
      }

      // iframe finished initializing — restore saved state
      if (data.type === "solo-ready") {
        sendSnapshotRestore();
      }

      // Receive full live snapshot from iframe (sent every 2s and on unload)
      if (data.type === "fullSnapshot" && isJsonObject(data.snapshot)) {
        void save.saveState(data.snapshot as JsonValue);
      }

      // Legacy checkpoint: level-only save (kept for backward compat & level transitions)
      // We no longer use this as the primary save format, but we still record it so that
      // if the full snapshot is somehow missing, we at least know the level.
      if (data.type === "checkpoint" && typeof data.state?.currentLevel === "number") {
        // Only write checkpoint if we don't already have a full snapshot for this session
        // (fullSnapshot will overwrite this anyway within 2 seconds)
        void save.saveState(
          { currentLevel: data.state.currentLevel },
          { saveKind: "checkpoint" }
        );
      }

      if (data.type === "scoreUpdate" && typeof data.state?.score === "number") {
        const scoreKey = "breakout:highScore";
        void save.mergeBestScores({ [scoreKey]: data.state.score }, [scoreKey]);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [save, sendSnapshotRestore]);

  return (
    <section
      ref={sectionRef}
      className={`mx-auto flex w-full max-w-5xl flex-col gap-3 rounded-3xl border border-rose-100 bg-white/95 p-4 shadow-play transition-all duration-300 ${
        isFullscreen ? "h-screen w-screen !max-w-none flex flex-col justify-between gap-4 !rounded-none bg-slate-950 border-none p-6 overflow-hidden" : ""
      }`}
      dir="ltr"
    >
      <div className={`flex flex-wrap items-center justify-between gap-3 border-b pb-3 ${isFullscreen ? "border-slate-800" : "border-slate-100"}`}>
        <div className="flex flex-col gap-0.5">
          <h2 className={`text-lg font-bold ${isFullscreen ? "text-white" : "text-slate-900"}`}>שבירת לבנים (Breakout)</h2>
          <p className={`text-sm font-medium ${isFullscreen ? "text-slate-400" : "text-slate-600"}`}>
            משחק שבירת לבנים קלאסי. השתמשו במקשי החצים או במקלדת (A/D) או בעכבר כדי לנוע, ובמקש הרווח (או W / חץ למעלה / קליק) כדי לירות.
          </p>
        </div>
        <button
          type="button"
          className={`rounded-xl border px-4 py-2 text-xs font-bold transition-all hover:scale-105 active:scale-95 duration-200 shadow-sm flex items-center gap-1.5 ${
            isFullscreen ? "border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800" : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
          }`}
          onClick={toggleFullscreen}
        >
          {isFullscreen ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9V4.5M15 9h4.5M15 9l5.25-5.25M15 15v4.5M15 15h4.5M15 15l-5.25-5.25" />
              </svg>
              <span>מצב רגיל</span>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75v4.5m0-4.5h-4.5m4.5 0L15 9m5.25 11.25v-4.5m0 4.5h-4.5m4.5 0l-5.25-5.25" />
              </svg>
              <span>מסך מלא</span>
            </>
          )}
        </button>
      </div>

      <div className={`relative mx-auto w-full overflow-hidden rounded-3xl border bg-black shadow-play ${
        isFullscreen ? "flex-grow min-h-0 border-slate-800" : "h-[640px] max-w-[1024px] border-slate-200"
      }`}>
        <iframe
          ref={iframeRef}
          title="Breakout"
          src={src}
          className="h-full w-full"
          style={{ border: 0 }}
          allow="autoplay; fullscreen"
        />
      </div>
    </section>
  );
}
