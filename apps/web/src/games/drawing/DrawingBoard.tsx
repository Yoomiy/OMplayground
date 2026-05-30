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
}

export function DrawingBoard({
  gameState,
  mySeat,
  myUserId,
  onIntent,
  onLiveDelta,
  subscribeLiveDeltas
}: DrawingBoardProps) {
  const canvasRef = useRef<DrawingCanvasRef>(null);
  
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

  return (
    <div className="relative mx-auto w-full space-y-4 rounded-3xl border border-indigo-100 bg-white/95 p-4 shadow-play">
      {/* Toast Alert */}
      {toast && (
        <div className="absolute right-4 top-20 z-50 animate-bounce rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-950 shadow-md">
          {toast}
        </div>
      )}

      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        {/* Connection status and seat */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
            </span>
            <span className="text-sm font-black text-slate-800">
              {isSpectator ? "צופה במשחק" : `משתתף (${gameState.seats?.[myUserId!] || "מחובר"})`}
            </span>
          </div>
          
          <div className="h-4 w-px bg-slate-200" />
          
          <div className="text-xs font-semibold text-slate-500">
            {participantCount === 1 ? "משתתף יחיד בחדר" : `${participantCount} משתתפים בחדר`}
          </div>
        </div>

        {/* Buttons (Clean and Export) */}
        <div className="flex items-center gap-2">
          {!isSpectator && (
            <button
              type="button"
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors shadow-sm"
              onClick={handleClear}
            >
              נקה לוח
            </button>
          )}

          <button
            type="button"
            className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors shadow-sm"
            onClick={handleExport}
          >
            ייצא לתמונה
          </button>
        </div>
      </div>

      {/* Excalidraw Canvas Container */}
      <div className="w-full">
        <DrawingCanvas
          ref={canvasRef}
          gameState={gameState}
          mySeat={mySeat}
          myUserId={myUserId}
          onIntent={onIntent}
          onLiveDelta={onLiveDelta}
          subscribeLiveDeltas={subscribeLiveDeltas}
          showToast={showToast}
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
