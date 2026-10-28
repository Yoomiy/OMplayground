import React from "react";
import type { ChatLineRow } from "@/hooks/usePersistedSessionChat";

export interface ChatOverlayProps {
  chatOpen: boolean;
  chatPosition: { x: number; y: number };
  chatLines: ChatLineRow[];
  canSendChat: boolean;
  typedMessage: string;
  setTypedMessage: (val: string) => void;
  onClearSessionChat?: () => void;
  onSoftDeleteChatMessage?: (id: string) => void;
  handleDragStart: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleCloseChat: () => void;
  chatScrollRef: React.RefObject<HTMLDivElement>;
  chatInputRef: React.RefObject<HTMLInputElement>;
  handleInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  handleInputKeyUp: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  handleSendMessage: () => void;
}

export const ChatOverlay = React.memo(function ChatOverlay({
  chatOpen,
  chatPosition,
  chatLines,
  canSendChat,
  typedMessage,
  setTypedMessage,
  onClearSessionChat,
  onSoftDeleteChatMessage,
  handleDragStart,
  handleCloseChat,
  chatScrollRef,
  chatInputRef,
  handleInputKeyDown,
  handleInputKeyUp,
  handleSendMessage,
}: ChatOverlayProps): JSX.Element | null {
  const renderedMessages = chatLines.map((line) => {
    if (line.is_system) {
      return (
        <div key={line.id} className="text-right text-xs text-amber-300/95 italic font-medium leading-relaxed">
          {line.message}
        </div>
      );
    }
    const isDeleted = !!line.is_deleted;
    return (
      <div key={line.id} className="text-right text-xs text-white leading-relaxed break-all font-sans flex items-center justify-between gap-2">
        <span className={`font-sans text-right select-text ${isDeleted ? "text-slate-500 italic" : "text-white"}`}>
          <span className="font-bold text-sky-300 select-none">{line.sender_name}:</span>{" "}
          {isDeleted ? "הודעה נמחקה על ידי מורה" : line.message}
        </span>
        {onSoftDeleteChatMessage && !isDeleted && (
          <button
            type="button"
            onClick={() => void onSoftDeleteChatMessage(line.id)}
            className="shrink-0 rounded bg-rose-950/40 border border-rose-500/25 px-1.5 py-0.5 text-[9px] font-bold text-rose-300 hover:bg-rose-900/50 hover:text-white transition-colors cursor-pointer select-none"
            title="מחק הודעה"
          >
            מחק
          </button>
        )}
      </div>
    );
  });

  const peekMessages = chatLines.slice(-4).map((line) => {
    if (line.is_system) {
      return (
        <div key={line.id} className="text-right text-xs text-amber-300/80 italic font-medium leading-tight">
          {line.message}
        </div>
      );
    }
    const isDeleted = !!line.is_deleted;
    return (
      <div key={line.id} className={`text-right text-xs leading-tight break-all font-sans ${isDeleted ? "text-slate-500/80 italic" : "text-white/90"}`}>
        <span className="font-bold text-sky-300/90">{line.sender_name}:</span>{" "}
        {isDeleted ? "הודעה נמחקה על ידי מורה" : line.message}
      </div>
    );
  });

  if (chatOpen) {
    return (
      <div
        dir="rtl"
        style={{ left: `${chatPosition.x}px`, top: `${chatPosition.y}px`, bottom: "auto" }}
        className="pointer-events-auto absolute z-30 w-80 md:w-96 rounded-xl border border-white/15 bg-slate-950/85 p-3 shadow-2xl backdrop-blur-md flex flex-col gap-2 font-sans select-none"
      >
        <div
          onMouseDown={handleDragStart}
          className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-1 text-slate-400 cursor-move select-none"
        >
          <span className="text-[11px] font-bold text-slate-300">צ'אט משחק (גרור להזזה)</span>
          <div className="flex items-center gap-1.5">
            {onClearSessionChat && (
              <button
                type="button"
                onClick={() => void onClearSessionChat()}
                className="rounded border border-rose-500/35 bg-rose-950/20 px-2 py-0.5 text-[9px] font-bold text-rose-300 hover:bg-rose-900/40 hover:text-white transition-colors cursor-pointer select-none"
                title="נקה את כל הודעות הצ'אט"
              >
                נקה צ'אט
              </button>
            )}
            <button
              type="button"
              onClick={handleCloseChat}
              className="rounded p-1 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="סגור צ'אט"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div
          ref={chatScrollRef}
          className="h-48 overflow-y-auto flex flex-col gap-1.5 pr-1 text-right custom-scrollbar select-text"
        >
          {renderedMessages.length === 0 ? (
            <div className="text-center text-xs text-slate-500 py-4 select-none">אין הודעות צ'אט</div>
          ) : (
            renderedMessages
          )}
        </div>

        {canSendChat ? (
          <div className="flex gap-2 mt-1">
            <input
              ref={chatInputRef}
              type="text"
              value={typedMessage}
              onChange={(e) => setTypedMessage(e.target.value)}
              onKeyDown={handleInputKeyDown}
              onKeyUp={handleInputKeyUp}
              placeholder="כתבו הודעה כאן..."
              maxLength={150}
              className="flex-grow rounded border border-white/25 bg-black/50 px-2.5 py-1.5 text-xs text-white outline-none focus:border-sky-400 focus:bg-black/70 text-right font-sans select-text"
            />
            <button
              type="button"
              onClick={handleSendMessage}
              className="rounded bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-500 transition-colors cursor-pointer"
            >
              שלח
            </button>
          </div>
        ) : (
          <div className="text-center text-[10px] text-slate-400 bg-white/5 py-1.5 rounded mt-1 select-none">
            מצב תצפית (קריאה בלבד)
          </div>
        )}
      </div>
    );
  }

  if (chatLines.length > 0) {
    return (
      <div
        dir="rtl"
        className="pointer-events-none absolute top-16 left-4 z-20 w-80 md:w-96 rounded-lg bg-black/25 p-2.5 flex flex-col gap-1 text-right font-sans border border-white/5 backdrop-blur-[1px]"
      >
        {peekMessages}
      </div>
    );
  }

  return null;
});
