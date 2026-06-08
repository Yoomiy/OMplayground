import { useEffect, useRef, useState, useCallback } from "react";
import type { BreakoutMpState } from "@playground/game-logic";

export interface BreakoutMpBoardProps {
  gameState: BreakoutMpState;
  mySymbol: "A" | "B" | null;
  myUserId: string | null;
  onIntent: (intent: any) => void;
  onLiveDelta?: (payload: any) => void;
  subscribeLiveDeltas?: (cb: (payload: any) => void) => () => void;
  isHost?: boolean;
  paused?: boolean;
  players?: { userId: string; displayName: string }[];
}

export function BreakoutMpBoard({
  gameState,
  mySymbol,
  myUserId,
  onIntent,
  onLiveDelta,
  subscribeLiveDeltas,
  paused = false,
  players
}: BreakoutMpBoardProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const iframeReadyRef = useRef<boolean>(false);
  const lastSyncedLevelRef = useRef<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Track whether we've already requested a save-snapshot on this pause cycle
  const pauseSaveRequestedRef = useRef<boolean>(false);
  const lastSaveTimeRef = useRef<number>(0);

  const toggleFullscreen = () => {
    if (!boardRef.current) return;
    if (!document.fullscreenElement) {
      boardRef.current.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        !!document.fullscreenElement && document.fullscreenElement === boardRef.current
      );
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const sendInit = useCallback(() => {
    if (!iframeReadyRef.current || !iframeRef.current || !mySymbol || !gameState.seed) {
      return;
    }
    console.log("Sending init to breakout iframe...");
    iframeRef.current.contentWindow?.postMessage(
      {
        source: "playground-board",
        gameKey: "breakout",
        type: "init",
        seat: mySymbol,
        seed: gameState.seed,
        currentLevel: gameState.currentLevel ?? 0,
        isAuthority: mySymbol === "A",
        // Pass live snapshot so authority can restore exact mid-game state
        liveSnapshot: mySymbol === "A" ? (gameState.liveSnapshot ?? null) : null
      },
      window.location.origin
    );
    // Focus the iframe automatically so keypresses are directed into the game immediately
    setTimeout(() => {
      iframeRef.current?.focus();
    }, 100);
  }, [mySymbol, gameState.seed, gameState.currentLevel, gameState.liveSnapshot]);

  // Handle outgoing messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (data?.source !== "playground-legacy-game" || data.gameKey !== "breakout") {
        return;
      }

      if (data.type === "ready") {
        iframeReadyRef.current = true;
        sendInit();
      } else if (data.type === "checkpoint" && typeof data.state?.currentLevel === "number") {
        onIntent({ kind: "checkpoint", currentLevel: data.state.currentLevel });
      } else if (data.type === "need-snapshot") {
        onLiveDelta?.({ type: "need-snapshot" });
      } else if (data.type === "paddle" && data.paddle) {
        onLiveDelta?.({ type: "paddle", paddle: data.paddle });
      } else if (data.type === "snapshot" && data.snapshot) {
        onLiveDelta?.({ type: "snapshot", snapshot: data.snapshot });
        // Authority sends periodic snapshots — update server-side room state in-memory periodically.
        // We save immediately if pause was requested, or every 5 seconds.
        const now = Date.now();
        const shouldSave =
          mySymbol === "A" &&
          (pauseSaveRequestedRef.current || now - lastSaveTimeRef.current > 5000);

        if (shouldSave) {
          pauseSaveRequestedRef.current = false;
          lastSaveTimeRef.current = now;
          onIntent({ kind: "save-snapshot", snapshot: data.snapshot });
        }
      } else if (data.type === "end" && data.result) {
        onIntent({ kind: "report-end", result: data.result });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [sendInit, onLiveDelta, onIntent, mySymbol]);

  // Retransmit seed when parameters are resolved
  useEffect(() => {
    if (mySymbol && gameState.seed) {
      sendInit();
    }
  }, [mySymbol, gameState.seed, sendInit]);

  // If the server checkpoint advances while the iframe stays mounted, resync quietly.
  useEffect(() => {
    if (!iframeReadyRef.current || !iframeRef.current) return;
    const level = gameState.currentLevel ?? 0;
    if (lastSyncedLevelRef.current === null) {
      lastSyncedLevelRef.current = level;
      return;
    }
    if (lastSyncedLevelRef.current === level) return;
    lastSyncedLevelRef.current = level;
    iframeRef.current.contentWindow?.postMessage(
      {
        source: "playground-board",
        gameKey: "breakout",
        type: "resync-level",
        currentLevel: level
      },
      window.location.origin
    );
  }, [gameState.currentLevel]);

  // Handle incoming live deltas from the peer
  useEffect(() => {
    if (!subscribeLiveDeltas) return;

    const unsubscribe = subscribeLiveDeltas((payload) => {
      if (!iframeRef.current || !payload?.delta) return;
      const delta = payload.delta;
      iframeRef.current.contentWindow?.postMessage(
        {
          source: "playground-board",
          gameKey: "breakout",
          type: delta.type,
          paddle: delta.paddle,
          snapshot: delta.snapshot
        },
        window.location.origin
      );
    });

    return () => unsubscribe();
  }, [subscribeLiveDeltas]);

  // On pause: request authority to send a save-snapshot
  // On resume: send resume message
  useEffect(() => {
    if (!iframeRef.current) return;
    if (paused) {
      // Request immediate snapshot capture from authority so we can persist it
      if (mySymbol === "A") {
        pauseSaveRequestedRef.current = true;
        iframeRef.current.contentWindow?.postMessage(
          {
            source: "playground-board",
            gameKey: "breakout",
            type: "request-save-snapshot"
          },
          window.location.origin
        );
      }
      iframeRef.current.contentWindow?.postMessage(
        {
          source: "playground-board",
          gameKey: "breakout",
          type: "pause"
        },
        window.location.origin
      );
    } else {
      pauseSaveRequestedRef.current = false;
      iframeRef.current.contentWindow?.postMessage(
        {
          source: "playground-board",
          gameKey: "breakout",
          type: "resume"
        },
        window.location.origin
      );
    }
  }, [paused, mySymbol]);

  const myPlayer = players?.find((p) => p.userId === myUserId);
  const myDisplayName = myPlayer?.displayName || "שחקן";

  const partnerSeat = mySymbol === "A" ? "B" : "A";
  const partnerPlayer = players?.find((p) => p.userId !== myUserId);
  const partnerDisplayName = partnerPlayer?.displayName || `שחקן ${partnerSeat}`;

  const isObserver = !mySymbol;

  return (
    <div
      ref={boardRef}
      className={`relative mx-auto w-full flex flex-col gap-4 rounded-3xl border border-rose-950 bg-slate-950 p-5 shadow-2xl transition-all duration-300 ${
        isFullscreen ? "h-screen w-screen !max-w-none !rounded-none p-6 overflow-hidden" : "max-w-5xl"
      }`}
      dir="ltr"
    >
      {/* Top Header Controls / Connection info */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-950/40 pb-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-pink-500 to-violet-500 tracking-wide">
            שבירת לבנים שיתופי (Breakout Coop)
          </h2>
          <p className="text-xs font-semibold text-slate-400 text-right">
            {isObserver ? (
              <span className="text-yellow-500">צופה במשחק</span>
            ) : (
              <span className="flex items-center gap-1.5 justify-end">
                <span>משחק בתור:</span>
                <span className="font-extrabold text-rose-400">
                  {myDisplayName} (מגן {mySymbol === "A" ? "תחתון" : "עליון"})
                </span>
                <span className="text-slate-500">|</span>
                <span>שותף:</span>
                <span className="font-bold text-slate-300">{partnerDisplayName}</span>
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Active status indicator */}
          <div className="flex items-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-950/20 px-3.5 py-1.5 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
              Split Paddle Sync
            </span>
          </div>

          <button
            type="button"
            className="rounded-xl border border-rose-800 bg-rose-950/30 hover:bg-rose-900/40 px-4 py-2 text-xs font-bold text-rose-200 transition-all hover:scale-105 active:scale-95 duration-200 shadow-md shadow-rose-950/50 flex items-center gap-2"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <span>מצב רגיל</span> : <span>מסך מלא</span>}
          </button>
        </div>
      </div>

      {/* Legacy Game Container */}
      <div 
        className={`relative mx-auto w-full overflow-hidden rounded-2xl border border-rose-950/80 bg-black shadow-inner shadow-black/80 cursor-pointer ${
          isFullscreen ? "flex-grow min-h-0" : "h-[640px] max-w-[1024px]"
        }`}
        onClick={() => iframeRef.current?.focus()}
      >
        <iframe
          ref={iframeRef}
          title="Breakout Multiplayer"
          src="/legacy/breakout/index.html?mp=1"
          className="h-full w-full"
          style={{ border: 0 }}
          allow="autoplay; fullscreen"
        />
      </div>

      {/* Control Tips Overlay */}
      <div className="flex justify-between items-center bg-slate-900/30 border border-slate-900 rounded-2xl p-3 text-[11px] text-slate-400 font-semibold">
        <div>
          <span className="text-rose-400 font-bold">מגן תחתון (Team A):</span> תנועה עם מקשי החצים שמאלה/ימינה או A/D, ירייה עם מקש הרווח / חץ למעלה / W.
        </div>
        <div>
          <span className="text-pink-400 font-bold">מגן עליון (Team B):</span> תנועה עם מקשי החצים שמאלה/ימינה או A/D, ירייה עם מקש הרווח / חץ למעלה / W.
        </div>
      </div>
    </div>
  );
}
