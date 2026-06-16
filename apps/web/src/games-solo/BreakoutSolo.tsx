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
      className={`relative mx-auto w-full flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-5 shadow-2xl transition-all duration-300 ${
        isFullscreen ? "h-screen w-screen !max-w-none !rounded-none p-6 overflow-hidden" : "max-w-5xl"
      }`}
      dir="ltr"
    >
      <button
        type="button"
        className="absolute top-8 right-8 z-20 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white transition-all hover:-translate-y-0.5 active:translate-y-0 duration-200 shadow-md flex items-center gap-1.5 backdrop-blur-sm"
        onClick={toggleFullscreen}
      >
        {isFullscreen ? <span>מצב רגיל</span> : <span>מסך מלא</span>}
      </button>

      <div className={`relative mx-auto w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-inner cursor-pointer ${
        isFullscreen ? "flex-grow min-h-0" : "h-[640px] max-w-[1024px]"
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

