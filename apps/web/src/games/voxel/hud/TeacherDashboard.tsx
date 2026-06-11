import React from "react";
import type { SimpleAck } from "@/lib/voxelProtocol";

export interface TeacherDashboardProps {
  isTeacher: boolean;
  isTeacherSpectator: boolean;
  setIsTeacherSpectator: (val: boolean) => void;
  playersList: Array<{ userId: string; displayName: string; pos: [number, number, number] }>;
  onTeleport: (pos: [number, number, number]) => void;
  onSwitchTeacherMode?: (observer: boolean) => Promise<SimpleAck>;
}

export const TeacherDashboard = React.memo(function TeacherDashboard({
  isTeacher,
  isTeacherSpectator,
  setIsTeacherSpectator,
  playersList,
  onTeleport,
  onSwitchTeacherMode,
}: TeacherDashboardProps): JSX.Element | null {
  if (!isTeacher) return null;

  return (
    <div className="absolute right-4 top-16 z-30 flex flex-col gap-3 rounded-lg border border-indigo-500/20 bg-slate-900/90 p-4 text-white font-sans shadow-lg max-w-sm" dir="rtl">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-2">
        <h3 className="font-bold text-sm text-indigo-400">📋 לוח בקרת מורה</h3>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${isTeacherSpectator ? "bg-amber-600/80 text-amber-100" : "bg-emerald-600/80 text-emerald-100"}`}>
          {isTeacherSpectator ? "מצב תצפית" : "מצב שחקן"}
        </span>
      </div>

      {isTeacherSpectator ? (
        <>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            אתה במצב <b>תעופה ותצפית</b>. באפשרותך לנוע בחופשיות ללא כוח משיכה, לעבור דרך שחקנים, לראות היכן כולם נמצאים ולהשתגר אליהם.
          </p>
          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
            <span className="text-[10px] text-slate-400 font-semibold mb-1 font-sans">שחקנים בחדר ({playersList.length}):</span>
            {playersList.length === 0 ? (
              <span className="text-xs text-slate-500 italic">אין שחקנים אחרים בחדר</span>
            ) : (
              playersList.map((player) => (
                <div key={player.userId} className="flex items-center justify-between gap-3 bg-white/5 rounded p-2 border border-white/5 hover:bg-white/10 transition-colors">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-200">{player.displayName}</span>
                    <span className="text-[9px] text-slate-400 select-all font-sans">
                      X: {player.pos[0]}, Y: {player.pos[1]}, Z: {player.pos[2]}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onTeleport(player.pos)}
                    className="rounded bg-indigo-600 px-2.5 py-1.5 text-[10px] font-bold hover:bg-indigo-500 text-white transition-colors cursor-pointer"
                  >
                    📍 השתגר
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <p className="text-[11px] text-slate-300 leading-relaxed text-right">
          אתה משחק כעת <b>כשחקן רגיל</b> בתוך המשחק. חלים עליך חוקי המשחק הרגילים.
        </p>
      )}

      <button
        type="button"
        onClick={async () => {
          const nextSpectator = !isTeacherSpectator;
          if (onSwitchTeacherMode) {
            const ack = await onSwitchTeacherMode(nextSpectator);
            if (ack.ok) {
              setIsTeacherSpectator(nextSpectator);
            } else {
              alert(ack.error?.message ?? "שגיאה בשינוי מצב");
            }
          }
        }}
        className={`w-full rounded py-2 text-center text-xs font-bold text-white transition-all shadow cursor-pointer ${
          isTeacherSpectator
            ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500"
            : "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500"
        }`}
      >
        {isTeacherSpectator ? "🎮 היכנס למשחק כשחקן" : "📋 חזור למצב תצפית מורה"}
      </button>
    </div>
  );
});
