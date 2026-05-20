import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useVoxelSocket } from "@/hooks/useVoxelSocket";
import { MinecraftClient } from "@/games/MinecraftClient";
import type {
  CraftingGridSlot,
  GameMode,
  InventoryMoveReq,
  ItemSlot,
  RoomEvent,
  Vec3
} from "@/lib/voxelProtocol";
import {
  BLOCK_REGISTRY,
  CRAFTING_GRID_SLOTS,
  EQUIPMENT_SLOT_COUNT,
  MAIN_ITEM_INVENTORY_SLOTS
} from "@/lib/voxelProtocol";

function emptyClientItemInv(): ItemSlot[] {
  return Array.from({ length: MAIN_ITEM_INVENTORY_SLOTS }, () => ({
    itemId: 0,
    count: 0
  }));
}

function emptyClientCrafting(): CraftingGridSlot[] {
  return Array.from({ length: CRAFTING_GRID_SLOTS }, () => ({
    blockId: BLOCK_REGISTRY.AIR,
    itemId: 0,
    count: 0
  }));
}

function emptyClientEquipment(): ItemSlot[] {
  return Array.from({ length: EQUIPMENT_SLOT_COUNT }, () => ({
    itemId: 0,
    count: 0
  }));
}

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

  const [paused, setPaused] = useState(false);
  const [hostId, setHostId] = useState<string | null>(null);
  const [liveGameMode, setLiveGameMode] = useState<GameMode>("creative");
  const [endOverlay, setEndOverlay] = useState<
    null | { kind: "stopped"; by?: string }
  >(null);
  const [toast, setToast] = useState<string | null>(null);
  const [roomIsOpen, setRoomIsOpen] = useState<boolean | null>(null);
  const [invitationCode, setInvitationCode] = useState<string | null>(null);
  const [updatingVisibility, setUpdatingVisibility] = useState(false);
  const [inviteFallbackLink, setInviteFallbackLink] = useState<string | null>(null);

  const {
    connected,
    status,
    joinAck,
    sendInput,
    placeBlock,
    breakBlock,
    breakStart,
    breakFinish,
    breakCancel,
    pause,
    resume,
    stop,
    leave,
    onSnapshot,
    onBlockDelta,
    onRoomEvent,
    serverInventory,
    serverItemInventory,
    serverEquipmentSlots,
    serverCraftingGrid,
    serverCraftingGridWidth,
    craft,
    inventoryMove,
    openCraftingTable,
    closeCraftingTable,
    setGameMode,
    dropHotbarItem,
    onWorldDropSpawned,
    onWorldDropRemoved,
    onWorldDropUpdated
  } = useVoxelSocket({
    sessionId,
    suppressInputEmit: paused || isTeacherObserver
  });

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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("game_sessions")
        .select("is_open, invitation_code")
        .eq("id", sessionId)
        .maybeSingle();
      if (cancelled || error || !data) return;
      setRoomIsOpen(data.is_open);
      setInvitationCode(data.invitation_code);
    })();

    const channel = supabase
      .channel(`minecraft-session-privacy:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_sessions",
          filter: `id=eq.${sessionId}`
        },
        (payload) => {
          const next = payload.new as {
            is_open?: boolean;
            invitation_code?: string;
          };
          if (typeof next.is_open === "boolean") {
            setRoomIsOpen(next.is_open);
          }
          if (typeof next.invitation_code === "string") {
            setInvitationCode(next.invitation_code);
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [sessionId]);

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
  const handleBreakStart = useCallback(
    (pos: Vec3) => breakStart(pos),
    [breakStart]
  );
  const handleBreakFinish = useCallback(
    (pos: Vec3) => breakFinish(pos),
    [breakFinish]
  );
  const handleBreakCancel = useCallback(
    (pos: Vec3) => {
      breakCancel(pos);
    },
    [breakCancel]
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

  const handleCraft = useCallback((recipeId: string) => {
    void craft(recipeId);
  }, [craft]);

  const handleOpenCraftingTable = useCallback(
    (pos: Vec3) => openCraftingTable(pos),
    [openCraftingTable]
  );

  const handleCloseCraftingTable = useCallback(
    () => closeCraftingTable(),
    [closeCraftingTable]
  );

  const handleInventoryMove = useCallback(
    (req: InventoryMoveReq) => {
      void inventoryMove(req).then((ack) => {
        if (!ack.ok) setToast(ack.error?.message ?? "לא ניתן להעביר פריט");
      });
    },
    [inventoryMove]
  );

  const handleExit = useCallback(async () => {
    await leave();
    navigate(isTeacherObserver ? "/teacher" : "/home");
  }, [leave, navigate, isTeacherObserver]);

  const toggleRoomVisibility = useCallback(async () => {
    if (!myUserId || !hostId || myUserId !== hostId || roomIsOpen === null) return;
    setUpdatingVisibility(true);
    setInviteFallbackLink(null);
    const { data, error } = await supabase
      .from("game_sessions")
      .update({ is_open: !roomIsOpen })
      .eq("id", sessionId)
      .eq("host_id", myUserId)
      .select("is_open")
      .maybeSingle();
    setUpdatingVisibility(false);
    if (error || !data) {
      setToast(error?.message ?? "עדכון פרטיות נכשל");
      return;
    }
    setRoomIsOpen(data.is_open);
    setToast(data.is_open ? "החדר פתוח להצטרפות" : "החדר פרטי עכשיו");
  }, [hostId, myUserId, roomIsOpen, sessionId]);

  const copyInviteLink = useCallback(async () => {
    if (!invitationCode) return;
    const inviteUrl = `${window.location.origin}/join/${invitationCode}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setInviteFallbackLink(null);
      setToast("קישור ההזמנה הועתק");
    } catch {
      setInviteFallbackLink(inviteUrl);
      setToast("אי אפשר להעתיק אוטומטית בדפדפן הזה");
    }
  }, [invitationCode]);

  const handleDropHotbar = useCallback(
    (hotbarIndex: number) => {
      void dropHotbarItem(hotbarIndex);
    },
    [dropHotbarItem]
  );

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
        itemInventorySlots={
          liveGameMode === "survival" ? serverItemInventory : emptyClientItemInv()
        }
        equipmentSlots={
          liveGameMode === "survival" ? serverEquipmentSlots : emptyClientEquipment()
        }
        craftingGridSlots={
          liveGameMode === "survival" ? serverCraftingGrid : emptyClientCrafting()
        }
        craftingGridWidth={
          liveGameMode === "survival" ? serverCraftingGridWidth : 2
        }
        onInventoryMove={handleInventoryMove}
        onCraft={handleCraft}
        onOpenCraftingTable={handleOpenCraftingTable}
        onCloseCraftingTable={handleCloseCraftingTable}
        onInput={sendInput}
        onBlockPlace={handlePlaceBlock}
        onBlockBreak={handleBreakBlock}
        onBreakStart={handleBreakStart}
        onBreakFinish={handleBreakFinish}
        onBreakCancel={handleBreakCancel}
        initialWorldDrops={joinAck.drops ?? []}
        registerWorldDropSpawned={onWorldDropSpawned}
        registerWorldDropRemoved={onWorldDropRemoved}
        registerWorldDropUpdated={onWorldDropUpdated}
        onDropHotbarSlot={handleDropHotbar}
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

      {/* dir=ltr keeps flex cross-axis "end" on the physical right when the app is rtl */}
      <div
        dir="ltr"
        className="pointer-events-auto absolute right-4 top-4 flex w-max max-w-[min(100vw-2rem,280px)] flex-col items-end gap-2 text-xs font-semibold text-white"
      >
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

      {iAmHost && !endOverlay ? (
        <div
          dir="ltr"
          className="pointer-events-auto absolute bottom-4 right-4 flex w-[min(100vw-2rem,280px)] flex-col items-stretch gap-2 text-xs font-semibold text-white"
        >
          <div className="rounded-xl border border-white/20 bg-slate-900/90 p-3 text-[11px] font-bold shadow-lg">
            <p className="text-right text-white" dir="rtl">
              {roomIsOpen === null ? "טוען פרטיות…" : roomIsOpen ? "חדר פתוח" : "חדר פרטי"}
            </p>
            <div className="mt-2 flex flex-wrap justify-end gap-2" dir="rtl">
              <button
                type="button"
                className="rounded-lg border border-slate-400 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                disabled={updatingVisibility || roomIsOpen === null}
                onClick={() => void toggleRoomVisibility()}
              >
                {updatingVisibility ? "מעדכן…" : roomIsOpen ? "הפוך לפרטי" : "הפוך לפתוח"}
              </button>
              <button
                type="button"
                className="rounded-lg border border-indigo-300 bg-indigo-100 px-2.5 py-1.5 text-[11px] font-bold text-indigo-900 hover:bg-indigo-200 disabled:opacity-50"
                disabled={!invitationCode}
                onClick={() => void copyInviteLink()}
              >
                העתק הזמנה
              </button>
            </div>
          </div>
          {inviteFallbackLink ? (
            <p
              className="break-all rounded-xl border border-indigo-300 bg-indigo-950/90 px-2 py-1.5 text-right text-[10px] text-indigo-100"
              dir="rtl"
            >
              {inviteFallbackLink}
            </p>
          ) : null}
        </div>
      ) : null}

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
