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
  connectedPlayers?: { userId: string; displayName: string }[];
  endOverlay?: { kind: "won" | "draw" | "stopped"; winner?: string } | null;
}

export function BreakoutMpBoard({
  gameState,
  mySymbol,
  onIntent,
  onLiveDelta,
  subscribeLiveDeltas,
  paused = false,
  connectedPlayers,
  endOverlay
}: BreakoutMpBoardProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const iframeReadyRef = useRef<boolean>(false);
  const lastSyncedLevelRef = useRef<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isWaitingForPlayers = !connectedPlayers || connectedPlayers.length < 2;

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
    if (!iframeReadyRef.current || !iframeRef.current || !mySymbol || !gameState.seed || isWaitingForPlayers) {
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
    if (mySymbol && gameState.seed && !isWaitingForPlayers) {
      sendInit();
    }
  }, [mySymbol, gameState.seed, isWaitingForPlayers, sendInit]);

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
    const shouldPause = paused || !!endOverlay;
    if (shouldPause) {
      // Request immediate snapshot capture from authority so we can persist it
      if (mySymbol === "A" && !endOverlay) {
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
  }, [paused, endOverlay, mySymbol]);



  return (
    <div
      ref={boardRef}
      className={`relative mx-auto w-full flex flex-col gap-4 rounded-3xl border border-rose-950 bg-slate-950 p-5 shadow-2xl transition-all duration-300 ${
        isFullscreen ? "h-screen w-screen !max-w-none !rounded-none p-6 overflow-hidden" : "max-w-5xl"
      }`}
      dir="ltr"
    >
      {/* Floating Fullscreen Toggle Button */}
      {!isWaitingForPlayers && (
        <button
          type="button"
          className="absolute top-8 right-8 z-20 rounded-xl border border-rose-850 bg-rose-950/40 hover:bg-rose-900/50 px-3.5 py-1.5 text-xs font-bold text-rose-200 transition-all hover:scale-105 active:scale-95 duration-200 shadow-md shadow-rose-950/50 flex items-center gap-1.5 opacity-60 hover:opacity-100"
          onClick={toggleFullscreen}
        >
          {isFullscreen ? <span>מצב רגיל</span> : <span>מסך מלא</span>}
        </button>
      )}

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

        {isWaitingForPlayers && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-sm text-white p-6 text-center select-none" dir="rtl">
            <div className="relative mb-6 flex h-20 w-20 items-center justify-center">
              {/* Pulsing neon waves */}
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500/20 opacity-75"></span>
              <span className="absolute inline-flex h-4/5 w-4/5 animate-pulse rounded-full bg-pink-500/30"></span>
              {/* Inner glowing core */}
              <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-violet-600 shadow-lg shadow-rose-500/50">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6 animate-spin text-white">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </div>
            </div>
            
            <h3 className="text-2xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-pink-400 to-violet-400 mb-2">
              ממתינים לשחקנים
            </h3>
            
            <p className="text-slate-400 text-sm max-w-sm font-medium leading-relaxed">
              המשחק דורש שני שחקנים. ברגע שהשחקן השני יתחבר, המשחק יתחיל באופן אוטומטי.
            </p>
            
            {connectedPlayers && connectedPlayers.length > 0 && (
              <div className="mt-6 rounded-2xl border border-rose-950/50 bg-rose-950/10 px-4 py-2 text-xs font-semibold text-rose-300">
                שחקן מחובר: {connectedPlayers[0]?.displayName}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
