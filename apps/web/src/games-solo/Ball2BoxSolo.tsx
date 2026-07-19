import { useEffect, useRef, useState } from "react";
import type { SoloGameSaveControls } from "@/lib/soloGameSaves";

export function Ball2BoxSolo({ save }: { save: SoloGameSaveControls }) {
  const sectionRef = useRef<HTMLElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
    const handleFsChange = () => {
      setIsFullscreen(
        !!document.fullscreenElement && document.fullscreenElement === sectionRef.current
      );
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as {
        source?: string;
        gameKey?: string;
        type?: string;
        state?: any;
      };
      if (
        data?.source !== "playground-legacy-game" ||
        data.gameKey !== "ball2box"
      ) {
        return;
      }

      // Game finished loading — send saved state for restore
      if (data.type === "solo-ready") {
        if (save.savedState && iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            {
              source: "playground-board",
              gameKey: "ball2box",
              type: "restore-snapshot",
              snapshot: save.savedState,
            },
            window.location.origin
          );
        }
      }

      // Checkpoint save (mid-game progress)
      if (
        data.type === "checkpoint" &&
        data.state
      ) {
        void save.saveState(
          data.state,
          { saveKind: "checkpoint" }
        );
      }

      // Game finished — save high score (cleared levels count)
      if (data.type === "finish" && typeof data.state?.score === "number") {
        const key = "ball2box:bestScore";
        void save.mergeBestScores({ [key]: data.state.score });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [save]);

  return (
    <section
      ref={sectionRef}
      className={`mx-auto flex w-full max-w-5xl flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-300 ${
        isFullscreen
          ? "h-screen w-screen !max-w-none flex flex-col justify-between gap-4 !rounded-none bg-slate-950 border-none p-6 overflow-hidden"
          : ""
      }`}
      dir="ltr"
    >
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-bold text-white">כדור לקופסה (Ball to Box)</h2>
          <p className="text-sm font-medium text-white/70">משחק פאזל פיזיקלי תלת-ממדי מאתגר - הכניסו את הכדור לקופסה!</p>
        </div>
        <button
          type="button"
          className="rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10 px-4 py-2 text-xs font-bold transition-all hover:-translate-y-0.5 active:translate-y-0 duration-200 shadow-sm flex items-center gap-1.5 backdrop-blur-sm"
          onClick={toggleFullscreen}
        >
          {isFullscreen ? "מצב רגיל" : "מסך מלא"}
        </button>
      </div>

      {/* Game viewport */}
      <div
        className={`relative mx-auto w-full overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-[0_4px_24px_rgba(0,0,0,0.4)] ${
          isFullscreen
            ? "flex-grow min-h-0 border-none"
            : "h-[640px] max-w-[1024px]"
        }`}
      >
        <iframe
          ref={iframeRef}
          title="Ball2Box"
          src="/legacy/ball2box/index.html"
          className="h-full w-full"
          style={{ border: 0 }}
          allow="autoplay; fullscreen"
        />
      </div>
    </section>
  );
}
