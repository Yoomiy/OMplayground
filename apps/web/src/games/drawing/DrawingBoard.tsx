import { useRef, useState, useCallback, useEffect } from "react";
import type { DrawingState } from "@playground/game-logic";
import { DrawingCanvas, type DrawingCanvasRef } from "./DrawingCanvas";

export interface DrawingBoardProps {
  gameState: DrawingState;
  mySeat: string | null;
  myUserId: string | null;
  onIntent: (intent: any) => void;
  onLiveDelta?: (payload: any) => void;
  subscribeLiveDeltas?: (cb: (payload: any) => void) => () => void;
  isHost?: boolean;
  players?: { userId: string; displayName: string }[];
}

export function DrawingBoard({
  gameState,
  mySeat,
  myUserId,
  onIntent,
  onLiveDelta,
  subscribeLiveDeltas,
  isHost,
  players
}: DrawingBoardProps) {
  const canvasRef = useRef<DrawingCanvasRef>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);
  
  // Custom toast notifications
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleClear = () => {
    if (window.confirm("האם אתה בטוח שברצונך לנקות את כל לוח הציור עבור כולם?")) {
      onIntent({ type: "CLEAR_CANVAS" });
      showToast("הלוח נוקה בהצלחה");
    }
  };

  const handleExport = () => {
    if (canvasRef.current) {
      canvasRef.current.exportPNG();
    }
  };

  const isSpectator = mySeat === null;
  const participantCount = Object.keys(gameState.seats || {}).length;

  const myPlayer = players?.find((p) => p.userId === myUserId);
  const myDisplayName = myPlayer?.displayName || (myUserId === "solo" ? "משתתף" : mySeat ? `משתתף (${mySeat})` : "משתתף");

  const activeParticipants = Object.keys(gameState.seats || {}).map((userId) => {
    const p = players?.find((pl) => pl.userId === userId);
    return {
      userId,
      displayName: p?.displayName || (userId === "solo" ? "משתתף" : gameState.seats?.[userId] || "משתתף"),
      isMe: userId === myUserId
    };
  });

  return (
    <div
      ref={boardRef}
      className={`relative mx-auto w-full space-y-4 rounded-3xl border border-indigo-100 bg-white/95 p-4 shadow-play ${
        isFullscreen ? "h-screen w-screen !max-w-none flex flex-col justify-between gap-4 !rounded-none bg-white p-6 overflow-hidden" : ""
      }`}
    >
      {/* Toast Alert */}
      {toast && (
        <div className="absolute right-4 top-20 z-50 animate-bounce rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-950 shadow-md">
          {toast}
        </div>
      )}

      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        {/* Connection status and seat */}
        <div className="flex flex-wrap items-center gap-4">
          {/* My connection status badge */}
          <div className="flex items-center gap-2 rounded-2xl border border-indigo-50 bg-indigo-50/50 px-3 py-1.5 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold text-slate-700">
              {isSpectator ? (
                <span className="text-indigo-600">צופה במשחק</span>
              ) : (
                <span className="flex items-center gap-1">
                  <span>מחובר כ:</span>
                  <span className="font-extrabold text-indigo-950">{myDisplayName}</span>
                </span>
              )}
            </span>
          </div>

          {/* Active room participants avatar list/pills */}
          {(activeParticipants.length > 1 || (isSpectator && activeParticipants.length > 0)) && (
            <div className="flex flex-wrap items-center gap-1.5 border-r border-slate-200 pr-3 mr-1">
              <span className="text-xs font-bold text-slate-400 ml-1">מציירים כעת:</span>
              {activeParticipants.map((p) => (
                <div
                  key={p.userId}
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-all ${
                    p.isMe
                      ? "border-indigo-200 bg-indigo-50 font-bold text-indigo-700 shadow-sm"
                      : "border-slate-100 bg-slate-50/80 font-medium text-slate-600"
                  }`}
                >
                  {/* Small initial bubble */}
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black uppercase ${
                      p.isMe ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {p.displayName.charAt(0) || "מ"}
                  </span>
                  <span>{p.displayName}</span>
                  {p.isMe && <span className="text-[10px] text-indigo-400 font-semibold">(אני)</span>}
                </div>
              ))}
            </div>
          )}

          {/* Fallback connection count if no participants listed yet */}
          {activeParticipants.length === 0 && (
            <div className="text-xs font-bold text-slate-500 border-r border-slate-200 pr-3 mr-1">
              {participantCount === 1 ? "משתתף יחיד בחדר" : `${participantCount} משתתפים בחדר`}
            </div>
          )}
        </div>

        {/* Buttons (Clean, Export, Fullscreen) */}
        <div className="flex items-center gap-2">
          {!isSpectator && (
            <button
              type="button"
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-all hover:scale-105 active:scale-95 duration-200 shadow-sm"
              onClick={handleClear}
            >
              נקה לוח
            </button>
          )}

          <button
            type="button"
            className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-all hover:scale-105 active:scale-95 duration-200 shadow-sm"
            onClick={handleExport}
          >
            ייצא לתמונה
          </button>

          <button
            type="button"
            className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-all hover:scale-105 active:scale-95 duration-200 shadow-sm flex items-center gap-1.5"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9V4.5M15 9h4.5M15 9l5.25-5.25M15 15v4.5M15 15h4.5M15 15l5.25 5.25" />
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
      </div>

      {/* Excalidraw Canvas Container */}
      <div className={`w-full ${isFullscreen ? "flex-grow min-h-0" : ""}`}>
        <DrawingCanvas
          ref={canvasRef}
          gameState={gameState}
          mySeat={mySeat}
          myUserId={myUserId}
          onIntent={onIntent}
          onLiveDelta={onLiveDelta}
          subscribeLiveDeltas={subscribeLiveDeltas}
          showToast={showToast}
          isFullscreen={isFullscreen}
          isHost={isHost}
          players={players}
        />
      </div>
      
      {/* Footer statistics */}
      <div className="flex items-center justify-between text-xs font-medium text-slate-500">
        <div>
          <span>מנוע ציור: Excalidraw</span>
        </div>
        <div>
          <span>עדכון אחרון: {new Date(gameState.canvas?.updatedAt || Date.now()).toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
}
