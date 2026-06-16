import { useEffect, useRef, useState } from "react";
import type { SoloGameSaveControls } from "@/lib/soloGameSaves";

export function HexGLSolo({ save }: { save: SoloGameSaveControls }) {
  const sectionRef = useRef<HTMLElement>(null);
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
    const handleFullscreenChange = () => {
      setIsFullscreen(
        !!document.fullscreenElement && document.fullscreenElement === sectionRef.current
      );
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as {
        source?: string;
        gameKey?: string;
        type?: string;
        state?: { scoreMs?: unknown };
      };
      if (
        data?.source !== "playground-legacy-game" ||
        data.gameKey !== "hexgl" ||
        data.type !== "finish" ||
        typeof data.state?.scoreMs !== "number"
      ) {
        return;
      }
      const key = "hexgl:bestTimeMs";
      void save.mergeBestScores({ [key]: data.state.scoreMs }, [key]);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [save]);

  return (
    <section
      ref={sectionRef}
      className={`mx-auto flex w-full max-w-5xl flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-300 ${
        isFullscreen ? "h-screen w-screen !max-w-none flex flex-col justify-between gap-4 !rounded-none bg-slate-950 border-none p-6 overflow-hidden" : ""
      }`}
      dir="ltr"
    >
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-bold text-white">מרוץ מכוניות</h2>
          <p className="text-sm font-medium text-white/70">
            מירוץ תלת-ממדי מהיר בעולם עתידני. השתמשו במקלדת כדי לשחק.
          </p>
        </div>

        <button
          type="button"
          className="rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10 px-4 py-2 text-xs font-bold transition-all hover:-translate-y-0.5 active:translate-y-0 duration-200 shadow-sm flex items-center gap-1.5 backdrop-blur-sm"
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

      <div className={`relative mx-auto w-full overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-[0_4px_24px_rgba(0,0,0,0.4)] ${
        isFullscreen
          ? "flex-grow min-h-0 border-none"
          : "h-[640px] max-w-[1024px]"
      }`}>
        <iframe
          title="HexGL"
          src="/legacy/hexgl/index.html"
          className="h-full w-full"
          style={{ border: 0 }}
          allow="autoplay; fullscreen"
        />
      </div>
    </section>
  );
}

