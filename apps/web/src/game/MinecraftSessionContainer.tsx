import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useVoxelSocket } from "@/hooks/useVoxelSocket";
import { MinecraftClient } from "@/games/MinecraftClient";
import type { GameMode, RoomEvent, Vec3 } from "@/lib/voxelProtocol";

export interface MinecraftSessionContainerProps {
  sessionId: string;
}

/**
 * Mirrors the lifecycle UX of `GameSessionContainer` but renders the
 * fullscreen voxel client instead of a board. It only owns
 * stateful concerns (auth check, recess banner, pause/stop overlays);
 * the actual game render is delegated to the dumb `MinecraftClient`.
 */
export function MinecraftSessionContainer(props: MinecraftSessionContainerProps): JSX.Element {
  const { sessionId } = props;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile(user);
  const isTeacherObserver = profile?.role === "teacher";
  const myUserId = user?.id ?? null;

  const {
    connected,
    status,
    joinAck,
    sendInput,
    placeBlock,
    breakBlock,
    pause,
    resume,
    stop,
    leave,
    onSnapshot,
    onBlockDelta,
    onRoomEvent,
    serverInventory,
    setGameMode
  } = useVoxelSocket({ sessionId });

  const [paused, setPaused] = useState(false);
  const [hostId, setHostId] = useState<string | null>(null);
  const [liveGameMode, setLiveGameMode] = useState<GameMode>("creative");
  const [endOverlay, setEndOverlay] = useState<
    null | { kind: "stopped"; by?: string }
  >(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!joinAck) return;
    setPaused(joinAck.paused);
    setHostId(joinAck.hostId);
    setLiveGameMode(joinAck.gameMode);
  }, [joinAck]);

  useEffect(() => {
    const off = onRoomEvent((ev: RoomEvent) => {
      switch (ev.kind) {
        case "GAME_PAUSED":
          setPaused(true);
          setToast("המשחק הושהה");
          return;
        case "GAME_RESUMED":
          setPaused(false);
          setToast("המשחק חודש");
          return;
        case "GAME_STOPPED":
          setEndOverlay({ kind: "stopped", by: ev.stoppedBy });
          return;
        case "HOST_LEFT":
          setHostId(ev.newHostId ?? null);
          setToast("המארח עזב — הקברניט הוחלף");
          return;
        case "RECESS_ENDED":
          setToast("ההפסקה הסתיימה");
          return;
        case "PLAYER_JOINED":
          setToast(`${ev.player?.displayName ?? "שחקן"} הצטרף`);
          return;
        case "PLAYER_LEFT":
          setToast(`${ev.player?.displayName ?? "שחקן"} עזב`);
          return;
        case "GAME_MODE_CHANGED":
          setLiveGameMode(ev.gameMode);
          setToast(ev.gameMode === "survival" ? "מצב שרדות" : "מצב יצירתי");
          return;
      }
    });
    return off;
  }, [onRoomEvent]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const iAmHost = !isTeacherObserver && myUserId !== null && myUserId === hostId;

  const handlePlaceBlock = useCallback(
    (pos: Vec3, blockId: number) => {
      void placeBlock(pos, blockId);
    },
    [placeBlock]
  );
  const handleBreakBlock = useCallback(
    (pos: Vec3) => {
      void breakBlock(pos);
    },
    [breakBlock]
  );

  const handlePause = useCallback(async () => {
    const ack = await pause();
    if (!ack.ok) setToast(ack.error?.message ?? "השהיה נכשלה");
  }, [pause]);
  const handleResume = useCallback(async () => {
    const ack = await resume();
    if (!ack.ok) setToast(ack.error?.message ?? "חידוש נכשל");
  }, [resume]);
  const handleStop = useCallback(async () => {
    const ack = await stop();
    if (!ack.ok) setToast(ack.error?.message ?? "סיום נכשל");
  }, [stop]);

  const handleSetCreative = useCallback(async () => {
    const ack = await setGameMode("creative");
    if (!ack.ok) setToast(ack.error?.message ?? "נכשל");
  }, [setGameMode]);
  const handleSetSurvival = useCallback(async () => {
    const ack = await setGameMode("survival");
    if (!ack.ok) setToast(ack.error?.message ?? "נכשל");
  }, [setGameMode]);

  const handleExit = useCallback(async () => {
    await leave();
    navigate(isTeacherObserver ? "/teacher" : "/home");
  }, [leave, navigate, isTeacherObserver]);

  const fullName = useMemo(() => profile?.full_name ?? "שחקן", [profile]);
  void fullName;
  void supabase;

  if (!connected || !joinAck) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900 text-slate-100">
        <p className="text-sm font-bold">{status}</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 bg-black">
      <MinecraftClient
        seed={joinAck.seed}
        initialDeltas={joinAck.deltas}
        mySpawn={joinAck.spawn}
        paused={paused || isTeacherObserver}
        roster={joinAck.roster}
        myUserId={myUserId}
        gameMode={liveGameMode}
        inventorySlots={serverInventory}
        onInput={sendInput}
        onBlockPlace={handlePlaceBlock}
        onBlockBreak={handleBreakBlock}
        registerSnapshotListener={onSnapshot}
        registerBlockDeltaListener={onBlockDelta}
      />

      <div className="pointer-events-none absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80" />

      {toast ? (
        <div
          role="status"
          className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 rounded-xl bg-amber-100/95 px-4 py-2 text-sm font-bold text-amber-900 shadow"
        >
          {toast}
        </div>
      ) : null}

      <div className="absolute right-4 top-4 flex flex-col items-end gap-2 text-xs font-semibold text-white">
        <button
          type="button"
          onClick={() => void handleExit()}
          className="rounded-lg bg-slate-900/80 px-3 py-2 hover:bg-slate-700"
        >
          יציאה
        </button>
        {iAmHost && !endOverlay ? (
          <>
            <button
              type="button"
              onClick={() => void handleSetCreative()}
              disabled={liveGameMode === "creative"}
              className="rounded-lg bg-emerald-800/90 px-3 py-2 hover:bg-emerald-700 disabled:opacity-50"
            >
              יצירתי
            </button>
            <button
              type="button"
              onClick={() => void handleSetSurvival()}
              disabled={liveGameMode === "survival"}
              className="rounded-lg bg-teal-800/90 px-3 py-2 hover:bg-teal-700 disabled:opacity-50"
            >
              שרדות
            </button>
            <button
              type="button"
              onClick={() => (paused ? void handleResume() : void handlePause())}
              className="rounded-lg bg-amber-600/90 px-3 py-2 hover:bg-amber-500"
            >
              {paused ? "המשך" : "השהה"}
            </button>
            <button
              type="button"
              onClick={() => void handleStop()}
              className="rounded-lg bg-rose-700/90 px-3 py-2 hover:bg-rose-600"
            >
              סיים
            </button>
          </>
        ) : null}
      </div>

      {paused && !endOverlay ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center">
          <p className="rounded-xl bg-amber-100/95 px-4 py-2 text-sm font-bold text-amber-900 shadow">
            המשחק מושהה
          </p>
        </div>
      ) : null}

      {endOverlay ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
          <div className="rounded-2xl bg-white p-6 text-center text-slate-900 shadow-2xl">
            <p className="text-lg font-black">המשחק נעצר</p>
            <button
              type="button"
              onClick={() => void handleExit()}
              className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-500"
            >
              {isTeacherObserver ? "חזרה ללוח המורה" : "חזרה הביתה"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default MinecraftSessionContainer;
