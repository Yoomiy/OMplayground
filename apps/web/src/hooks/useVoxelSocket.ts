import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { supabase } from "@/lib/supabase";
import { getVoxelServerUrl } from "@/lib/voxelServerUrl";
import type {
  ArmSwingPayload,
  BlockDelta,
  BreakStartAck,
  ChestSlot,
  ChestSyncPayload,
  CraftAck,
  CraftingGridWidth,
  CraftingGridSlot,
  EatStartAck,
  GameMode,
  HotbarSlot,
  InputReq,
  InventoryMoveReq,
  InventorySyncPayload,
  ItemSlot,
  JoinRoomAck,
  JoinRoomAckOk,
  OpenChestAck,
  PlayerDamagePayload,
  PlayerVitals,
  RoomEvent,
  RoomSnapshot,
  SimpleAck,
  Vec3,
  WorldDrop,
  WorldDropWireDelta
} from "@/lib/voxelProtocol";
import {
  BLOCK_REGISTRY,
  CHEST_SLOT_COUNT,
  CRAFTING_GRID_SLOTS,
  EQUIPMENT_SLOT_COUNT,
  MAIN_ITEM_INVENTORY_SLOTS
} from "@/lib/voxelProtocol";

/**
 * Owns the Socket.IO connection to the voxel game server. Stays a thin
 * data layer: no Babylon/noa imports, no UI logic. The container component
 * passes the typed callbacks into the dumb `MinecraftClient` board.
 *
 * INPUT is throttled to `INPUT_INTERVAL_MS` and only emitted when the
 * payload meaningfully changes (and not while `suppressInputEmit` is true).
 */

const INPUT_INTERVAL_MS = 66;
const POS_EPS = 0.02;
const HEADING_EPS = 0.002;

function emptyItemSlots(): ItemSlot[] {
  return Array.from({ length: MAIN_ITEM_INVENTORY_SLOTS }, () => ({
    itemId: 0,
    count: 0
  }));
}

function emptyCraftingSlots(): CraftingGridSlot[] {
  return Array.from({ length: CRAFTING_GRID_SLOTS }, () => ({
    blockId: BLOCK_REGISTRY.AIR,
    itemId: 0,
    count: 0
  }));
}

function emptyEquipmentSlots(): ItemSlot[] {
  return Array.from({ length: EQUIPMENT_SLOT_COUNT }, () => ({ itemId: 0, count: 0 }));
}

function emptyChestSlots(): ChestSlot[] {
  return Array.from({ length: CHEST_SLOT_COUNT }, () => ({
    blockId: BLOCK_REGISTRY.AIR,
    itemId: 0,
    count: 0
  }));
}

function emptyVitals(): PlayerVitals {
  return {
    health: 20,
    hunger: 20,
    saturation: 5,
    exhaustion: 0
  };
}

function inputWireEqual(a: InputReq, b: InputReq): boolean {
  return (
    Math.abs(a.pos[0] - b.pos[0]) <= POS_EPS &&
    Math.abs(a.pos[1] - b.pos[1]) <= POS_EPS &&
    Math.abs(a.pos[2] - b.pos[2]) <= POS_EPS &&
    Math.abs(a.heading - b.heading) <= HEADING_EPS &&
    Math.abs((a.pitch ?? 0) - (b.pitch ?? 0)) <= HEADING_EPS &&
    a.jumping === b.jumping &&
    a.hotbarIndex === b.hotbarIndex
  );
}

export type SnapshotListener = (snap: RoomSnapshot) => void;
export type BlockDeltaListener = (delta: BlockDelta) => void;
export type RoomEventListener = (ev: RoomEvent) => void;
export type WorldDropSpawnListener = (drop: WorldDrop) => void;
export type WorldDropRemovedListener = (id: string) => void;
export type WorldDropUpdateListener = (updates: WorldDropWireDelta[]) => void;
export type ArmSwingListener = (payload: ArmSwingPayload) => void;
export type PlayerDamageListener = (payload: PlayerDamagePayload) => void;

export interface UseVoxelSocketArgs {
  sessionId: string;
  /** When true, INPUT is not sent (paused room, teacher observer, etc.). */
  suppressInputEmit?: boolean;
}

export interface UseVoxelSocketReturn {
  connected: boolean;
  status: string;
  joinAck: JoinRoomAckOk | null;
  sendInput: (input: InputReq) => void;
  placeBlock: (pos: Vec3, blockId: number) => Promise<SimpleAck>;
  breakBlock: (pos: Vec3) => Promise<SimpleAck>;
  breakStart: (pos: Vec3) => Promise<BreakStartAck>;
  breakFinish: (pos: Vec3) => Promise<SimpleAck>;
  breakCancel: (pos: Vec3) => void;
  armSwing: () => void;
  fallImpact: (velocityY: number) => Promise<SimpleAck>;
  playerAttack: (targetUserId: string) => Promise<SimpleAck>;
  craft: (recipeId: string) => Promise<CraftAck>;
  pause: () => Promise<SimpleAck>;
  resume: () => Promise<SimpleAck>;
  stop: () => Promise<SimpleAck>;
  leave: () => Promise<SimpleAck>;
  onSnapshot: (cb: SnapshotListener) => () => void;
  onBlockDelta: (cb: BlockDeltaListener) => () => void;
  onRoomEvent: (cb: RoomEventListener) => () => void;
  onArmSwing: (cb: ArmSwingListener) => () => void;
  onPlayerDamage: (cb: PlayerDamageListener) => () => void;
  serverInventory: HotbarSlot[];
  serverItemInventory: ItemSlot[];
  serverEquipmentSlots: ItemSlot[];
  serverCraftingGrid: CraftingGridSlot[];
  serverCraftingGridWidth: CraftingGridWidth;
  serverVitals: PlayerVitals;
  serverChest: { pos: Vec3; slots: ChestSlot[] } | null;
  inventoryMove: (req: InventoryMoveReq) => Promise<SimpleAck>;
  openCraftingTable: (pos: Vec3) => Promise<SimpleAck>;
  closeCraftingTable: () => Promise<SimpleAck>;
  openChest: (pos: Vec3) => Promise<OpenChestAck>;
  closeChest: () => Promise<SimpleAck>;
  chestMove: (req: InventoryMoveReq) => Promise<SimpleAck>;
  eatStart: (hotbarIndex: number) => Promise<EatStartAck>;
  eatFinish: (hotbarIndex: number) => Promise<SimpleAck>;
  eatCancel: () => Promise<SimpleAck>;
  setGameMode: (mode: GameMode) => Promise<SimpleAck>;
  /** Survival: drop one block from hotbar near the player. */
  dropHotbarItem: (hotbarIndex: number) => Promise<SimpleAck>;
  onWorldDropSpawned: (cb: WorldDropSpawnListener) => () => void;
  onWorldDropRemoved: (cb: WorldDropRemovedListener) => () => void;
  onWorldDropUpdated: (cb: WorldDropUpdateListener) => () => void;
}

function emitWithAck<T>(socket: Socket, event: string, payload: unknown): Promise<T> {
  return new Promise<T>((resolve) => {
    socket.emit(event, payload, (ack: T) => resolve(ack));
  });
}

export function useVoxelSocket(
  args: UseVoxelSocketArgs
): UseVoxelSocketReturn {
  const { sessionId, suppressInputEmit = false } = args;
  const suppressInputRef = useRef(suppressInputEmit);
  suppressInputRef.current = suppressInputEmit;
  const socketRef = useRef<Socket | null>(null);
  const lastInputRef = useRef<InputReq | null>(null);
  const lastSentAtRef = useRef<number>(0);
  const lastEmittedInputRef = useRef<InputReq | null>(null);
  const snapshotListeners = useRef(new Set<SnapshotListener>());
  const blockDeltaListeners = useRef(new Set<BlockDeltaListener>());
  const roomEventListeners = useRef(new Set<RoomEventListener>());
  const worldDropSpawnListeners = useRef(new Set<WorldDropSpawnListener>());
  const worldDropRemovedListeners = useRef(new Set<WorldDropRemovedListener>());
  const worldDropUpdateListeners = useRef(new Set<WorldDropUpdateListener>());
  const armSwingListeners = useRef(new Set<ArmSwingListener>());
  const playerDamageListeners = useRef(new Set<PlayerDamageListener>());

  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<string>("מתחבר…");
  const [joinAck, setJoinAck] = useState<JoinRoomAckOk | null>(null);
  const [serverInventory, setServerInventory] = useState<HotbarSlot[]>([]);
  const [serverItemInventory, setServerItemInventory] = useState<ItemSlot[]>(
    () => emptyItemSlots()
  );
  const [serverEquipmentSlots, setServerEquipmentSlots] = useState<ItemSlot[]>(
    () => emptyEquipmentSlots()
  );
  const [serverCraftingGrid, setServerCraftingGrid] = useState<CraftingGridSlot[]>(
    () => emptyCraftingSlots()
  );
  const [serverCraftingGridWidth, setServerCraftingGridWidth] =
    useState<CraftingGridWidth>(2);
  const [serverVitals, setServerVitals] = useState<PlayerVitals>(() => emptyVitals());
  const [serverChest, setServerChest] =
    useState<{ pos: Vec3; slots: ChestSlot[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    lastInputRef.current = null;
    lastEmittedInputRef.current = null;
    lastSentAtRef.current = 0;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setStatus("אין סשן — התחבר מחדש.");
        return;
      }
      if (cancelled) return;

      const s = io(getVoxelServerUrl(), {
        auth: { token },
        reconnectionAttempts: 2,
        reconnectionDelay: 1500,
        transports: ["websocket"]
      });
      socketRef.current = s;

      s.on("connect", async () => {
        setConnected(true);
        setStatus("מחובר");
        const ack = (await emitWithAck<JoinRoomAck>(s, "JOIN_ROOM", {
          sessionId
        })) as JoinRoomAck;
        if (!ack?.ok) {
          setStatus(ack?.error?.message ?? "הצטרפות לחדר נכשלה");
          return;
        }
        setJoinAck(ack);
        setServerInventory(ack.inventory ?? []);
        setServerItemInventory(
          ack.itemInventory?.length === MAIN_ITEM_INVENTORY_SLOTS
            ? ack.itemInventory
            : emptyItemSlots()
        );
        setServerEquipmentSlots(
          ack.equipmentSlots?.length === EQUIPMENT_SLOT_COUNT
            ? ack.equipmentSlots
            : emptyEquipmentSlots()
        );
        setServerCraftingGrid(
          ack.craftingGrid?.length === CRAFTING_GRID_SLOTS
            ? ack.craftingGrid
            : emptyCraftingSlots()
        );
        setServerCraftingGridWidth(ack.craftingGridWidth ?? 2);
        setServerVitals(ack.vitals ?? emptyVitals());
      });

      s.on("INVENTORY_SYNC", (payload: InventorySyncPayload) => {
        if (payload?.slots && Array.isArray(payload.slots)) {
          setServerInventory(payload.slots);
        }
        if (
          payload?.itemSlots &&
          Array.isArray(payload.itemSlots) &&
          payload.itemSlots.length === MAIN_ITEM_INVENTORY_SLOTS
        ) {
          setServerItemInventory(payload.itemSlots);
        }
        if (
          payload?.equipmentSlots &&
          Array.isArray(payload.equipmentSlots) &&
          payload.equipmentSlots.length === EQUIPMENT_SLOT_COUNT
        ) {
          setServerEquipmentSlots(payload.equipmentSlots);
        }
        if (
          payload?.craftingSlots &&
          Array.isArray(payload.craftingSlots) &&
          payload.craftingSlots.length === CRAFTING_GRID_SLOTS
        ) {
          setServerCraftingGrid(payload.craftingSlots);
        }
        if (payload?.craftingGridWidth === 2 || payload?.craftingGridWidth === 3) {
          setServerCraftingGridWidth(payload.craftingGridWidth);
        }
        if (payload?.vitals) {
          setServerVitals(payload.vitals);
        }
      });

      s.on("CHEST_SYNC", (payload: ChestSyncPayload) => {
        if (
          payload?.pos &&
          Array.isArray(payload.slots) &&
          payload.slots.length === CHEST_SLOT_COUNT
        ) {
          setServerChest({ pos: payload.pos, slots: payload.slots });
        }
      });

      s.on("ROOM_SNAPSHOT", (payload: RoomSnapshot) => {
        for (const cb of snapshotListeners.current) cb(payload);
      });
      s.on("BLOCK_DELTA", (payload: BlockDelta) => {
        for (const cb of blockDeltaListeners.current) cb(payload);
      });
      s.on("PLAYER_ARM_SWING", (payload: ArmSwingPayload) => {
        for (const cb of armSwingListeners.current) cb(payload);
      });
      s.on("PLAYER_DAMAGE", (payload: PlayerDamagePayload) => {
        for (const cb of playerDamageListeners.current) cb(payload);
      });
      s.on("ROOM_EVENT", (payload: RoomEvent) => {
        if (payload.kind === "WORLD_DROP_SPAWNED") {
          for (const cb of worldDropSpawnListeners.current) cb(payload.drop);
        }
        if (payload.kind === "WORLD_DROP_REMOVED") {
          for (const cb of worldDropRemovedListeners.current) cb(payload.id);
        }
        if (payload.kind === "WORLD_DROP_UPDATE") {
          for (const cb of worldDropUpdateListeners.current) cb(payload.updates);
        }
        if (payload.kind === "CHEST_CLOSED") {
          setServerChest((prev) =>
            prev &&
            prev.pos[0] === payload.pos[0] &&
            prev.pos[1] === payload.pos[1] &&
            prev.pos[2] === payload.pos[2]
              ? null
              : prev
          );
        }
        for (const cb of roomEventListeners.current) cb(payload);
      });

      s.on("disconnect", () => {
        setConnected(false);
      });

      s.on("connect_error", (err: Error) => {
        setStatus(`שגיאת חיבור: ${err.message}`);
      });
    })();

    const inputTimer = window.setInterval(() => {
      const s = socketRef.current;
      const last = lastInputRef.current;
      if (!s?.connected || !last) return;
      if (suppressInputRef.current) return;
      const prev = lastEmittedInputRef.current;
      if (prev && inputWireEqual(prev, last)) return;
      const now = performance.now();
      if (now - lastSentAtRef.current < INPUT_INTERVAL_MS) return;
      lastSentAtRef.current = now;
      lastEmittedInputRef.current = last;
      s.emit("INPUT", last);
    }, INPUT_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(inputTimer);
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [sessionId]);

  function sendInput(input: InputReq): void {
    lastInputRef.current = input;
  }

  async function placeBlock(pos: Vec3, blockId: number): Promise<SimpleAck> {
    const s = socketRef.current;
    if (!s?.connected) return { ok: false, error: { code: "DISCONNECTED", message: "לא מחובר" } };
    return emitWithAck<SimpleAck>(s, "BLOCK_PLACE", { pos, blockId });
  }

  async function breakBlock(pos: Vec3): Promise<SimpleAck> {
    const s = socketRef.current;
    if (!s?.connected) return { ok: false, error: { code: "DISCONNECTED", message: "לא מחובר" } };
    return emitWithAck<SimpleAck>(s, "BLOCK_BREAK", { pos });
  }

  async function breakStart(pos: Vec3): Promise<BreakStartAck> {
    const s = socketRef.current;
    if (!s?.connected) {
      return { ok: false, error: { code: "DISCONNECTED", message: "לא מחובר" } };
    }
    return emitWithAck<BreakStartAck>(s, "BREAK_START", { pos });
  }

  async function breakFinish(pos: Vec3): Promise<SimpleAck> {
    const s = socketRef.current;
    if (!s?.connected) return { ok: false, error: { code: "DISCONNECTED", message: "לא מחובר" } };
    return emitWithAck<SimpleAck>(s, "BREAK_FINISH", { pos });
  }

  function breakCancel(pos: Vec3): void {
    const s = socketRef.current;
    if (!s?.connected) return;
    s.emit("BREAK_CANCEL", { pos });
  }

  function armSwing(): void {
    const s = socketRef.current;
    if (!s?.connected) return;
    s.emit("ARM_SWING", {});
  }

  async function fallImpact(velocityY: number): Promise<SimpleAck> {
    const s = socketRef.current;
    if (!s?.connected) return { ok: false, error: { code: "DISCONNECTED", message: "לא מחובר" } };
    return emitWithAck<SimpleAck>(s, "FALL_IMPACT", { velocityY });
  }

  async function playerAttack(targetUserId: string): Promise<SimpleAck> {
    const s = socketRef.current;
    if (!s?.connected) return { ok: false, error: { code: "DISCONNECTED", message: "לא מחובר" } };
    return emitWithAck<SimpleAck>(s, "PLAYER_ATTACK", { targetUserId });
  }

  async function craft(recipeId: string): Promise<CraftAck> {
    const s = socketRef.current;
    if (!s?.connected) return { ok: false, error: { code: "DISCONNECTED", message: "לא מחובר" } };
    return emitWithAck<CraftAck>(s, "CRAFT", { recipeId });
  }

  async function inventoryMove(req: InventoryMoveReq): Promise<SimpleAck> {
    const s = socketRef.current;
    if (!s?.connected) return { ok: false, error: { code: "DISCONNECTED", message: "לא מחובר" } };
    return emitWithAck<SimpleAck>(s, "INVENTORY_MOVE", req);
  }

  async function openCraftingTable(pos: Vec3): Promise<SimpleAck> {
    const s = socketRef.current;
    if (!s?.connected) return { ok: false, error: { code: "DISCONNECTED", message: "לא מחובר" } };
    return emitWithAck<SimpleAck>(s, "OPEN_CRAFTING_TABLE", { pos });
  }

  async function closeCraftingTable(): Promise<SimpleAck> {
    const s = socketRef.current;
    if (!s?.connected) return { ok: true };
    return emitWithAck<SimpleAck>(s, "CLOSE_CRAFTING_TABLE", {});
  }

  async function openChest(pos: Vec3): Promise<OpenChestAck> {
    const s = socketRef.current;
    if (!s?.connected) {
      return { ok: false, error: { code: "DISCONNECTED", message: "לא מחובר" } };
    }
    const ack = await emitWithAck<OpenChestAck>(s, "OPEN_CHEST", { pos });
    if (ack.ok) {
      setServerChest({
        pos: ack.pos ?? pos,
        slots:
          ack.slots?.length === CHEST_SLOT_COUNT ? ack.slots : emptyChestSlots()
      });
    }
    return ack;
  }

  async function closeChest(): Promise<SimpleAck> {
    const s = socketRef.current;
    setServerChest(null);
    if (!s?.connected) return { ok: true };
    return emitWithAck<SimpleAck>(s, "CLOSE_CHEST", {});
  }

  async function chestMove(req: InventoryMoveReq): Promise<SimpleAck> {
    const s = socketRef.current;
    if (!s?.connected) {
      return { ok: false, error: { code: "DISCONNECTED", message: "לא מחובר" } };
    }
    return emitWithAck<SimpleAck>(s, "CHEST_MOVE", req);
  }

  async function eatStart(hotbarIndex: number): Promise<EatStartAck> {
    const s = socketRef.current;
    if (!s?.connected) {
      return { ok: false, error: { code: "DISCONNECTED", message: "לא מחובר" } };
    }
    return emitWithAck<EatStartAck>(s, "EAT_START", { hotbarIndex });
  }

  async function eatFinish(hotbarIndex: number): Promise<SimpleAck> {
    const s = socketRef.current;
    if (!s?.connected) {
      return { ok: false, error: { code: "DISCONNECTED", message: "לא מחובר" } };
    }
    return emitWithAck<SimpleAck>(s, "EAT_FINISH", { hotbarIndex });
  }

  async function eatCancel(): Promise<SimpleAck> {
    const s = socketRef.current;
    if (!s?.connected) return { ok: true };
    return emitWithAck<SimpleAck>(s, "EAT_CANCEL", {});
  }

  async function pause(): Promise<SimpleAck> {
    const s = socketRef.current;
    if (!s?.connected) return { ok: false, error: { code: "DISCONNECTED", message: "לא מחובר" } };
    return emitWithAck<SimpleAck>(s, "PAUSE_GAME", { sessionId });
  }

  async function resume(): Promise<SimpleAck> {
    const s = socketRef.current;
    if (!s?.connected) return { ok: false, error: { code: "DISCONNECTED", message: "לא מחובר" } };
    return emitWithAck<SimpleAck>(s, "RESUME_GAME", { sessionId });
  }

  async function stop(): Promise<SimpleAck> {
    const s = socketRef.current;
    if (!s?.connected) return { ok: false, error: { code: "DISCONNECTED", message: "לא מחובר" } };
    return emitWithAck<SimpleAck>(s, "STOP_GAME", { sessionId });
  }

  async function leave(): Promise<SimpleAck> {
    const s = socketRef.current;
    if (!s?.connected) return { ok: true };
    return emitWithAck<SimpleAck>(s, "LEAVE_ROOM", { sessionId });
  }

  async function setGameMode(mode: GameMode): Promise<SimpleAck> {
    const s = socketRef.current;
    if (!s?.connected) return { ok: false, error: { code: "DISCONNECTED", message: "לא מחובר" } };
    return emitWithAck<SimpleAck>(s, "SET_GAME_MODE", { sessionId, gameMode: mode });
  }

  async function dropHotbarItem(hotbarIndex: number): Promise<SimpleAck> {
    const s = socketRef.current;
    if (!s?.connected) return { ok: false, error: { code: "DISCONNECTED", message: "לא מחובר" } };
    return emitWithAck<SimpleAck>(s, "DROP_ITEM_REQ", { hotbarIndex });
  }

  function onSnapshot(cb: SnapshotListener): () => void {
    snapshotListeners.current.add(cb);
    return () => {
      snapshotListeners.current.delete(cb);
    };
  }
  function onBlockDelta(cb: BlockDeltaListener): () => void {
    blockDeltaListeners.current.add(cb);
    return () => {
      blockDeltaListeners.current.delete(cb);
    };
  }
  function onRoomEvent(cb: RoomEventListener): () => void {
    roomEventListeners.current.add(cb);
    return () => {
      roomEventListeners.current.delete(cb);
    };
  }

  function onArmSwing(cb: ArmSwingListener): () => void {
    armSwingListeners.current.add(cb);
    return () => {
      armSwingListeners.current.delete(cb);
    };
  }

  function onPlayerDamage(cb: PlayerDamageListener): () => void {
    playerDamageListeners.current.add(cb);
    return () => {
      playerDamageListeners.current.delete(cb);
    };
  }

  function onWorldDropSpawned(cb: WorldDropSpawnListener): () => void {
    worldDropSpawnListeners.current.add(cb);
    return () => {
      worldDropSpawnListeners.current.delete(cb);
    };
  }

  function onWorldDropRemoved(cb: WorldDropRemovedListener): () => void {
    worldDropRemovedListeners.current.add(cb);
    return () => {
      worldDropRemovedListeners.current.delete(cb);
    };
  }

  function onWorldDropUpdated(cb: WorldDropUpdateListener): () => void {
    worldDropUpdateListeners.current.add(cb);
    return () => {
      worldDropUpdateListeners.current.delete(cb);
    };
  }

  return {
    connected,
    status,
    joinAck,
    sendInput,
    placeBlock,
    breakBlock,
    breakStart,
    breakFinish,
    breakCancel,
    armSwing,
    fallImpact,
    playerAttack,
    craft,
    pause,
    resume,
    stop,
    leave,
    onSnapshot,
    onBlockDelta,
    onRoomEvent,
    onArmSwing,
    onPlayerDamage,
    serverInventory,
    serverItemInventory,
    serverEquipmentSlots,
    serverCraftingGrid,
    serverCraftingGridWidth,
    serverVitals,
    serverChest,
    inventoryMove,
    openCraftingTable,
    closeCraftingTable,
    openChest,
    closeChest,
    chestMove,
    eatStart,
    eatFinish,
    eatCancel,
    setGameMode,
    dropHotbarItem,
    onWorldDropSpawned,
    onWorldDropRemoved,
    onWorldDropUpdated
  };
}
