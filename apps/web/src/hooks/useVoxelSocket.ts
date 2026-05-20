import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { supabase } from "@/lib/supabase";
import { getVoxelServerUrl } from "@/lib/voxelServerUrl";
import type {
  BlockDelta,
  BreakStartAck,
  CraftAck,
  CraftingGridWidth,
  CraftingGridSlot,
  GameMode,
  HotbarSlot,
  InputReq,
  InventoryMoveReq,
  InventorySyncPayload,
  ItemSlot,
  JoinRoomAck,
  JoinRoomAckOk,
  RoomEvent,
  RoomSnapshot,
  SimpleAck,
  Vec3,
  WorldDrop,
  WorldDropWireDelta
} from "@/lib/voxelProtocol";
import {
  BLOCK_REGISTRY,
  CRAFTING_GRID_SLOTS,
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

function inputWireEqual(a: InputReq, b: InputReq): boolean {
  return (
    Math.abs(a.pos[0] - b.pos[0]) <= POS_EPS &&
    Math.abs(a.pos[1] - b.pos[1]) <= POS_EPS &&
    Math.abs(a.pos[2] - b.pos[2]) <= POS_EPS &&
    Math.abs(a.heading - b.heading) <= HEADING_EPS &&
    a.jumping === b.jumping
  );
}

export type SnapshotListener = (snap: RoomSnapshot) => void;
export type BlockDeltaListener = (delta: BlockDelta) => void;
export type RoomEventListener = (ev: RoomEvent) => void;
export type WorldDropSpawnListener = (drop: WorldDrop) => void;
export type WorldDropRemovedListener = (id: string) => void;
export type WorldDropUpdateListener = (updates: WorldDropWireDelta[]) => void;

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
  craft: (recipeId: string) => Promise<CraftAck>;
  pause: () => Promise<SimpleAck>;
  resume: () => Promise<SimpleAck>;
  stop: () => Promise<SimpleAck>;
  leave: () => Promise<SimpleAck>;
  onSnapshot: (cb: SnapshotListener) => () => void;
  onBlockDelta: (cb: BlockDeltaListener) => () => void;
  onRoomEvent: (cb: RoomEventListener) => () => void;
  serverInventory: HotbarSlot[];
  serverItemInventory: ItemSlot[];
  serverCraftingGrid: CraftingGridSlot[];
  serverCraftingGridWidth: CraftingGridWidth;
  inventoryMove: (req: InventoryMoveReq) => Promise<SimpleAck>;
  openCraftingTable: (pos: Vec3) => Promise<SimpleAck>;
  closeCraftingTable: () => Promise<SimpleAck>;
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

  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<string>("מתחבר…");
  const [joinAck, setJoinAck] = useState<JoinRoomAckOk | null>(null);
  const [serverInventory, setServerInventory] = useState<HotbarSlot[]>([]);
  const [serverItemInventory, setServerItemInventory] = useState<ItemSlot[]>(
    () => emptyItemSlots()
  );
  const [serverCraftingGrid, setServerCraftingGrid] = useState<CraftingGridSlot[]>(
    () => emptyCraftingSlots()
  );
  const [serverCraftingGridWidth, setServerCraftingGridWidth] =
    useState<CraftingGridWidth>(2);

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
        setServerCraftingGrid(
          ack.craftingGrid?.length === CRAFTING_GRID_SLOTS
            ? ack.craftingGrid
            : emptyCraftingSlots()
        );
        setServerCraftingGridWidth(ack.craftingGridWidth ?? 2);
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
          payload?.craftingSlots &&
          Array.isArray(payload.craftingSlots) &&
          payload.craftingSlots.length === CRAFTING_GRID_SLOTS
        ) {
          setServerCraftingGrid(payload.craftingSlots);
        }
        if (payload?.craftingGridWidth === 2 || payload?.craftingGridWidth === 3) {
          setServerCraftingGridWidth(payload.craftingGridWidth);
        }
      });

      s.on("ROOM_SNAPSHOT", (payload: RoomSnapshot) => {
        for (const cb of snapshotListeners.current) cb(payload);
      });
      s.on("BLOCK_DELTA", (payload: BlockDelta) => {
        for (const cb of blockDeltaListeners.current) cb(payload);
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
    craft,
    pause,
    resume,
    stop,
    leave,
    onSnapshot,
    onBlockDelta,
    onRoomEvent,
    serverInventory,
    serverItemInventory,
    serverCraftingGrid,
    serverCraftingGridWidth,
    inventoryMove,
    openCraftingTable,
    closeCraftingTable,
    setGameMode,
    dropHotbarItem,
    onWorldDropSpawned,
    onWorldDropRemoved,
    onWorldDropUpdated
  };
}
