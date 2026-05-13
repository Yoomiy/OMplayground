import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { supabase } from "@/lib/supabase";
import { getVoxelServerUrl } from "@/lib/voxelServerUrl";
import type {
  BlockDelta,
  CraftAck,
  GameMode,
  HotbarSlot,
  InputReq,
  InventorySyncPayload,
  JoinRoomAck,
  JoinRoomAckOk,
  RoomEvent,
  RoomSnapshot,
  SimpleAck,
  Vec3
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
  craft: (recipeId: string) => Promise<CraftAck>;
  pause: () => Promise<SimpleAck>;
  resume: () => Promise<SimpleAck>;
  stop: () => Promise<SimpleAck>;
  leave: () => Promise<SimpleAck>;
  onSnapshot: (cb: SnapshotListener) => () => void;
  onBlockDelta: (cb: BlockDeltaListener) => () => void;
  onRoomEvent: (cb: RoomEventListener) => () => void;
  serverInventory: HotbarSlot[];
  setGameMode: (mode: GameMode) => Promise<SimpleAck>;
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

  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<string>("מתחבר…");
  const [joinAck, setJoinAck] = useState<JoinRoomAckOk | null>(null);
  const [serverInventory, setServerInventory] = useState<HotbarSlot[]>([]);

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
      });

      s.on("INVENTORY_SYNC", (payload: InventorySyncPayload) => {
        if (payload?.slots && Array.isArray(payload.slots)) {
          setServerInventory(payload.slots);
        }
      });

      s.on("ROOM_SNAPSHOT", (payload: RoomSnapshot) => {
        for (const cb of snapshotListeners.current) cb(payload);
      });
      s.on("BLOCK_DELTA", (payload: BlockDelta) => {
        for (const cb of blockDeltaListeners.current) cb(payload);
      });
      s.on("ROOM_EVENT", (payload: RoomEvent) => {
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

  async function craft(recipeId: string): Promise<CraftAck> {
    const s = socketRef.current;
    if (!s?.connected) return { ok: false, error: { code: "DISCONNECTED", message: "לא מחובר" } };
    return emitWithAck<CraftAck>(s, "CRAFT", { recipeId });
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

  return {
    connected,
    status,
    joinAck,
    sendInput,
    placeBlock,
    breakBlock,
    craft,
    pause,
    resume,
    stop,
    leave,
    onSnapshot,
    onBlockDelta,
    onRoomEvent,
    serverInventory,
    setGameMode
  };
}
