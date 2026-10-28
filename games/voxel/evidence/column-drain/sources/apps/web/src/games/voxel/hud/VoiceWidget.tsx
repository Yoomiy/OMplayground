import React from "react";
import type { Room } from "livekit-client";

export interface VoiceWidgetProps {
  mutedByHostReason: string | null;
  voiceWidgetExpanded: boolean;
  setVoiceWidgetExpanded: (val: boolean) => void;
  activeRoom: Room | null;
  showVoiceSettings: boolean;
  setShowVoiceSettings: (val: boolean) => void;
  selectedDevice: string;
  changeAudioOutput: (deviceId: string) => Promise<void>;
  audioDevices: MediaDeviceInfo[];
  micEnabled: boolean;
  activeSpeakers: string[];
  myUserId: string | null;
  toggleMute: () => void;
  iAmHost: boolean;
  muteAll: () => void;
  playersList: Array<{ userId: string; displayName: string; pos: [number, number, number] }>;
  getPlayerDistanceAndOcclusion: (pos: [number, number, number]) => { distance: number; solidBlocks: number };
}

export const VoiceWidget = React.memo(function VoiceWidget({
  mutedByHostReason,
  voiceWidgetExpanded,
  setVoiceWidgetExpanded,
  activeRoom,
  showVoiceSettings,
  setShowVoiceSettings,
  selectedDevice,
  changeAudioOutput,
  audioDevices,
  micEnabled,
  activeSpeakers,
  myUserId,
  toggleMute,
  iAmHost,
  muteAll,
  playersList,
  getPlayerDistanceAndOcclusion,
}: VoiceWidgetProps): JSX.Element | null {
  return (
    <div
      dir="rtl"
      className="pointer-events-auto absolute left-4 bottom-4 z-30 flex flex-col gap-2 font-sans select-none"
    >
      {/* Muted by Host Warning Toast */}
      {mutedByHostReason && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-950/80 px-3.5 py-2 text-xs font-bold text-rose-100 shadow-lg animate-bounce max-w-xs">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <span>{mutedByHostReason}</span>
        </div>
      )}

      {/* Main voice card */}
      <div className={`rounded-xl border border-white/10 bg-slate-950/80 p-3 shadow-2xl backdrop-blur-md flex flex-col transition-all duration-300 ${voiceWidgetExpanded ? "w-64" : "w-14 items-center"}`}>
        {/* Header */}
        <div className="flex items-center justify-between w-full border-b border-white/5 pb-2 mb-2">
          {voiceWidgetExpanded ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-300">קשר קולי (סביבתי)</span>
                {activeRoom?.state === "connected" ? (
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="מחובר" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-amber-500" title="מתחבר" />
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                  className={`rounded p-1 text-slate-400 hover:text-white transition-colors hover:bg-white/5 ${showVoiceSettings ? "text-sky-400 bg-white/5" : ""}`}
                  title="הגדרות שמע"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setVoiceWidgetExpanded(false)}
                  className="rounded p-1 text-slate-400 hover:text-white transition-colors hover:bg-white/5"
                  title="מזער"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setVoiceWidgetExpanded(true)}
              className="rounded p-1 text-slate-400 hover:text-white transition-colors hover:bg-white/5"
              title="הרחב"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
              </svg>
            </button>
          )}
        </div>

        {/* Content */}
        {voiceWidgetExpanded ? (
          <div className="flex flex-col gap-3">
            {showVoiceSettings ? (
              /* Settings panel */
              <div className="flex flex-col gap-2 bg-slate-900/50 p-2.5 rounded-lg border border-white/5">
                <span className="text-[10px] text-slate-400 font-bold">התקן פלט שמע</span>
                <select
                  value={selectedDevice}
                  onChange={(e) => void changeAudioOutput(e.target.value)}
                  className="w-full bg-slate-950 text-[11px] text-white border border-white/15 rounded p-1 outline-none"
                >
                  <option value="">ברירת מחדל של המערכת</option>
                  {audioDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `רמקול/אוזניות (${device.deviceId.slice(0, 5)})`}
                    </option>
                  ))}
                </select>
                <div className="text-[9px] text-slate-500 leading-normal mt-1">
                  * תוכל להעביר את קולות השחקנים לאוזניות כדי לשפר את חווית התלת-מימד (HRTF).
                </div>
              </div>
            ) : (
              /* Active speakers & players list */
              <div className="flex flex-col gap-2">
                {/* Local User Row */}
                <div className="flex items-center justify-between bg-white/5 rounded-lg p-2 border border-white/5">
                  <div className="flex items-center gap-2">
                    <div className={`relative flex h-6 w-6 items-center justify-center rounded-full bg-sky-600/35 border ${micEnabled ? "border-emerald-500/50" : "border-slate-500/50"}`}>
                      {micEnabled ? (
                        activeSpeakers.includes(myUserId || "") ? (
                          <span className="absolute inset-0 rounded-full bg-emerald-500/35 animate-ping" />
                        ) : null
                      ) : null}
                      <span className="text-[9px] font-bold text-white">אני</span>
                    </div>
                    <span className="text-xs font-bold text-slate-200">אתה</span>
                  </div>

                  <button
                    type="button"
                    onClick={toggleMute}
                    className={`rounded-lg px-2.5 py-1 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      micEnabled 
                        ? "bg-emerald-600/90 text-white hover:bg-emerald-500" 
                        : "bg-rose-700/90 text-white hover:bg-rose-600 animate-pulse"
                    }`}
                    title={micEnabled ? "השתק מיקרופון (M)" : "הפעל מיקרופון (M)"}
                  >
                    {micEnabled ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                        </svg>
                        <span>פעיל</span>
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015 8a1 1 0 00-2 0 8 8 0 006.88 7.902V18H7a1 1 0 100 2h6a1 1 0 100-2h-2.12v-2.11a5.975 5.975 0 012.597-1zM4 8a4 4 0 017.75-1.39l-1.042 1.043A2.5 2.5 0 006.5 8a.5.5 0 00-1 0zm7.843 3.657l1.414-1.414A5.96 5.96 0 0014 8v-.25l-2.157 2.157v1.75z" clipRule="evenodd" />
                          <path d="M2.293 2.293a1 1 0 011.414 0l14 14a1 1 0 01-1.414 1.414l-14-14a1 1 0 010-1.414z" />
                        </svg>
                        <span>מושתק</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Host Mute All Button */}
                {iAmHost && (
                  <button
                    type="button"
                    onClick={muteAll}
                    className="w-full rounded bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 py-1.5 text-center text-[10px] font-bold transition-all shadow flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    שקט בחדר! השתק את כולם
                  </button>
                )}

                {/* Remote Players Nearby List */}
                <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                  <span className="text-[9px] text-slate-400 font-bold mb-0.5" dir="rtl">שחקנים בטווח שמיעה</span>
                  
                  {playersList.length === 0 ? (
                    <span className="text-[10px] text-slate-500 italic py-1 text-center">אין שחקנים בטווח</span>
                  ) : (
                    (() => {
                      const listWithMetrics = playersList.map((player) => {
                        const metrics = getPlayerDistanceAndOcclusion(player.pos);
                        return { ...player, ...metrics };
                      });

                      // Sort by distance (closest first)
                      listWithMetrics.sort((a, b) => a.distance - b.distance);

                      return listWithMetrics.map((player) => {
                        const inRange = player.distance <= 32;
                        const isPlayerSpeaking = activeSpeakers.includes(player.userId);
                        const isMuffled = player.solidBlocks > 0;

                        return (
                          <div 
                            key={player.userId} 
                            className={`flex items-center justify-between rounded p-1.5 border transition-all ${
                              isPlayerSpeaking 
                                ? "bg-emerald-950/20 border-emerald-500/25" 
                                : inRange 
                                  ? "bg-white/5 border-white/5" 
                                  : "bg-black/10 border-white/5 opacity-55"
                            }`}
                          >
                            <div className="flex items-center gap-2 max-w-[65%]">
                              <div className={`relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[10px] font-bold text-slate-200 border ${
                                isPlayerSpeaking ? "border-emerald-400 bg-emerald-800" : "border-slate-600"
                              }`}>
                                {isPlayerSpeaking && (
                                  <span className="absolute inset-0 rounded-full bg-emerald-500/35 animate-ping" />
                                )}
                                {player.displayName.charAt(0)}
                              </div>
                              <span className="text-[11px] font-semibold text-slate-300 truncate" title={player.displayName}>
                                {player.displayName}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {/* Occlusion Icon */}
                              {inRange && isMuffled && (
                                <span 
                                  className="text-amber-400 shrink-0" 
                                  title={
                                    player.solidBlocks === 1 
                                      ? "עמום (בלוק אחד מפריד)" 
                                      : player.solidBlocks === 2 
                                        ? "עמום מאוד (שני בלוקים מפרידים)" 
                                        : `עמום כבד (${player.solidBlocks} בלוקים מפרידים)`
                                  }
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317 4.66-1.647 8-6.092 8-11.317 0-.681-.056-1.351-.166-2C17.834 5 10 1.944 10 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm-1-3a1 1 0 001-1V7a1 1 0 10-2 0v3a1 1 0 001 1z" clipRule="evenodd" />
                                  </svg>
                                </span>
                              )}

                              {/* Distance indicator */}
                              <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                {inRange ? `${Math.round(player.distance)}מ'` : "מחוץ לטווח"}
                              </span>
                            </div>
                          </div>
                        );
                      });
                    })()
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Minimized mic action button */
          <button
            type="button"
            onClick={toggleMute}
            className={`flex h-8 w-8 items-center justify-center rounded-full shadow-lg border transition-all hover:scale-105 cursor-pointer shrink-0 ${
              micEnabled
                ? activeSpeakers.includes(myUserId || "")
                  ? "bg-emerald-600 border-emerald-400 animate-pulse text-white"
                  : "bg-emerald-700/80 border-emerald-600 text-slate-100"
                : "bg-rose-700/90 border-rose-600 text-white"
            }`}
            title={micEnabled ? "הפעל שמע (M)" : "השתק שמע (M)"}
          >
            {micEnabled ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015 8a1 1 0 00-2 0 8 8 0 006.88 7.902V18H7a1 1 0 100 2h6a1 1 0 100-2h-2.12v-2.11a5.975 5.975 0 012.597-1zM4 8a4 4 0 017.75-1.39l-1.042 1.043A2.5 2.5 0 006.5 8a.5.5 0 00-1 0zm7.843 3.657l1.414-1.414A5.96 5.96 0 0014 8v-.25l-2.157 2.157v1.75z" clipRule="evenodd" />
                <path d="M2.293 2.293a1 1 0 011.414 0l14 14a1 1 0 01-1.414 1.414l-14-14a1 1 0 010-1.414z" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
});
